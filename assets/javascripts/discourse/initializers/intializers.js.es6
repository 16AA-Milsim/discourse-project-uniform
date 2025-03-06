import { withPluginApi } from 'discourse/lib/plugin-api';
import { backgroundImages, ranks, officerRanks, enlistedRanks, lanyardGroups, lanyardToImageMap, qualifications, rankToImageMap, qualificationToImageMap, awards } from 'discourse/plugins/project-uniform/discourse/uniform-data';

export default {
  name: 'project-uniform',
  initialize(container) {
    withPluginApi('0.8.26', api => {
      const siteSettings = container.lookup('site-settings:main');

      api.onPageChange(url => {
        if (url && url.includes('/u/') && url.includes('/summary')) {
          const container = document.querySelector('.user-content');
          if (container && !document.querySelector('.project-uniform-placeholder')) {
            // Check if admin-only mode is enabled
            if (siteSettings.project_uniform_admin_only) {
              const currentUser = Discourse.User.current();
              if (!currentUser || !currentUser.admin) {
                console.log('Project Uniform: Admin-only mode is enabled. Hiding uniforms for non-admin users.');
                return;
              }
            }

            // Extract username from URL
            const username = url.split('/u/')[1].split('/')[0];

            // Fetch data from both APIs
            Promise.all([
              fetch(`/u/${username}.json`).then(response => response.ok ? response.json() : Promise.reject(response.statusText)),
              fetch(`/user-badges/${username}.json`).then(response => response.ok ? response.json() : Promise.reject(response.statusText))
            ])
              .then(([userSummaryData, badgeData]) => {
                console.log('Fetched user data:', userSummaryData);
                console.log('Fetched badge data:', badgeData);
            
                if (userSummaryData?.user && badgeData?.user_badges) {
                  const { user } = userSummaryData;
                  const groups = user.groups || [];
                  const badgeNames = badgeData.user_badges
                    .map(ub => badgeData.badges.find(b => b.id === ub.badge_id)?.name)
                    .filter(Boolean); // Filter out invalid badge names
            
                  // Display user information
                  const userInfo = createUserInfo(groups, badgeNames);
                  container.prepend(userInfo);
            
                  // Prepare images for rendering
                  prepareAndRenderImages(groups, badgeData.user_badges, badgeData.badges, siteSettings, container);
                }
              })
              .catch(error => console.error('Error fetching user data:', error));
          }
        }
      });
    });
  }
};

function createUserInfo(groups, badgeNames) {
  const userInfo = document.createElement('div');
  userInfo.className = 'project-uniform-user-info';
  userInfo.style.cssText = 'text-align: center; margin-bottom: 10px;';
  userInfo.innerHTML = `
    <p>Groups: ${groups.map(group => group.name).join(', ') || 'None'}</p>
    <p>Badges: ${badgeNames.length ? badgeNames.join(', ') : 'None'}</p>
  `;
  return userInfo;
}

function prepareAndRenderImages(groups, userBadges, badges, siteSettings, container) {
  let backgroundImageUrl = '';
  const foregroundImageUrls = []; // Array to hold multiple foreground images
  const awardImageUrls = []; // Array to hold award images

  // Determine the background image based on the highest priority rank
  if (groups.some(group => officerRanks.includes(group.name))) {
    backgroundImageUrl = backgroundImages.officer;
  } else if (groups.some(group => enlistedRanks.includes(group.name))) {
    backgroundImageUrl = backgroundImages.enlisted;
  }

  // Add rank image
  const highestRank = ranks.find(rank => groups.some(group => group.name === rank.name));
  if (highestRank) {
    if (highestRank?.imageKey) {
      foregroundImageUrls.push(highestRank.imageKey);
    }    
  }

  // Add lanyard-specific images using lanyardToImageMap
  groups.forEach(group => {
    const imageKey = lanyardToImageMap[group.name];
    if (imageKey) {
      foregroundImageUrls.push(imageKey);
    }    
  });

  // Add qualification-specific images and awards using badge matching
  userBadges.forEach(ub => {
    const badge = badges.find(b => b.id === ub.badge_id); // Match badge_id
    if (!badge) {
      console.warn('Skipping invalid badge:', ub);
      return; // Skip if no matching badge found
    }

    const badgeName = badge.name;

    // Add qualifications
    const qualification = qualifications.find(q => q.name === badgeName);
    const imageKey = qualification?.imageKey;

    if (imageKey) {
      const isRestricted = qualification?.restrictedRanks?.includes(highestRank?.name);
      if (!isRestricted) {
        foregroundImageUrls.push(imageKey);
      }
    }

    // Add awards
    const award = awards.find(a => a.name === badgeName);
    if (award?.imageKey) {
      awardImageUrls.push(award.imageKey);
    }    
  });

  // Filter out invalid URLs
  const validForegroundImageUrls = foregroundImageUrls.filter(Boolean);
  const validAwardImageUrls = awardImageUrls.filter(Boolean);

  // Log selected images for debugging
  console.log('Background Image URL:', backgroundImageUrl);
  console.log('Foreground Image URLs:', validForegroundImageUrls);
  console.log('Award Image URLs:', validAwardImageUrls);

  // Create and merge images on a canvas
  if (backgroundImageUrl && validForegroundImageUrls.length > 0) {
    mergeImagesOnCanvas(container, backgroundImageUrl, validForegroundImageUrls, validAwardImageUrls, siteSettings);
  }
}

