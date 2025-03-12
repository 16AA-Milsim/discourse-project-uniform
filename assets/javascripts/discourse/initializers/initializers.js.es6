import { withPluginApi } from 'discourse/lib/plugin-api';
import {
  backgroundImages,
  ranks,
  officerRanks,
  enlistedRanks,
  lanyardGroups,
  lanyardToImageMap,
  groupToImageMap,
  qualifications,
  rankToImageMap,
  qualificationToImageMap,
  awards
} from 'discourse/plugins/project-uniform/discourse/uniform-data';

// Global storage for tooltip regions.
const tooltipRegions = [];

// Registers a tooltip region with given coordinates and content.
function registerTooltip(x, y, width, height, content) {
  console.log('Registering tooltip region:', { x, y, width, height, content });
  tooltipRegions.push({ x, y, width, height, content });
}

// Attaches a tooltip element to the canvas container and sets up mouse event handlers.
function setupTooltips(canvas) {
  const ctx = canvas.getContext('2d');

  tooltipRegions.forEach(region => {
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.strokeRect(region.x, region.y, region.width, region.height);
    console.log(`Drawing debug tooltip box at (${region.x}, ${region.y})`);
  });

  const tooltip = document.createElement('div');
  tooltip.className = 'canvas-tooltip';
  tooltip.style.position = 'absolute';
  tooltip.style.opacity = '0'; 
  tooltip.style.transition = 'opacity 0.1s ease-in-out'; // SHORTER TRANSITION TIME
  tooltip.style.background = 'rgba(0, 0, 0, 0.85)';
  tooltip.style.color = '#fff';
  tooltip.style.padding = '4px 8px';
  tooltip.style.borderRadius = '4px';
  tooltip.style.fontFamily = 'Roboto, sans-serif';
  tooltip.style.fontSize = '16px';
  tooltip.style.pointerEvents = 'none';

  canvas.parentElement.style.position = 'relative';
  canvas.parentElement.appendChild(tooltip);

  let activeTooltip = null;
  let fadeTimeout = null;

  canvas.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    let found = false;
    let newTooltipContent = null;

    for (const region of tooltipRegions) {
      if (
        localX >= region.x &&
        localX <= region.x + region.width &&
        localY >= region.y &&
        localY <= region.y + region.height
      ) {
        newTooltipContent = region.content;

        if (activeTooltip !== newTooltipContent) {
          activeTooltip = newTooltipContent;

          if (fadeTimeout) {
            clearTimeout(fadeTimeout);
          }

          tooltip.style.opacity = "0";

          fadeTimeout = setTimeout(() => {
            tooltip.innerHTML = newTooltipContent;
            tooltip.style.left = localX + 60 + "px";
            tooltip.style.top = localY + 40 + "px";
            tooltip.style.opacity = "1"; // QUICKER FADE-IN
          }, 100); // SHORTER DELAY BEFORE SHOWING NEW TOOLTIP
        }

        if (region.content.includes("<img")) {
          tooltip.style.width = "250px";
          tooltip.style.whiteSpace = "normal";
          tooltip.style.textAlign = "center";
        } else {
          tooltip.style.width = "auto";
        }

        found = true;
        break;
      }
    }

    if (!found) {
      activeTooltip = null;
      if (fadeTimeout) {
        clearTimeout(fadeTimeout);
      }
      fadeTimeout = setTimeout(() => {
        tooltip.style.opacity = "0"; // QUICKER FADE-OUT
      }, 50); // SHORTER FADE-OUT DELAY
    }
  });

  canvas.addEventListener('mouseout', () => {
    activeTooltip = null;
    if (fadeTimeout) {
      clearTimeout(fadeTimeout);
    }
    fadeTimeout = setTimeout(() => {
      tooltip.style.opacity = '0';
    }, 50);
  });
}

// Transforms a point using rotation and skew parameters.
function transformPoint(x, y, tx, ty, angle, tanSkewY, offsetX, offsetY) {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const m11 = cosA;
  const m12 = tanSkewY * cosA - sinA;
  const m21 = sinA;
  const m22 = tanSkewY * sinA + cosA;
  const x0 = x - offsetX;
  const y0 = y - offsetY;
  const newPoint = {
    x: tx + (m11 * x0 + m12 * y0),
    y: ty + (m21 * x0 + m22 * y0)
  };
  console.log('Transformed point:', { x, y, newPoint });
  return newPoint;
}

