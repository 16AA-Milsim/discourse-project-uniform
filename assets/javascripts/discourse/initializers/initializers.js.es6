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
  awards,
  lanyardTooltipRegion,
  lanyardTooltipMap,
  groupTooltipMap
} from 'discourse/plugins/project-uniform/discourse/uniform-data';

// Global storage for tooltip regions.
const tooltipRegions = [];
const DEBUG_TOOLTIPS = false; // Change to true when you want to see red rectangles
let cachedRect = null; // Will store the latest bounding rect

// Registers a tooltip region with given coordinates and content.
function registerTooltip(x, y, width, height, content) {
  console.log('Registering tooltip region:', { x, y, width, height, content });
  tooltipRegions.push({ x, y, width, height, content });
}

// Attaches a tooltip element to the canvas container and sets up mouse event handlers.
function setupTooltips(canvas) {
  const ctx = canvas.getContext("2d");

  if (DEBUG_TOOLTIPS) {
    tooltipRegions.forEach(region => {
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;
      ctx.strokeRect(region.x, region.y, region.width, region.height);
      console.log(`Drawing debug tooltip box at (${region.x}, ${region.y})`);
    });
  }

  const tooltip = document.createElement("div");
  tooltip.className = "canvas-tooltip";
  Object.assign(tooltip.style, {
    position: "absolute",
    opacity: "0",
    transition: "opacity 0.1s ease-in-out",
    background: "rgba(0,0,0,0.85)",
    color: "#fff",
    padding: "4px 8px",
    borderRadius: "4px",
    fontFamily: "Roboto, sans-serif",
    fontSize: "16px",
    pointerEvents: "none"
  });

  canvas.parentElement.style.position = "relative";
  canvas.parentElement.appendChild(tooltip);

  let activeTooltip = null;
  let fadeTimeout = null;

  // Compute bounding rect once
  cachedRect = canvas.getBoundingClientRect();

  // Recompute on scroll or resize
  window.addEventListener("scroll", () => {
    cachedRect = canvas.getBoundingClientRect();
  });
  window.addEventListener("resize", () => {
    cachedRect = canvas.getBoundingClientRect();
  });

  canvas.addEventListener("mousemove", (event) => {
    if (!cachedRect) return;

    const localX = event.clientX - cachedRect.left;
    const localY = event.clientY - cachedRect.top;
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
          if (fadeTimeout) clearTimeout(fadeTimeout);

          tooltip.style.opacity = "0";
          fadeTimeout = setTimeout(() => {
            tooltip.innerHTML = newTooltipContent;

            // Place temporarily to measure size
            tooltip.style.left = "0px";
            tooltip.style.top = "0px";
            tooltip.style.visibility = "hidden";
            tooltip.style.opacity = "0";

            requestAnimationFrame(() => {
              const canvasRect = canvas.getBoundingClientRect();
              const parentRect = canvas.parentElement.getBoundingClientRect();
              const offsetX = canvasRect.left - parentRect.left;
              const offsetY = canvasRect.top - parentRect.top;

              const tooltipWidth = tooltip.offsetWidth;
              const tooltipHeight = tooltip.offsetHeight;

              const offsetAdjustX = 0;
              const offsetAdjustY = 25;

              tooltip.style.left =
                offsetX + region.x + region.width / 2 + offsetAdjustX + "px";
              tooltip.style.top =
                offsetY + region.y + region.height / 2 + offsetAdjustY + "px";

              tooltip.style.visibility = "visible";
              tooltip.style.opacity = "1";
            });
          }, 100);
        }

        tooltip.style.width = region.content.includes("<img") ? "250px" : "auto";
        tooltip.style.whiteSpace = region.content.includes("<img") ? "normal" : "nowrap";
        tooltip.style.textAlign = region.content.includes("<img") ? "center" : "left";

        found = true;
        break;
      }
    }

    if (!found) {
      activeTooltip = null;
      if (fadeTimeout) clearTimeout(fadeTimeout);
      fadeTimeout = setTimeout(() => {
        tooltip.style.opacity = "0";
      }, 50);
    }
  });

  canvas.addEventListener("mouseout", () => {
    activeTooltip = null;
    if (fadeTimeout) clearTimeout(fadeTimeout);
    fadeTimeout = setTimeout(() => {
      tooltip.style.opacity = "0";
    }, 50);
  });
}