function mergeImagesOnCanvas(container, backgroundImageUrl, foregroundImageUrls, awardImageUrls, siteSettings) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const bgImage = new Image();
  const fgImages = foregroundImageUrls.map(url => new Image());
  const awardImages = awardImageUrls.map(url => {
    const img = new Image();
    img.alt = awards.find(award => award.imageKey === url)?.name || '';
    return img;
  });

  let imagesLoaded = 0;

  const onImageLoad = () => {
    imagesLoaded++;
    if (imagesLoaded === 1 + fgImages.length + awardImages.length) {
      // Set canvas size and draw images
      canvas.width = bgImage.naturalWidth || 1;
      canvas.height = bgImage.naturalHeight || 1;

      // Ensure image smoothing for anti-aliasing is enabled in all browsers(for resizing service ribbons)
      ctx.imageSmoothingEnabled = true;

      // Add drop shadow for the background image
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      // Draw the background image with shadow
      ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Draw foreground images
      drawImages(ctx, fgImages, canvas);

      // Create a separate canvas for awards
      const awardsCanvas = document.createElement('canvas');
      const awardsCtx = awardsCanvas.getContext('2d');
      awardsCanvas.width = canvas.width;
      awardsCanvas.height = canvas.height;

      // Draw award images on the separate canvas
      drawAwards(awardsCtx, awardImages, awardsCanvas);

      // Create a new canvas with scaled dimensions for awards
      const scaledAwardsCanvas = document.createElement('canvas');
      const scaledAwardsCtx = scaledAwardsCanvas.getContext('2d');
      const scaleFactor = 0.29;
      scaledAwardsCanvas.width = awardsCanvas.width * scaleFactor;
      scaledAwardsCanvas.height = awardsCanvas.height * scaleFactor;

      scaledAwardsCtx.drawImage(awardsCanvas, 0, 0, scaledAwardsCanvas.width, scaledAwardsCanvas.height);

      // Define custom placement based on the number of awards
      let awardsX, awardsY;
      const totalAwards = awardImages.length;

      if (totalAwards === 1) {
        awardsX = 385; // Example custom x-coordinate for 1 award
        awardsY = 45; // Example custom y-coordinate for 1 award
      } else if (totalAwards === 2) {
        awardsX = 382; // Example custom x-coordinate for 2 awards
        awardsY = 45; // Example custom y-coordinate for 2 awards
      } else if (totalAwards === 3) {
        awardsX = 384; // Example custom x-coordinate for 3 awards
        awardsY = 44; // Example custom y-coordinate for 3 awards
      } else {
        awardsX = 380; // Default x-coordinate for 4 or more awards
        awardsY = 46; // Default y-coordinate for 4 or more awards
      }

      const rotationAngle = -3 * Math.PI / 180;
      const skewX = -0 * Math.PI / 180;
      const skewY = -3 * Math.PI / 180;

      // Apply rotation and skew, then draw the scaled awards canvas at the specified position
      ctx.save();
      ctx.translate(awardsX + scaledAwardsCanvas.width / 2, awardsY + scaledAwardsCanvas.height / 2);
      ctx.rotate(rotationAngle);
      ctx.transform(1, Math.tan(skewY), Math.tan(skewX), 1, 0, 0);

      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = -0.5;
      ctx.shadowOffsetY = 0;

      ctx.drawImage(
        scaledAwardsCanvas,
        -scaledAwardsCanvas.width / 2,
        -scaledAwardsCanvas.height / 2,
        scaledAwardsCanvas.width,
        scaledAwardsCanvas.height
      );
      ctx.restore();

      // Display the merged image
      const mergedImage = createImageElement(canvas.toDataURL('image/png'), 'Merged Project Uniform Image');
      container.prepend(mergedImage);
    }
  };

  bgImage.onload = onImageLoad;
  fgImages.forEach((fgImage, index) => (fgImage.onload = onImageLoad));
  awardImages.forEach((awardImage, index) => (awardImage.onload = onImageLoad));
  bgImage.src = backgroundImageUrl || '';
  fgImages.forEach((fgImage, index) => (fgImage.src = foregroundImageUrls[index] || ''));
  awardImages.forEach((awardImage, index) => (awardImage.src = awardImageUrls[index] || ''));
}

