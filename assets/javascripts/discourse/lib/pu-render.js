// pu-render.js

// Import utilities for image loading, path handling, transforms, and debug logging
import { loadImageCached, normalizePath, transformPoint, debugLog } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-utils";
// Import tooltip setup and registration helpers
import { setupTooltips, registerTooltip } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-tooltips";
// Import award data for mapping and metadata
import { awards } from "discourse/plugins/discourse-project-uniform/discourse/uniform-data";

// Create an index mapping award names to their order position
const AWARD_INDEX = Object.fromEntries(awards.map((a, i) => [a.name, i]));

// Main function to build the uniform canvas with layers, awards, and tooltips
export function mergeImagesOnCanvas(container, backgroundImageUrl, foregroundImageUrls, awardImageUrls, highestRank, qualificationsToRender, groups, groupTooltipMap) {
    debugLog("[PU:render] mergeImagesOnCanvas", { backgroundImageUrl, fgCount: foregroundImageUrls.length, awardCount: awardImageUrls.length, highestRank: highestRank?.name });

    // Remove old canvas if it exists
    const old = container.querySelector(".project-uniform-canvas");
    if (old) {
        old._teardownTooltips?.();
        old.remove();
        debugLog("[PU:render] Removed previous canvas instance");
    }

    // Create new canvas
    const canvas = document.createElement("canvas");
    canvas.className = "project-uniform-canvas";
    Object.assign(canvas.style, { position: "relative", zIndex: "0", pointerEvents: "auto", display: "block", margin: "0 auto" });
    const ctx = canvas.getContext("2d");

    // Load all images (background, foreground, awards) in parallel
    Promise.all([
        loadImageCached(backgroundImageUrl || ""),
        ...foregroundImageUrls.map(u => loadImageCached(u || "")),
        ...awardImageUrls.map(u => loadImageCached(u || "")),
    ])
        .then(([bg, ...rest]) => {
            debugLog("[PU:render] Images loaded for render");
            const fg = rest.slice(0, foregroundImageUrls.length);
            const aw = rest.slice(foregroundImageUrls.length);

            // Add alt text to award images using award metadata
            aw.forEach(img => {
                if (!img) return;
                const imgPath = normalizePath(img.src);
                const match = awards.find(a => normalizePath(a.imageKey) === imgPath);
                img.alt = match?.name || "";
            });

            // Draw all elements onto canvas
            drawEverything(ctx, canvas, container, bg, fg, aw, highestRank, qualificationsToRender, groups, groupTooltipMap);
        })
        .catch(e => debugLog("[PU:render] Error loading images:", e));
}