// Transforms a point using rotation and skew parameters.
function transformPoint(x, y, tx, ty, angle, tanSkewY, offsetX, offsetY) {
  const cosA = Math.cos(angle), sinA = Math.sin(angle);
  const x0 = x - offsetX, y0 = y - offsetY;
  return {
    x: tx + cosA * x0 + (tanSkewY * cosA - sinA) * y0,
    y: ty + sinA * x0 + (tanSkewY * sinA + cosA) * y0
  };
}

export default {
  name: 'project-uniform',
  initialize(container) {
    withPluginApi('0.8.26', api => {
      const siteSettings = container.lookup('site-settings:main');
      api.onPageChange(url => {
        if (!(url && url.includes('/u/') && url.includes('/summary'))) return;

        const containerElement = document.querySelector('.user-content');
        if (!containerElement || document.querySelector('.project-uniform-placeholder')) return;

        if (siteSettings.project_uniform_admin_only) {
          const currentUser = Discourse.User.current();
          if (!currentUser || !currentUser.admin) {
            console.log('Project Uniform: Admin-only mode enabled. Hiding uniform for non-admins.');
            return;
          }
        }

        const username = url.split('/u/')[1].split('/')[0];
        console.log('Extracted username:', username);

        const fetchJson = (url) =>
          fetch(url)
            .then(response => {
              if (!response.ok) throw new Error(response.statusText);
              return response.json();
            })
            .catch(error => {
              console.error(`Error fetching ${url}:`, error);
              throw error;
            });

        Promise.all([
          fetchJson(`/u/${username}.json`),
          fetchJson(`/user-badges/${username}.json`)
        ])
          .then(([userSummaryData, badgeData]) => {
            console.log('Fetched user data:', userSummaryData);
            console.log('Fetched badge data:', badgeData);

            if (!(userSummaryData?.user && badgeData?.user_badges)) return;

            const groups = userSummaryData.user.groups || [];
            const badgeNames = badgeData.user_badges
              .map(ub => badgeData.badges.find(b => b.id === ub.badge_id)?.name)
              .filter(Boolean);
            console.log('User groups:', groups);
            console.log('User badge names:', badgeNames);

            const userInfo = createUserInfo(groups, badgeNames);
            containerElement.prepend(userInfo);
            prepareAndRenderImages(groups, badgeData.user_badges, badgeData.badges, siteSettings, containerElement);
          })
          .catch(error => console.error('Error fetching user data:', error));
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
  const qualificationsToRender = []; // ✅ NEW: track qualification objects
  const is16CSMR = groups.some(g =>
    ["16CSMR", "16CSMR_IC", "16CSMR_2IC"].includes(g.name)
  );

  // Determine uniform (background) based on group membership
  if (groups.some(g => officerRanks.includes(g.name))) {
    backgroundImageUrl = backgroundImages.officer;
  } else if (groups.some(g => enlistedRanks.includes(g.name))) {
    backgroundImageUrl = backgroundImages.enlisted;
  }

  // Find highest rank
  const highestRank = ranks.find(r => groups.some(g => g.name === r.name));
  if (highestRank?.imageKey) {
    foregroundImageUrls.push(highestRank.imageKey);
  }

  // Add group & lanyard images
  groups.forEach(g => {
    const groupImage = groupToImageMap[g.name];
    if (groupImage) foregroundImageUrls.push(groupImage);

    const lanyardImage = lanyardToImageMap[g.name];
    if (lanyardImage) foregroundImageUrls.push(lanyardImage);
  });

  const leadershipQualificationsOrder = ["FTCC", "SCBC", "PSBC", "PCBC"];

  const highestLeadershipQualification = leadershipQualificationsOrder.findLast(q =>
    userBadges.some(ub => {
      const badge = badges.find(b => b.id === ub.badge_id);
      return badge && badge.name === q;
    })
  );

  const marksmanshipQualificationsOrder = ["1st Class Marksman","Sharpshooter","Sniper"];

  const highestMarksmanshipQualification = marksmanshipQualificationsOrder.findLast(q =>
    userBadges.some(ub => {
      const badge = badges.find(b => b.id === ub.badge_id);
      return badge && badge.name === q;
    })
  );

  // Process badges
  userBadges.forEach(ub => {
    const badge = badges.find(b => b.id === ub.badge_id);
    if (!badge) return;

    const badgeName = badge.name;

    // Skip marksmanship qualifications for 16CSMR
    if (is16CSMR && ["1st Class Marksman", "Sharpshooter", "Sniper"].includes(badgeName)) return;

    const qualification = qualifications.find(q => q.name === badgeName);
    const isLeadershipQualification = leadershipQualificationsOrder.includes(badgeName);
    const isMarksmanshipQualification = marksmanshipQualificationsOrder.includes(badgeName);

    // ✅ Skip lower leadership qualifications
    if (isLeadershipQualification && badgeName !== highestLeadershipQualification) return;

    // ✅ Skip lower marksmanship qualifications
    if (isMarksmanshipQualification && badgeName !== highestMarksmanshipQualification) return;

    // ✅ Handle qualifications (including CMT automatically)
    if (qualification?.imageKey && !qualification.restrictedRanks?.includes(highestRank?.name)) {
      // Special rule: Only show CMT if user is in 16CSMR
      if (badgeName === "CMT" && !is16CSMR) return;

      foregroundImageUrls.push(qualification.imageKey);
      qualificationsToRender.push(qualification);
    }

    // ✅ Handle awards
    const award = awards.find(a => a.name === badgeName);
    if (award?.imageKey) awardImageUrls.push(award.imageKey);
  });

  const validForegroundImageUrls = foregroundImageUrls.filter(Boolean);
  const validAwardImageUrls = awardImageUrls.filter(Boolean);

  if (backgroundImageUrl && validForegroundImageUrls.length > 0) {
    mergeImagesOnCanvas(
      container,
      backgroundImageUrl,
      validForegroundImageUrls,
      validAwardImageUrls,
      siteSettings,
      highestRank,
      qualificationsToRender,
      groups
    );
    registerLanyardTooltips(groups);
  }
}

function mergeImagesOnCanvas(
    container,
    backgroundImageUrl,
    foregroundImageUrls,
    awardImageUrls,
    siteSettings,
    highestRank,
    qualificationsToRender,
    groups
  ) {
  console.log('Starting mergeImagesOnCanvas...');
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {
    position: 'relative',
    zIndex: '0',
    pointerEvents: 'auto',
    display: 'block',
    margin: '0 auto'
  });
  const ctx = canvas.getContext('2d');

  const bgImage = new Image();
  const fgImages = foregroundImageUrls.map(url => new Image());
  const awardImages = awardImageUrls.map(url => {
    const img = new Image();
    img.alt = (awards.find(a => a.imageKey === url)?.name) || '';
    return img;
  });

  let imagesLoaded = 0;
  const totalImages = 1 + fgImages.length + awardImages.length;

  const checkAllLoaded = () => {
    if (imagesLoaded !== totalImages) return;

    // Set canvas dimensions
    canvas.width = bgImage.naturalWidth || 1;
    canvas.height = bgImage.naturalHeight || 1;
    ctx.imageSmoothingEnabled = true;

    // Draw background
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Draw foreground (rank, lanyard, qualifications, etc.)
    drawImages(ctx, fgImages, canvas);


    // Register tooltips for any group image
    groups.forEach((g) => {
      const data = groupTooltipMap[g.name];
      if (data && data.tooltipAreas) {
        data.tooltipAreas.forEach((area) => {
          registerTooltip(
            area.x,
            area.y,
            area.width,
            area.height,
            `<img src="${data.tooltipImage}"> ${data.tooltipText}`
          );
        });
      }
    });

    // Register tooltip for rank
    if (highestRank && fgImages.length && highestRank.tooltipAreas) {
      const rankImg = fgImages[0]; // assuming first image is rank
      const x = (canvas.width - rankImg.naturalWidth) / 2;
      const y = (canvas.height - rankImg.naturalHeight) / 2;

      const tooltipContent = `<img src="${highestRank.tooltipImage}"> ${highestRank.tooltipText}`;
      highestRank.tooltipAreas.forEach(area => {
        registerTooltip(x + area.x, y + area.y, area.width, area.height, tooltipContent);
      });
    }

    // ✅ Register tooltips for qualifications
    qualificationsToRender.forEach(q => {
      if (!q.tooltipAreas) return;

      q.tooltipAreas.forEach(area => {
        registerTooltip(
          area.x,
          area.y,
          area.width,
          area.height,
          `<img src="${q.tooltipImage}"> ${q.tooltipText}`
        );
      });
    });

    // ✅ Handle awards (draw separately, scale, and register tooltips)
    try {
      const awardsCanvas = document.createElement('canvas');
      awardsCanvas.width = canvas.width;
      awardsCanvas.height = canvas.height;
      const awardsCtx = awardsCanvas.getContext('2d');
      const awardTooltips = drawAwards(awardsCtx, awardImages, awardsCanvas);

      const scaleFactor = 0.29;
      const scaledAwardsCanvas = document.createElement('canvas');
      scaledAwardsCanvas.width = awardsCanvas.width * scaleFactor;
      scaledAwardsCanvas.height = awardsCanvas.height * scaleFactor;
      scaledAwardsCanvas.getContext('2d').drawImage(
        awardsCanvas,
        0,
        0,
        scaledAwardsCanvas.width,
        scaledAwardsCanvas.height
      );

      const { awardsX, awardsY } = (() => {
        const count = awardImages.length;
        if (count === 1) return { awardsX: 385, awardsY: 45 };
        if (count === 2) return { awardsX: 382, awardsY: 45 };
        if (count === 3) return { awardsX: 384, awardsY: 44 };
        return { awardsX: 380, awardsY: 46 };
      })();

      const rotationAngle = -3 * Math.PI / 180;
      const skewYValue = -3 * Math.PI / 180;
      ctx.save();
      ctx.translate(awardsX + scaledAwardsCanvas.width / 2, awardsY + scaledAwardsCanvas.height / 2);
      ctx.rotate(rotationAngle);
      ctx.transform(1, Math.tan(skewYValue), 0, 1, 0, 0);
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

      // ✅ Register award tooltips
      const tx = awardsX + scaledAwardsCanvas.width / 2;
      const ty = awardsY + scaledAwardsCanvas.height / 2;
      const offsetX = scaledAwardsCanvas.width / 2;
      const offsetY = scaledAwardsCanvas.height / 2;
      const ribbonTooltipRotationOffset = -3 * Math.PI / 180;

      awardTooltips.forEach(t => {
        const xScaled = t.x * scaleFactor;
        const yScaled = t.y * scaleFactor;
        const widthScaled = t.width * scaleFactor;
        const heightScaled = t.height * scaleFactor;
        const tanSkewY = Math.tan(skewYValue);

        const adjustedRotationAngle = rotationAngle + ribbonTooltipRotationOffset;
        const pointA = transformPoint(xScaled, yScaled, tx, ty, adjustedRotationAngle, tanSkewY, offsetX, offsetY);
        const pointB = transformPoint(xScaled + widthScaled, yScaled, tx, ty, adjustedRotationAngle, tanSkewY, offsetX, offsetY);
        const pointC = transformPoint(xScaled, yScaled + heightScaled, tx, ty, adjustedRotationAngle, tanSkewY, offsetX, offsetY);
        const pointD = transformPoint(xScaled + widthScaled, yScaled + heightScaled, tx, ty, adjustedRotationAngle, tanSkewY, offsetX, offsetY);

        const minX = Math.min(pointA.x, pointB.x, pointC.x, pointD.x);
        const minY = Math.min(pointA.y, pointB.y, pointC.y, pointD.y);
        const maxX = Math.max(pointA.x, pointB.x, pointC.x, pointD.x);
        const maxY = Math.max(pointA.y, pointB.y, pointC.y, pointD.y);

        registerTooltip(minX, minY, (maxX - minX) - 2, (maxY - minY) - 2, t.content);
      });
    } catch (e) {
      console.error('Error processing awards:', e);
    }

    // ✅ Append canvas
    container.prepend(canvas);
    setupTooltips(canvas);
  };

  // Attach load handlers
  const attachLoadHandler = (img, src) => {
    img.onload = () => {
      imagesLoaded++;
      checkAllLoaded();
    };
    img.onerror = () => console.error(`Error loading image:`, src);
    img.src = src;
  };

  attachLoadHandler(bgImage, backgroundImageUrl || '');
  fgImages.forEach((img, i) => attachLoadHandler(img, foregroundImageUrls[i] || ''));
  awardImages.forEach((img, i) => attachLoadHandler(img, awardImageUrls[i] || ''));
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

// New function to register lanyard tooltips
function registerLanyardTooltips(groups) {
  groups.forEach(group => {
    if (lanyardTooltipMap[group.name]) {
      const data = lanyardTooltipMap[group.name];
      const content = `<img src="${data.tooltipImage}"> ${data.tooltipText}`;
      registerTooltip(
        lanyardTooltipRegion.x,
        lanyardTooltipRegion.y,
        lanyardTooltipRegion.width,
        lanyardTooltipRegion.height,
        content
      );
      console.log(`Registered lanyard tooltip for group ${group.name}:`, content);
    }
  });
}