import { withPluginApi } from 'discourse/lib/plugin-api';
import {
  backgroundImages,
  ranks,
  officerRanks,
  enlistedRanks,
  lanyardToImageMap,
  groupToImageMap,
  qualifications,
  awards,
  lanyardTooltipRegion,
  lanyardTooltipMap,
  groupTooltipMap
} from 'discourse/plugins/project-uniform/discourse/uniform-data';

const DEBUG_MODE = false;

// Precompute award name -> seniority index once
const AWARD_INDEX = Object.fromEntries(awards.map((a, i) => [a.name, i]));

// Global storage for tooltip regions.
const tooltipRegions = [];

function debugLog(...args) {
  if (DEBUG_MODE) console.log(...args);
}

// Simple in-memory cache
const imageCache = new Map();

function loadImageCached(url) {
  return new Promise((resolve, reject) => {
    if (imageCache.has(url)) {
      return resolve(imageCache.get(url));
    }

    const img = new Image();
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

function normalizePath(url) {
  try { return new URL(url, window.location.origin).pathname; }
  catch { return url; }
}

// Registers a tooltip region with given coordinates and content.
function registerTooltip(x, y, width, height, content) {
  debugLog('Registering tooltip region:', { x, y, width, height, content });
  tooltipRegions.push({ x, y, width, height, content });
}

// Attaches a tooltip element to the canvas container and sets up mouse event handlers.
function setupTooltips(canvas) {
  const parent = canvas.parentElement;
  parent.style.position = "relative";

  // Remove any previous tooltip in this container
  const oldTip = parent.querySelector(".canvas-tooltip");
  if (oldTip) oldTip.remove();

  const ctx = canvas.getContext("2d");

  if (DEBUG_MODE) {
    tooltipRegions.forEach((region) => {
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;
      ctx.strokeRect(region.x, region.y, region.width, region.height);
      debugLog(`Drawing debug tooltip box at (${region.x}, ${region.y})`);
    });
  }

  const controller = new AbortController();
  const { signal } = controller;

  const tooltip = document.createElement("div");
  tooltip.className = "canvas-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.setAttribute("aria-hidden", "true");
  parent.appendChild(tooltip);

  let cachedCanvasRect = null;
  let cachedParentRect = null;
  let activeTooltip = null;

  const recomputeRects = () => {
    cachedCanvasRect = canvas.getBoundingClientRect();
    cachedParentRect = parent.getBoundingClientRect();
  };

  recomputeRects();
  window.addEventListener("scroll", recomputeRects, { passive: true, signal });
  window.addEventListener("resize", recomputeRects, { signal });

  const onMove = (event) => {
    if (!cachedCanvasRect || !cachedParentRect) return;

    const localX = event.clientX - cachedCanvasRect.left;
    const localY = event.clientY - cachedCanvasRect.top;

    let hit = null;
    for (const region of tooltipRegions) {
      if (
        localX >= region.x && localX <= region.x + region.width &&
        localY >= region.y && localY <= region.y + region.height
      ) {
        hit = region;
        break;
      }
    }

    if (!hit) {
      activeTooltip = null;
      tooltip.classList.remove("visible");
      tooltip.setAttribute("aria-hidden", "true");
      return;
    }

    if (activeTooltip !== hit.content) {
      activeTooltip = hit.content;
      tooltip.innerHTML = hit.content;
      tooltip.classList.toggle("has-img", hit.content.includes("<img"));
      tooltip.style.left = "0px";
      tooltip.style.top = "0px";
    }

    const offsetX = cachedCanvasRect.left - cachedParentRect.left;
    const offsetY = cachedCanvasRect.top - cachedParentRect.top;
    const offsetAdjustX = 0;
    const offsetAdjustY = 25;

    tooltip.style.left = `${offsetX + hit.x + hit.width / 2 + offsetAdjustX}px`;
    tooltip.style.top  = `${offsetY + hit.y + hit.height / 2 + offsetAdjustY}px`;

    tooltip.classList.add("visible");
    tooltip.setAttribute("aria-hidden", "false");
  };

  const onOut = () => {
    activeTooltip = null;
    tooltip.classList.remove("visible");
    tooltip.setAttribute("aria-hidden", "true");
  };

  canvas.addEventListener("mousemove", onMove, { signal });
  canvas.addEventListener("mouseout", onOut, { signal });

  // Teardown: abort listeners and remove tooltip
  canvas._teardownTooltips = () => {
    controller.abort();
    tooltip.remove();
  };
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
            debugLog('Project Uniform: Admin-only mode enabled. Hiding uniform for non-admins.');
            return;
          }
        }

        const username = url.split('/u/')[1].split('/')[0];
        debugLog('Extracted username:', username);

        const fetchJson = (url) =>
          fetch(url)
            .then(response => {
              if (!response.ok) throw new Error(response.statusText);
              return response.json();
            })
            .catch(error => {
              if (DEBUG_MODE) console.error(`Error fetching ${url}:`, error);
              throw error;
            });

        Promise.all([
          fetchJson(`/u/${username}.json`),
          fetchJson(`/user-badges/${username}.json`)
        ])
          .then(([userSummaryData, badgeData]) => {
            debugLog('Fetched user data:', userSummaryData);
            debugLog('Fetched badge data:', badgeData);

            if (!(userSummaryData?.user && badgeData?.user_badges)) return;

            const groups = userSummaryData.user.groups || [];

            // Build badge_id -> badge object once
            const idToBadge = new Map((badgeData.badges || []).map(b => [b.id, b]));

            // Resolve names once for the small info panel
            const userBadges = badgeData.user_badges || [];
            const badgeNames = userBadges
              .map(ub => idToBadge.get(ub.badge_id)?.name)
              .filter(Boolean);

            debugLog('User groups:', groups);
            debugLog('User badge names:', badgeNames);

            const userInfo = createUserInfo(groups, badgeNames);
            containerElement.prepend(userInfo);

            // Pass the map instead of the raw array
            prepareAndRenderImages(groups, userBadges, idToBadge, containerElement);
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
  debugLog('Created user info element.');
  return userInfo;
}

function highestIn(orderArray, hasSet) {
  for (let i = orderArray.length - 1; i >= 0; i--) {
    if (hasSet.has(orderArray[i])) return orderArray[i];
  }
  return undefined;
}

function prepareAndRenderImages(groups, userBadges, idToBadge, container) {
  tooltipRegions.length = 0;
  let backgroundImageUrl = '';
  const foregroundImageUrls = [];
  const awardImageUrls = [];
  const qualificationsToRender = []; // ✅ NEW: track qualification objects
  const is16CSMR = groups.some(g =>
    ["16CSMR", "16CSMR_IC", "16CSMR_2IC"].includes(g.name)
  );

  const badgeNameSet = new Set(
    userBadges.map(ub => idToBadge.get(ub.badge_id)?.name).filter(Boolean)
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
  const highestLeadershipQualification = highestIn(leadershipQualificationsOrder, badgeNameSet);

  const marksmanshipQualificationsOrder = ["1st Class Marksman","Sharpshooter","Sniper"];
  const highestMarksmanshipQualification = highestIn(marksmanshipQualificationsOrder, badgeNameSet);

  // Process badges
  userBadges.forEach(ub => {
    const badge = idToBadge.get(ub.badge_id);
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
    highestRank,
    qualificationsToRender,
    groups
) {
  debugLog('Starting mergeImagesOnCanvas...');

  // Remove any old canvas
  const old = container.querySelector('.project-uniform-canvas');
  if (old) {
    old._teardownTooltips?.();
    old.remove();
  }

  // Create new canvas
  const canvas = document.createElement('canvas');
  canvas.className = 'project-uniform-canvas';
  Object.assign(canvas.style, {
    position: 'relative',
    zIndex: '0',
    pointerEvents: 'auto',
    display: 'block',
    margin: '0 auto'
  });
  const ctx = canvas.getContext('2d');

  // Load all required images from cache or network
  Promise.all([
    loadImageCached(backgroundImageUrl || ''),
    ...foregroundImageUrls.map(url => loadImageCached(url || '')),
    ...awardImageUrls.map(url => loadImageCached(url || ''))
  ])
    .then(([bgImage, ...rest]) => {
      const fgImages = rest.slice(0, foregroundImageUrls.length);
      const awImages = rest.slice(foregroundImageUrls.length);

      // Set alt text on award images (needed for AWARD_INDEX sorting)
      awImages.forEach(img => {
        if (!img) return;

        const imgPath = normalizePath(img.src);
        const match = awards.find(a => normalizePath(a.imageKey) === imgPath);

        img.alt = match?.name || '';
      });

      drawEverything(ctx, canvas, container, bgImage, fgImages, awImages,
        highestRank, qualificationsToRender, groups);
    })
    .catch(err => {
      console.error("Error loading images:", err);
    });
}

// This contains all the draw + tooltip logic that used to be in checkAllLoaded()
function drawEverything(ctx, canvas, container, bgImage, fgImages, awardImages,
  highestRank, qualificationsToRender, groups) {

  // Set canvas size from background
  canvas.width = bgImage?.naturalWidth || 1;
  canvas.height = bgImage?.naturalHeight || 1;
  ctx.imageSmoothingEnabled = true;

  // Draw background
  if (bgImage) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  // Draw foreground images (rank, lanyards, quals)
  drawImages(ctx, fgImages.filter(Boolean), canvas);

  // Register tooltips for groups
  groups.forEach((g) => {
    const data = groupTooltipMap[g.name];
    if (data?.tooltipAreas) {
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

  // Rank tooltips
  if (highestRank && fgImages.length && highestRank.tooltipAreas) {
    const rankImg = fgImages[0];
    const x = (canvas.width - rankImg.naturalWidth) / 2;
    const y = (canvas.height - rankImg.naturalHeight) / 2;
    const tooltipContent = `<img src="${highestRank.tooltipImage}"> ${highestRank.tooltipText}`;
    highestRank.tooltipAreas.forEach(area => {
      registerTooltip(x + area.x, y + area.y, area.width, area.height, tooltipContent);
    });
  }

  // Qualifications tooltips
  qualificationsToRender.forEach(q => {
    if (q.tooltipAreas) {
      q.tooltipAreas.forEach(area => {
        registerTooltip(
          area.x,
          area.y,
          area.width,
          area.height,
          `<img src="${q.tooltipImage}"> ${q.tooltipText}`
        );
      });
    }
  });

  // Awards drawing + tooltips
  try {
    const awardsCanvas = document.createElement('canvas');
    awardsCanvas.width = canvas.width;
    awardsCanvas.height = canvas.height;
    const awardsCtx = awardsCanvas.getContext('2d');

    const awardTooltips = drawAwards(awardsCtx, awardImages.filter(Boolean), awardsCanvas);

    // Scale and transform awards block
    const scaleFactor = 0.29;
    const scaledAwardsCanvas = document.createElement('canvas');
    scaledAwardsCanvas.width = awardsCanvas.width * scaleFactor;
    scaledAwardsCanvas.height = awardsCanvas.height * scaleFactor;
    scaledAwardsCanvas.getContext('2d').drawImage(
      awardsCanvas,
      0, 0,
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

    // Award tooltips after transform
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

  container.prepend(canvas);
  setupTooltips(canvas);
}

function drawImages(ctx, images, canvas) {
  images.forEach((image, idx) => {
    if (image.naturalWidth && image.naturalHeight) {
      const x = (canvas.width - image.naturalWidth) / 2;
      const y = (canvas.height - image.naturalHeight) / 2;
      ctx.drawImage(image, x, y, image.naturalWidth, image.naturalHeight);
      debugLog(`Drew foreground image ${idx} at (${x}, ${y}) with dimensions (${image.naturalWidth}x${image.naturalHeight}).`);
    } else {
      console.warn(`Foreground image ${idx} missing dimensions.`);
    }
  });
}

function drawAwards(ctx, awardImages, canvas) {
  const sortedAwardImages = [...awardImages]
    .sort((a, b) => (AWARD_INDEX[a.alt] ?? Infinity) - (AWARD_INDEX[b.alt] ?? Infinity))
    .reverse();

  const maxAwardsToDisplay = 22;
  const finalAwardImages = sortedAwardImages.slice(-maxAwardsToDisplay);

  const maxAwardsPerRowArray = [4, 4, 4, 4, 3, 2, 1];
  let rowAwardCounts = Array(maxAwardsPerRowArray.length).fill(0);
  let rowAssignments = [];
  let currentRow = 0;

  finalAwardImages.forEach((_, index) => {
    while (rowAwardCounts[currentRow] >= maxAwardsPerRowArray[currentRow]) currentRow++;
    rowAssignments.push(currentRow);
    rowAwardCounts[currentRow]++;
  });

  const tooltipData = [];

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

    ctx.drawImage(awardImage, awardX, awardY, awardImage.naturalWidth, awardImage.naturalHeight);
    debugLog(`Drew ribbon ${index} at (${awardX}, ${awardY})`);

    const srcPath = normalizePath(awardImage.src);
    const awardData =
      awards.find(a => normalizePath(a.imageKey) === srcPath || a.name === awardImage.alt) || {};

    const content = `<img src="${awardData.tooltipImage || awardData.imageKey}"> ${awardData.tooltipText || awardData.name}`;
    tooltipData.push({ x: awardX, y: awardY, width: awardImage.naturalWidth, height: awardImage.naturalHeight, content });
  });

  return tooltipData;
}

// Register lanyard tooltips
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
      debugLog(`Registered lanyard tooltip for group ${group.name}:`, content);
    }
  });
}