// Draws the entire uniform with all layers and tooltips
function drawEverything(ctx, canvas, container, bgImage, fgImages, awardImages, highestRank, qualificationsToRender, groups, groupTooltipMap) {
    // Set canvas size to background image size
    canvas.width = bgImage?.naturalWidth || 1;
    canvas.height = bgImage?.naturalHeight || 1;
    debugLog("[PU:render] Canvas size:", { w: canvas.width, h: canvas.height });
    ctx.imageSmoothingEnabled = true;

    // Draw background with shadow
    if (bgImage) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 10; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1;
        ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    // Draw all foreground layers
    drawImages(ctx, fgImages.filter(Boolean), canvas);

    // Register tooltips for groups
    let groupTipCount = 0;
    const groupTooltipMapLC = new Map(Object.entries(groupTooltipMap || {}).map(([k, v]) => [k.toLowerCase(), v]));
    groups.forEach(g => {
        const data = groupTooltipMapLC.get(String(g.name || "").toLowerCase());
        if (data?.tooltipAreas) {
            data.tooltipAreas.forEach(a => {
                registerTooltip(a.x, a.y, a.width, a.height, `<img src="${data.tooltipImage}"> ${data.tooltipText}`);
                groupTipCount++;
            });
        }
    });
    debugLog("[PU:render] Group tooltips registered:", groupTipCount);

    // Register tooltips for rank (first foreground image assumed to be rank)
    if (highestRank && fgImages.length && highestRank.tooltipAreas) {
        const rankImg = fgImages[0];
        const x = (canvas.width - rankImg.naturalWidth) / 2;
        const y = (canvas.height - rankImg.naturalHeight) / 2;
        const tip = `<img src="${highestRank.tooltipImage}"> ${highestRank.tooltipText}`;
        highestRank.tooltipAreas.forEach(a => registerTooltip(x + a.x, y + a.y, a.width, a.height, tip));
        debugLog("[PU:render] Rank tooltips registered:", highestRank.tooltipAreas.length);
    }

    // Register tooltips for qualifications
    let qualTipCount = 0;
    qualificationsToRender.forEach(q => {
        q.tooltipAreas?.forEach(a => {
            registerTooltip(a.x, a.y, a.width, a.height, `<img src="${q.tooltipImage}"> ${q.tooltipText}`);
            qualTipCount++;
        });
    });
    debugLog("[PU:render] Qualification tooltips registered:", qualTipCount);

    // Process and draw awards (ribbons) with tooltips
    try {
        const awardsCanvas = document.createElement("canvas");
        awardsCanvas.width = canvas.width; awardsCanvas.height = canvas.height;
        const aCtx = awardsCanvas.getContext("2d");
        const tooltipRects = drawAwards(aCtx, awardImages.filter(Boolean), awardsCanvas, AWARD_INDEX);

        // Scale ribbons before placing on uniform
        const scale = 0.29;
        const scaled = document.createElement("canvas");
        scaled.width = awardsCanvas.width * scale;
        scaled.height = awardsCanvas.height * scale;
        scaled.getContext("2d").drawImage(awardsCanvas, 0, 0, scaled.width, scaled.height);

        // Set ribbon position based on count
        const count = awardImages.length;
        debugLog("[PU:render] Awards placed (count):", count);
        const { awardsX, awardsY } = (count === 1) ? { awardsX: 385, awardsY: 45 } : (count === 2) ? { awardsX: 382, awardsY: 45 } : (count === 3) ? { awardsX: 384, awardsY: 44 } : { awardsX: 380, awardsY: 46 };

        // Apply rotation and skew for realism
        const rot = -3 * Math.PI / 180, skewY = -3 * Math.PI / 180;
        ctx.save();
        ctx.translate(awardsX + scaled.width / 2, awardsY + scaled.height / 2);
        ctx.rotate(rot);
        ctx.transform(1, Math.tan(skewY), 0, 1, 0, 0);
        ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 2; ctx.shadowOffsetX = -0.5; ctx.shadowOffsetY = 0;
        ctx.drawImage(scaled, -scaled.width / 2, -scaled.height / 2, scaled.width, scaled.height);
        ctx.restore();

        // Map tooltip rectangles after transformations
        const tx = awardsX + scaled.width / 2, ty = awardsY + scaled.height / 2;
        const offsetX = scaled.width / 2, offsetY = scaled.height / 2;
        const ribbonTooltipRotationOffset = -3 * Math.PI / 180;
        const tanSkewY = Math.tan(skewY);

        tooltipRects.forEach(t => {
            const xs = t.x * scale, ys = t.y * scale, ws = t.width * scale, hs = t.height * scale;
            const ang = rot + ribbonTooltipRotationOffset;
            const A = transformPoint(xs, ys, tx, ty, ang, tanSkewY, offsetX, offsetY);
            const B = transformPoint(xs + ws, ys, tx, ty, ang, tanSkewY, offsetX, offsetY);
            const C = transformPoint(xs, ys + hs, tx, ty, ang, tanSkewY, offsetX, offsetY);
            const D = transformPoint(xs + ws, ys + hs, tx, ty, ang, tanSkewY, offsetX, offsetY);
            const minX = Math.min(A.x, B.x, C.x, D.x), maxX = Math.max(A.x, B.x, C.x, D.x);
            const minY = Math.min(A.y, B.y, C.y, D.y), maxY = Math.max(A.y, B.y, C.y, D.y);
            registerTooltip(minX, minY, (maxX - minX) - 2, (maxY - minY) - 2, t.content);
        });
        debugLog("[PU:render] Award tooltip rects registered:", tooltipRects.length);
    } catch (e) {
        debugLog("[PU:render] Error processing awards:", e);
    }

    // Add the finished canvas to container and activate tooltips
    container.prepend(canvas);
    setupTooltips(canvas);
    debugLog("[PU:render] Canvas appended and tooltips set up");
}