export default {
  name: 'project-uniform',
  initialize(container) {
    withPluginApi('0.8.26', api => {
      const siteSettings = container.lookup('site-settings:main');
      api.onPageChange(url => {
        if (url && url.includes('/u/') && url.includes('/summary')) {
          const containerElement = document.querySelector('.user-content');
          if (containerElement && !document.querySelector('.project-uniform-placeholder')) {
            if (siteSettings.project_uniform_admin_only) {
              const currentUser = Discourse.User.current();
              if (!currentUser || !currentUser.admin) {
                console.log('Project Uniform: Admin-only mode enabled. Hiding uniform for non-admins.');
                return;
              }
            }
            const username = url.split('/u/')[1].split('/')[0];
            console.log('Extracted username:', username);
            Promise.all([
              fetch(`/u/${username}.json`)
                .then(response => response.ok ? response.json() : Promise.reject(response.statusText))
                .catch(error => { console.error('Error fetching user JSON:', error); throw error; }),
              fetch(`/user-badges/${username}.json`)
                .then(response => response.ok ? response.json() : Promise.reject(response.statusText))
                .catch(error => { console.error('Error fetching user badges JSON:', error); throw error; })
            ])
              .then(([userSummaryData, badgeData]) => {
                console.log('Fetched user data:', userSummaryData);
                console.log('Fetched badge data:', badgeData);
                if (userSummaryData?.user && badgeData?.user_badges) {
                  const { user } = userSummaryData;
                  const groups = user.groups || [];
                  const badgeNames = badgeData.user_badges
                    .map(ub => badgeData.badges.find(b => b.id === ub.badge_id)?.name)
                    .filter(Boolean);
                  console.log('User groups:', groups);
                  console.log('User badge names:', badgeNames);
                  const userInfo = createUserInfo(groups, badgeNames);
                  containerElement.prepend(userInfo);
                  prepareAndRenderImages(groups, badgeData.user_badges, badgeData.badges, siteSettings, containerElement);
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
    <p>Groups: ${groups.map(g => g.name).join(', ') || 'None'}</p>
    <p>Badges: ${badgeNames.length ? badgeNames.join(', ') : 'None'}</p>
  `;
  console.log('Created user info element.');
  return userInfo;
}

function prepareAndRenderImages(groups, userBadges, badges, siteSettings, container) {
  let backgroundImageUrl = '';
  const foregroundImageUrls = [];
  const awardImageUrls = [];
  const is16CSMR = groups.some(g => ["16CSMR", "16CSMR_IC", "16CSMR_2IC"].includes(g.name));

  if (groups.some(g => officerRanks.includes(g.name))) {
    backgroundImageUrl = backgroundImages.officer;
  } else if (groups.some(g => enlistedRanks.includes(g.name))) {
    backgroundImageUrl = backgroundImages.enlisted;
  }
  console.log('Determined background image URL:', backgroundImageUrl);

  const highestRank = ranks.find(r => groups.some(g => g.name === r.name));
  if (highestRank?.imageKey) {
    foregroundImageUrls.push(highestRank.imageKey);
    console.log('Added rank image:', highestRank.imageKey);
  }
  groups.forEach(g => {
    const groupImage = groupToImageMap[g.name];
    if (groupImage) {
      foregroundImageUrls.push(groupImage);
      console.log(`Added group image for ${g.name}:`, groupImage);
    }
  });
  groups.forEach(g => {
    const imageKey = lanyardToImageMap[g.name];
    if (imageKey) {
      foregroundImageUrls.push(imageKey);
      console.log(`Added lanyard image for ${g.name}:`, imageKey);
    }
  });
  userBadges.forEach(ub => {
    const badge = badges.find(b => b.id === ub.badge_id);
    if (!badge) {
      console.warn('Skipping invalid badge:', ub);
      return;
    }
    const badgeName = badge.name;
    if (is16CSMR && (badgeName === "1st Class Marksman" || badgeName === "Sharpshooter" || badgeName === "Sniper")) return;
    if (badgeName === "CMT" || badgeName === "Combat Medical Technician") {
      if (is16CSMR) {
        foregroundImageUrls.push('/assets/images/qualifications/cmt.png');
        console.log('Added CMT qualification image for 16CSMR member.');
      }
      return;
    }
    const qualification = qualifications.find(q => q.name === badgeName);
    const imageKey = qualification?.imageKey;
    if (imageKey) {
      const isRestricted = qualification?.restrictedRanks?.includes(highestRank?.name);
      if (!isRestricted) {
        foregroundImageUrls.push(imageKey);
        console.log(`Added qualification image for ${badgeName}:`, imageKey);
      }
    }
    const award = awards.find(a => a.name === badgeName);
    if (award?.imageKey) {
      awardImageUrls.push(award.imageKey);
      console.log(`Added award image for ${badgeName}:`, award.imageKey);
    }
  });
  const validForegroundImageUrls = foregroundImageUrls.filter(Boolean);
  const validAwardImageUrls = awardImageUrls.filter(Boolean);
  console.log('Final foreground image URLs:', validForegroundImageUrls);
  console.log('Final award image URLs:', validAwardImageUrls);
  if (backgroundImageUrl && validForegroundImageUrls.length > 0) {
    mergeImagesOnCanvas(container, backgroundImageUrl, validForegroundImageUrls, validAwardImageUrls, siteSettings, highestRank);
  } else {
    console.error('Missing required image URLs for composite rendering.');
  }
}

function mergeImagesOnCanvas(container, backgroundImageUrl, foregroundImageUrls, awardImageUrls, siteSettings, highestRank) {
  console.log('Starting mergeImagesOnCanvas...');
  const canvas = document.createElement('canvas');
  canvas.style.position = 'relative';
  canvas.style.zIndex = '0';
  canvas.style.pointerEvents = 'auto';
  canvas.style.display = 'block';
  canvas.style.margin = '0 auto';

  const ctx = canvas.getContext('2d');
  const bgImage = new Image();
  const fgImages = foregroundImageUrls.map(url => new Image());
  const awardImages = awardImageUrls.map(url => {
    const img = new Image();
    img.alt = (awards.find(a => a.imageKey === url) || {}).name || '';
    return img;
  });

  let imagesLoaded = 0;
  const totalImages = 1 + fgImages.length + awardImages.length;
  console.log(`Expecting to load ${totalImages} images.`);

  function checkAllLoaded() {
    if (imagesLoaded === totalImages) {
      console.log('All images loaded successfully.');
      try {
        canvas.width = bgImage.naturalWidth || 1;
        canvas.height = bgImage.naturalHeight || 1;
        console.log('Canvas dimensions set to:', canvas.width, canvas.height);
      } catch (e) {
        console.error('Error setting canvas dimensions:', e);
      }
      ctx.imageSmoothingEnabled = true;
      try {
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        console.log('Background image drawn.');
      } catch (e) {
        console.error('Error drawing background image:', e);
      }
      try {
        drawImages(ctx, fgImages, canvas);
        console.log('Foreground images drawn.');
        if (highestRank && fgImages.length > 0 && highestRank.tooltipAreas) {
          const rankImg = fgImages[0]; // assuming rank image is first
          const x = (canvas.width - rankImg.naturalWidth) / 2;
          const y = (canvas.height - rankImg.naturalHeight) / 2;
          const tooltipContent = `<img src="${highestRank.tooltipImage}"> ${highestRank.tooltipText}`;
          
          highestRank.tooltipAreas.forEach(area => {
            // area.x, area.y, area.width, area.height are relative to the rank image
            registerTooltip(
              x + area.x,
              y + area.y,
              area.width,
              area.height,
              tooltipContent
            );
            console.log('Registered rank tooltip area:', {
              x: x + area.x,
              y: y + area.y,
              width: area.width,
              height: area.height,
              content: tooltipContent
            });
          });
        }
      } catch (e) {
        console.error('Error drawing foreground images:', e);
      }
      try {
        // Create a separate canvas for awards.
        const awardsCanvas = document.createElement('canvas');
        awardsCanvas.width = canvas.width;
        awardsCanvas.height = canvas.height;
        const awardsCtx = awardsCanvas.getContext('2d');
        const awardTooltips = drawAwards(awardsCtx, awardImages, awardsCanvas);
        console.log('Awards drawn on separate canvas, tooltips data:', awardTooltips);
        
        // Scale awards canvas.
        const scaleFactor = 0.29;
        const scaledAwardsCanvas = document.createElement('canvas');
        scaledAwardsCanvas.width = awardsCanvas.width * scaleFactor;
        scaledAwardsCanvas.height = awardsCanvas.height * scaleFactor;
        const scaledAwardsCtx = scaledAwardsCanvas.getContext('2d');
        scaledAwardsCtx.drawImage(awardsCanvas, 0, 0, scaledAwardsCanvas.width, scaledAwardsCanvas.height);
        console.log('Scaled awards canvas created with scale factor:', scaleFactor);
        
        // Determine awards placement.
        let awardsX, awardsY;
        const totalAwardsCount = awardImages.length;
        if (totalAwardsCount === 1) {
          awardsX = 385; awardsY = 45;
        } else if (totalAwardsCount === 2) {
          awardsX = 382; awardsY = 45;
        } else if (totalAwardsCount === 3) {
          awardsX = 384; awardsY = 44;
        } else {
          awardsX = 380; awardsY = 46;
        }
        console.log('Awards placement:', awardsX, awardsY);
        
        const rotationAngle = -3 * Math.PI / 180;
        const skewYValue = -3 * Math.PI / 180;
        ctx.save();
        ctx.translate(awardsX + scaledAwardsCanvas.width / 2, awardsY + scaledAwardsCanvas.height / 2);
        ctx.rotate(rotationAngle);
        ctx.transform(1, Math.tan(skewYValue), Math.tan(0), 1, 0, 0);
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
        console.log('Scaled awards drawn onto main canvas.');
        
        // Register tooltip regions for awards.
        const tx = awardsX + scaledAwardsCanvas.width / 2;
        const ty = awardsY + scaledAwardsCanvas.height / 2;
        const offsetX = scaledAwardsCanvas.width / 2;
        const offsetY = scaledAwardsCanvas.height / 2;
        const ribbonTooltipXOffset = 0;
        const ribbonTooltipRotationOffset = -3 * Math.PI / 180; // Adjust this for more counterclockwise rotation

        awardTooltips.forEach(t => {
          // Apply the same scaling factor used for rendering images
          const xScaled = t.x * scaleFactor + ribbonTooltipXOffset;
          const yScaled = t.y * scaleFactor;
          const widthScaled = t.width * scaleFactor;
          const heightScaled = t.height * scaleFactor;

          const tanSkewY = Math.tan(skewYValue);

          // Apply additional rotation offset
          const adjustedRotationAngle = rotationAngle + ribbonTooltipRotationOffset;

          // Transform each corner of the tooltip region with adjusted rotation
          const pointA = transformPoint(xScaled, yScaled, tx, ty, adjustedRotationAngle, tanSkewY, offsetX, offsetY);
          const pointB = transformPoint(xScaled + widthScaled, yScaled, tx, ty, adjustedRotationAngle, tanSkewY, offsetX, offsetY);
          const pointC = transformPoint(xScaled, yScaled + heightScaled, tx, ty, adjustedRotationAngle, tanSkewY, offsetX, offsetY);
          const pointD = transformPoint(xScaled + widthScaled, yScaled + heightScaled, tx, ty, adjustedRotationAngle, tanSkewY, offsetX, offsetY);

          // Compute the bounding box after transformation
          const minX = Math.min(pointA.x, pointB.x, pointC.x, pointD.x);
          const minY = Math.min(pointA.y, pointB.y, pointC.y, pointD.y);
          const maxX = Math.max(pointA.x, pointB.x, pointC.x, pointD.x);
          const maxY = Math.max(pointA.y, pointB.y, pointC.y, pointD.y);

          registerTooltip(
            minX,
            minY,
            (maxX - minX) - 2,
            (maxY - minY) - 2,
            t.content
          );

          console.log('Registered award tooltip region (adjusted for rotation offset):', { 
            minX, minY, width: maxX - minX, height: maxY - minY, content: t.content 
          });
        });


      } catch (e) {
        console.error('Error processing awards:', e);
      }
      
      try {
        // Prepend the composite canvas so it displays at the top of the container.
        container.prepend(canvas);
        setupTooltips(canvas);
        console.log('Composite canvas prepended and tooltips set up.');
      } catch (e) {
        console.error('Error appending canvas or setting up tooltips:', e);
      }
    } else {
      console.log(`Images loaded: ${imagesLoaded}/${totalImages}`);
    }
  }
  
  bgImage.onerror = () => console.error('Error loading background image:', backgroundImageUrl);
  fgImages.forEach((img, i) => { img.onerror = () => console.error('Error loading foreground image:', i, foregroundImageUrls[i]); });
  awardImages.forEach((img, i) => { img.onerror = () => console.error('Error loading award image:', i, awardImageUrls[i]); });
  
  bgImage.onload = () => { imagesLoaded++; console.log('Background image loaded:', bgImage.naturalWidth, bgImage.naturalHeight); checkAllLoaded(); };
  fgImages.forEach((img, i) => { img.onload = () => { imagesLoaded++; console.log(`Foreground image ${i} loaded:`, img.naturalWidth, img.naturalHeight); checkAllLoaded(); }; });
  awardImages.forEach((img, i) => { img.onload = () => { imagesLoaded++; console.log(`Award image ${i} loaded:`, img.naturalWidth, img.naturalHeight); checkAllLoaded(); }; });
  
  bgImage.src = backgroundImageUrl || '';
  fgImages.forEach((img, i) => { img.src = foregroundImageUrls[i] || ''; });
  awardImages.forEach((img, i) => { img.src = awardImageUrls[i] || ''; });
}

function drawImages(ctx, images, canvas) {
  images.forEach((image, idx) => {
    if (image.naturalWidth && image.naturalHeight) {
      const x = (canvas.width - image.naturalWidth) / 2;
      const y = (canvas.height - image.naturalHeight) / 2;
      ctx.drawImage(image, x, y, image.naturalWidth, image.naturalHeight);
      console.log(`Drew foreground image ${idx} at (${x}, ${y}) with dimensions (${image.naturalWidth}x${image.naturalHeight}).`);
    } else {
      console.warn(`Foreground image ${idx} missing dimensions.`);
    }
  });
}

function drawAwards(ctx, awardImages, canvas) {
  const awardNameToIndex = Object.fromEntries(awards.map((award, index) => [award.name, index]));

  // Sort ribbons by seniority
  const sortedAwardImages = awardImages
    .sort((a, b) => (awardNameToIndex[a.alt] ?? Infinity) - (awardNameToIndex[b.alt] ?? Infinity))
    .reverse();

  const maxAwardsToDisplay = 22;
  const finalAwardImages = sortedAwardImages.slice(-maxAwardsToDisplay);

  // Define max ribbons per row
  const maxAwardsPerRowArray = [4, 4, 4, 4, 3, 2, 1];

  let rowAwardCounts = Array(maxAwardsPerRowArray.length).fill(0);
  let rowAssignments = [];
  let currentRow = 0;

  // Assign ribbons to rows respecting the max per row
  finalAwardImages.forEach((_, index) => {
    while (rowAwardCounts[currentRow] >= maxAwardsPerRowArray[currentRow]) {
      currentRow++;
    }
    rowAssignments.push(currentRow);
    rowAwardCounts[currentRow]++;
  });

  const tooltipData = [];

  // Track precise rendering positions
  finalAwardImages.forEach((awardImage, index) => {
    if (!awardImage.naturalWidth || !awardImage.naturalHeight) {
      console.warn(`Award image ${index} missing dimensions.`);
      return;
    }

    const row = rowAssignments[index];
    const awardsInRow = rowAwardCounts[row];
    let col = index - rowAssignments.findIndex(r => r === row);

    let startX;
    if (row <= 3) { 
      startX = (canvas.width - (awardsInRow * (awardImage.naturalWidth + 1))) / 2;
    } else if (row === 4) {
      startX = awardsInRow === 1
          ? (canvas.width - awardImage.naturalWidth) / 2
          : canvas.width - (maxAwardsPerRowArray[row] * (awardImage.naturalWidth + 1)) - 146;
    } else if (row === 5) {
      startX = canvas.width - (maxAwardsPerRowArray[row] * (awardImage.naturalWidth + 1)) - 150;
    } else if (row === 6) {
      startX = canvas.width - awardImage.naturalWidth - 155;
    } else {
      startX = (canvas.width - (awardsInRow * (awardImage.naturalWidth + 1))) / 2;
    }

    const awardX = startX + ((awardsInRow - 1 - col) * awardImage.naturalWidth);
    const awardY = canvas.height - ((row + 1) * awardImage.naturalHeight);

    // Draw the ribbon
    ctx.drawImage(awardImage, awardX, awardY, awardImage.naturalWidth, awardImage.naturalHeight);

    console.log(`Drew ribbon ${index} at (${awardX}, ${awardY})`);

    // Store tooltip data
    const awardData = awards.find(a => a.imageKey === awardImage.src || a.name === awardImage.alt) || {};
    const content = `<img src="${awardData.tooltipImage || awardData.imageKey}"> ${awardData.tooltipText || awardData.name}`;
    
    tooltipData.push({ x: awardX, y: awardY, width: awardImage.naturalWidth, height: awardImage.naturalHeight, content });
  });

  return tooltipData;
}

function createImageElement(src, alt) {
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  img.style.display = 'block';
  img.style.margin = '0 auto';
  return img;
}