function drawImages(ctx, images, canvas) {
  images.forEach((image) => {
    const { naturalWidth = 0, naturalHeight = 0 } = image;
    if (naturalWidth > 0 && naturalHeight > 0) {
      const x = (canvas.width - naturalWidth) / 2;
      const y = (canvas.height - naturalHeight) / 2;
      ctx.drawImage(image, x, y, naturalWidth, naturalHeight);
    }
  });
}

function drawAwards(ctx, awardImages, canvas) {
  // Map award names to their indices for sorting by seniority
  const awardNameToIndex = Object.fromEntries(awards.map((award, index) => [award.name, index]));

  // Sort awards based on seniority mapping
  const sortedAwardImages = awardImages.sort((a, b) => {
    const aIndex = awardNameToIndex[a.alt] ?? Infinity;
    const bIndex = awardNameToIndex[b.alt] ?? Infinity;
    return aIndex - bIndex;
  });

  // Reverse order so highest priority awards appear first
  const reversedAwardImages = sortedAwardImages.reverse();
  const maxAwardsToDisplay = 22;
  const finalAwardImages = reversedAwardImages.slice(-maxAwardsToDisplay);

  // **Set max awards per row (fixed structure)**
  const maxAwardsPerRowArray = [4, 4, 4, 4, 3, 2, 1];

  let rowAwardCounts = Array(maxAwardsPerRowArray.length).fill(0);
  let rowAssignments = [];
  let currentRow = 0;

  // Assign awards to rows respecting the max per row
  finalAwardImages.forEach((awardImage, index) => {
    while (rowAwardCounts[currentRow] >= maxAwardsPerRowArray[currentRow]) {
      currentRow++;
    }
    rowAssignments.push(currentRow);
    rowAwardCounts[currentRow]++;
  });

  // **Log row assignments for debugging**
  console.log("Row Assignments:", rowAssignments);

  // Place awards on the canvas based on row assignments
  finalAwardImages.forEach((awardImage, index) => {
    const { naturalWidth: awardWidth = 0, naturalHeight: awardHeight = 0 } = awardImage;

    if (awardWidth > 0 && awardHeight > 0) {
      const row = rowAssignments[index];
      const awardsInRow = rowAwardCounts[row];
      let col = index - rowAssignments.findIndex(r => r === row); // Correct col position per row

      let startX;

      // **Aligning Rows**
      if (row <= 3) { // **Rows 1-4 (Centered)**
        startX = (canvas.width - (awardsInRow * (awardWidth + 1))) / 2;
      } else if (row === 4) { // **Row 5 (Special Case)**
        startX = awardsInRow === 1
            ? (canvas.width - awardWidth) / 2  // **If 1 award, center it**
            : canvas.width - (maxAwardsPerRowArray[row] * (awardWidth + 1)) - 146; // **Else, right-align**
      } else if (row === 5) { // **Row 6 (Max 2, Right-Aligned)**
        startX = canvas.width - (maxAwardsPerRowArray[row] * (awardWidth + 1)) - 150;
      } else if (row === 6) { // **Row 7 (Max 1, Right-Aligned)**
        startX = canvas.width - awardWidth - 155;
      } else { // **Failsafe: Center alignment**
        startX = (canvas.width - (awardsInRow * (awardWidth + 1))) / 2;
      }

// **Calculate final position**
      const awardX = startX + ((awardsInRow - 1 - col) * (awardWidth + 1));
      const awardY = canvas.height - ((row + 1) * (awardHeight + 1));

      ctx.drawImage(awardImage, awardX, awardY, awardWidth, awardHeight);
    }
  });
}

function createImageElement(src, alt) {
  const img = Object.assign(document.createElement('img'), {
    src, alt, style: 'display: block; margin: 0 auto;',
  });
  return img;
}