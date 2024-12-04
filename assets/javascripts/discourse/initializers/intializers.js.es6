import { withPluginApi } from 'discourse/lib/plugin-api';
import { ranks, officerRanks, enlistedRanks, lanyardGroups, lanyardToImageMap, qualifications, rankToImageMap, qualificationToImageMap, awards } from 'discourse/plugins/project-uniform/discourse/uniform-data';

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
  userInfo.style.textAlign = 'center';
  userInfo.style.marginBottom = '10px';
  userInfo.className = 'project-uniform-user-info';

  const groupsElement = document.createElement('p');
  groupsElement.textContent = `Groups: ${groups.map(group => group.name).join(', ') || 'None'}`;

  const badgesElement = document.createElement('p');
  badgesElement.textContent = `Badges: ${badgeNames.length > 0 ? badgeNames.join(', ') : 'None'}`;

  userInfo.appendChild(groupsElement);
  userInfo.appendChild(badgesElement);

  return userInfo;
}

function prepareAndRenderImages(groups, userBadges, badges, siteSettings, container) {
  let backgroundImageUrl = '';
  const foregroundImageUrls = []; // Array to hold multiple foreground images
  const awardImageUrls = []; // Array to hold award images

  // Determine the background image based on the highest priority rank
  if (groups.some(group => officerRanks.includes(group.name))) {
    backgroundImageUrl = formatUrl(siteSettings.project_uniform_ba_officers_uniform);
  } else if (groups.some(group => enlistedRanks.includes(group.name))) {
    backgroundImageUrl = formatUrl(siteSettings.project_uniform_ba_enlisted_uniform);
  }

  // Add beret images
  if (groups.some(group => group.name === 'Recruit')) {
    foregroundImageUrls.push(formatUrl(siteSettings.project_uniform_recruit_beret));
  } else if (groups.some(group => enlistedRanks.includes(group.name) || officerRanks.includes(group.name))) {
    foregroundImageUrls.push(formatUrl(siteSettings.project_uniform_para_beret));
  }

  // Add rank image
  const highestRank = ranks.find(rank => groups.some(group => group.name === rank.name));
  if (highestRank) {
    const imageKey = highestRank.imageKey;
    if (imageKey) {
      foregroundImageUrls.push(formatUrl(siteSettings[imageKey]));
    }
  }

  // Add lanyard-specific images using lanyardToImageMap
  groups.forEach(group => {
    const imageKey = lanyardToImageMap[group.name];
    if (imageKey) {
      foregroundImageUrls.push(formatUrl(siteSettings[imageKey]));
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
        foregroundImageUrls.push(formatUrl(siteSettings[imageKey]));
      }
    }

    // Add awards
    const award = awards.find(a => a.name === badgeName);
    if (award) {
      awardImageUrls.push(formatUrl(siteSettings[award.imageKey]));
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

function formatUrl(url) {
  return url ? (url.startsWith('http') || url.startsWith('/') ? url : `${window.location.origin}/${url}`) : '';
}

function mergeImagesOnCanvas(container, backgroundImageUrl, foregroundImageUrls, awardImageUrls, siteSettings) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const bgImage = new Image();
  const fgImages = foregroundImageUrls.map(url => new Image());
  const awardImages = awardImageUrls.map(url => {
    const img = new Image();
    img.alt = awards.find(award => formatUrl(siteSettings[award.imageKey]) === url)?.name || '';
    return img;
  });
  let imagesLoaded = 0;

  const onImageLoad = () => {
    imagesLoaded++;
    if (imagesLoaded === 1 + fgImages.length + awardImages.length) {
      // Set canvas size and draw images
      canvas.width = bgImage.naturalWidth || 1;
      canvas.height = bgImage.naturalHeight || 1;

      // Enable image smoothing for anti-aliasing
      ctx.imageSmoothingEnabled = true;

      // Add drop shadow for the background image
      ctx.save(); // Save the current canvas state
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'; // Shadow color
      ctx.shadowBlur = 10; // Shadow blur radius
      ctx.shadowOffsetX = 1; // Horizontal shadow offset
      ctx.shadowOffsetY = 1; // Vertical shadow offset

      // Draw the background image with shadow
      ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
      ctx.restore(); // Restore canvas state to prevent shadow on other drawings

      // Draw foreground images
      drawImages(ctx, fgImages, canvas);

      // Create a separate canvas for awards
      const awardsCanvas = document.createElement('canvas');
      const awardsCtx = awardsCanvas.getContext('2d');
      awardsCanvas.width = canvas.width;
      awardsCanvas.height = canvas.height;

      // Enable image smoothing for anti-aliasing on awards canvas
      awardsCtx.imageSmoothingEnabled = false;

      // Draw award images on the separate canvas
      drawAwards(awardsCtx, awardImages, awardsCanvas);

      // Create a new canvas with scaled dimensions for awards
      const scaledAwardsCanvas = document.createElement('canvas');
      const scaledAwardsCtx = scaledAwardsCanvas.getContext('2d');
      const scaleFactor = 0.28; // Adjust this factor to control the size of the awards canvas
      scaledAwardsCanvas.width = awardsCanvas.width * scaleFactor;
      scaledAwardsCanvas.height = awardsCanvas.height * scaleFactor;

      // Enable image smoothing for anti-aliasing on scaled awards canvas
      scaledAwardsCtx.imageSmoothingEnabled = false;

      // Draw the awards canvas onto the new canvas with the desired scale
      scaledAwardsCtx.drawImage(awardsCanvas, 0, 0, scaledAwardsCanvas.width, scaledAwardsCanvas.height);

      // Define the position, rotation, skew, and curvature for the awards canvas
      const awardsX = 383; // Adjust this value to control the horizontal position
      const awardsY = 274; // Adjust this value to control the vertical position
      const rotationAngle = -2 * Math.PI / 180; // Adjust this value to control the rotation angle (in radians)
      const skewX = -0 * Math.PI / 180; // Adjust this value to control the skew angle along the x-axis (in radians)
      const skewY = -4 * Math.PI / 180; // Adjust this value to control the skew angle along the y-axis (in radians)
      const curvatureX = 0; // Adjust this value to control the curvature along the x-axis
      const curvatureY = 0; // Adjust this value to control the curvature along the y-axis

      // Apply rotation, skew, and curvature, then draw the scaled awards back onto the main canvas at the specified position
      ctx.save(); // Save the current canvas state
      ctx.translate(awardsX + scaledAwardsCanvas.width / 2, awardsY + scaledAwardsCanvas.height / 2); // Move to the center of the awards canvas
      ctx.rotate(rotationAngle); // Apply rotation
      ctx.transform(1, Math.tan(skewY), Math.tan(skewX), 1, 0, 0); // Apply skew

      // Apply shadow to the awards canvas
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)'; // Shadow color
      ctx.shadowBlur = 2; // Shadow blur radius
      ctx.shadowOffsetX = -0.5 ; // Horizontal shadow offset
      ctx.shadowOffsetY = 0; // Vertical shadow offset

      // Apply curvature
      const imageData = scaledAwardsCtx.getImageData(0, 0, scaledAwardsCanvas.width, scaledAwardsCanvas.height);
      const data = imageData.data;
      const width = imageData.width;
      const height = imageData.height;
      const curvedImageData = scaledAwardsCtx.createImageData(width, height);

      for (let y = 0; y < height; y++) {
        const offsetX = Math.sin((y / height) * Math.PI) * curvatureX * width;
        for (let x = 0; x < width; x++) {
          const offsetY = Math.sin((x / width) * Math.PI) * curvatureY * height;
          const srcIndex = (y * width + x) * 4;
          const dstIndex = ((y + Math.round(offsetY)) * width + Math.round(x + offsetX)) * 4;
          if (dstIndex >= 0 && dstIndex < data.length) {
            curvedImageData.data[dstIndex] = data[srcIndex];
            curvedImageData.data[dstIndex + 1] = data[srcIndex + 1];
            curvedImageData.data[dstIndex + 2] = data[srcIndex + 2];
            curvedImageData.data[dstIndex + 3] = data[srcIndex + 3];
          }
        }
      }

      scaledAwardsCtx.putImageData(curvedImageData, 0, 0);

      ctx.drawImage(scaledAwardsCanvas, -scaledAwardsCanvas.width / 2, -scaledAwardsCanvas.height / 2, scaledAwardsCanvas.width, scaledAwardsCanvas.height);
      ctx.restore(); // Restore canvas state to prevent rotation and skew on other drawings

      // Display the merged image
      const mergedImage = createImageElement(canvas.toDataURL('image/png'), 'Merged Project Uniform Image');
      container.prepend(mergedImage);
    }
  };

  bgImage.onload = onImageLoad;
  fgImages.forEach(fgImage => (fgImage.onload = onImageLoad));
  awardImages.forEach(awardImage => (awardImage.onload = onImageLoad));

  bgImage.src = backgroundImageUrl || '';
  fgImages.forEach((fgImage, index) => (fgImage.src = foregroundImageUrls[index] || ''));
  awardImages.forEach((awardImage, index) => (awardImage.src = awardImageUrls[index] || ''));
}

function drawImages(ctx, images, canvas) {
  images.forEach(image => {
    const width = image.naturalWidth || 0;
    const height = image.naturalHeight || 0;
    const x = (canvas.width - width) / 2;
    const y = (canvas.height - height) / 2;
    if (width > 0 && height > 0) {
      ctx.drawImage(image, x, y, width, height);
    }
  });
}

function drawAwards(ctx, awardImages, canvas) {
  // Create a mapping of award names to their indices in the awards array
  const awardNameToIndex = Object.fromEntries(awards.map((award, index) => [award.name, index]));

  // Sort the awardImages array based on the seniority mapping
  const sortedAwardImages = awardImages.sort((a, b) => {
    const aIndex = awardNameToIndex[a.alt];
    const bIndex = awardNameToIndex[b.alt];
    return aIndex - bIndex;
  });

  // Reverse the sorted array to display from least to most senior
  const reversedAwardImages = sortedAwardImages.reverse();

  // Log the sorted order of awards for debugging
  console.log('Sorted Award Images:', reversedAwardImages.map(img => img.alt));

  // Custom placement logic for awards
  const maxAwardsPerRow = 4;
  const totalAwards = reversedAwardImages.length;
  const totalRows = Math.ceil(totalAwards / maxAwardsPerRow);

  reversedAwardImages.forEach((awardImage, index) => {
    const awardWidth = awardImage.naturalWidth || 0;
    const awardHeight = awardImage.naturalHeight || 0;
    const row = Math.floor(index / maxAwardsPerRow);
    const col = index % maxAwardsPerRow;

    // Calculate the number of awards in the current row
    const awardsInRow = row === totalRows - 1 ? totalAwards % maxAwardsPerRow || maxAwardsPerRow : maxAwardsPerRow;

    // Calculate the starting x position for the current row to center-align the awards
    const startX = (canvas.width - (awardsInRow * awardWidth + (awardsInRow - 1) * 1)) / 2;

    // Adjust placement logic to start from the right and move left
    const awardX = startX + (awardsInRow - col - 1) * (awardWidth + 1);
    const awardY = canvas.height - (row + 1) * (awardHeight + 1);

    if (awardWidth > 0 && awardHeight > 0) {
      ctx.drawImage(awardImage, awardX, awardY, awardWidth, awardHeight);
    }
  });
}

function createImageElement(src, alt) {
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  img.style.display = 'block';
  img.style.margin = '0 auto';
  return img;
}