// Draws all foreground images centered on the canvas
function drawImages(ctx, images, canvas) {
    images.forEach((img, i) => {
        if (img?.naturalWidth && img?.naturalHeight) {
            const x = (canvas.width - img.naturalWidth) / 2;
            const y = (canvas.height - img.naturalHeight) / 2;
            ctx.drawImage(img, x, y, img.naturalWidth, img.naturalHeight);
            debugLog(`[PU:render] Drew foreground image ${i} at (${x}, ${y}) size ${img.naturalWidth}x${img.naturalHeight}`);
        } else {
            debugLog(`[PU:render] Foreground image ${i} missing dimensions`, img);
        }
    });
}

// Draws awards in correct order/rows and returns tooltip rectangles
function drawAwards(ctx, awardImages, canvas, AWARD_INDEX) {
    // Sort awards by priority index, keep only the last 22 for display
    // const sorted = [...awardImages].sort((a, b) => (AWARD_INDEX[a.alt] ?? Infinity) - (AWARD_INDEX[b.alt] ?? Infinity)).reverse();
    // const final = sorted.slice(-22);

    // Sort by priority and keep only the highest 8 (two rows of four)
    // Lower index in AWARD_INDEX = higher priority
    const sorted = [...awardImages]
        .sort((a, b) => (AWARD_INDEX[a.alt] ?? Infinity) - (AWARD_INDEX[b.alt] ?? Infinity))
        .slice(0, 8)
        .reverse();
    const final = sorted;

    // Max per row layout definition
    // const perRow = [4, 4, 4, 4, 3, 2, 1]; - Old ribbon layout, before the 8 ribbon cap
    const perRow = [4, 4];
    const rowCounts = Array(perRow.length).fill(0);
    const rows = []; let r = 0;

    // Assign each award to a row
    final.forEach((_img, i) => { while (rowCounts[r] >= perRow[r]) r++; rows.push(r); rowCounts[r]++; });

    debugLog("[PU:render] Awards layout:", { total: awardImages.length, considered: final.length, rowCounts });

    const tips = [];
    final.forEach((img, i) => {
        if (!img?.naturalWidth || !img?.naturalHeight) return;
        const row = rows[i], inRow = rowCounts[row];
        let col = i - rows.findIndex(x => x === row);

        // Calculate starting X based on row layout rules
        let startX;
        if (row <= 3) {
            startX = (canvas.width - (inRow * (img.naturalWidth + 1))) / 2;
        } else if (row === 4) {
            startX = inRow === 1
                ? (canvas.width - img.naturalWidth) / 2
                : canvas.width - (perRow[row] * (img.naturalWidth + 1)) - 146;
        } else if (row === 5) {
            startX = canvas.width - (perRow[row] * (img.naturalWidth + 1)) - 150;
        } else { // row 6
            startX = canvas.width - img.naturalWidth - 155;
        }

        // Draw award at calculated position
        const x = startX + ((inRow - 1 - col) * img.naturalWidth);
        const y = canvas.height - ((row + 1) * img.naturalHeight);
        ctx.drawImage(img, x, y, img.naturalWidth, img.naturalHeight);

        // Build tooltip content for award
        const srcPath = normalizePath(img.src);
        const meta = awards.find(a => normalizePath(a.imageKey) === srcPath || a.name === img.alt) || {};
        const content = `<img src="${meta.tooltipImage || meta.imageKey}"> ${meta.tooltipText || meta.name}`;
        tips.push({ x, y, width: img.naturalWidth, height: img.naturalHeight, content });
    });
    return tips; // return all award tooltip areas
}
