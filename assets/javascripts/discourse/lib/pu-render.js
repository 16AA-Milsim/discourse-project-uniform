/**
 * Canvas composition helpers for Project Uniform. Loads background and overlay imagery,
 * draws them onto a shared canvas, and wires up tooltip regions for interactive layers.
 */
import { loadImageCached, normalizePath, debugLog } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-utils";
import { setupTooltips, registerTooltip } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-tooltips";
import { awards } from "discourse/plugins/discourse-project-uniform/discourse/uniform-data";

// Index award names to preserve metadata ordering inside the awards layout
const AWARD_INDEX = Object.fromEntries(awards.map((a, i) => [a.name, i]));

// Tracks the most recent render so we can ignore stale async completions
let renderTicket = 0;

// Visual tweaks for medal ribbons
const RIBBON_HEIGHT_SCALE = 1.1; // stretch vertically without changing width
const RIBBON_ROW_GAP = 3;        // intrinsic px gap between stacked rows
const TOP_ROW_EXTRA_HEIGHT = 1;  // lift the top row upward without touching spacing below
const RIBBON_ROTATION = -1 * Math.PI / 180;  // subtle overall CCW tilt layered on skew
const RIBBON_TAPER = 0;                      // taper disabled (minimal distance change)
const RIBBON_CURVE_DEPTH = 4;                // downward bulge in px (scaled space)
const RIBBON_SKEW_STRENGTH = -0.08;          // horizontal skew (negative lifts right side upward)
const RIBBON_SLICE_COUNT = 48;               // controls smoothness of taper/curve sampling
const RIBBON_OFFSET_X = 3;                   // fine-tune final placement horizontally
const RIBBON_OFFSET_Y = 5;                   // fine-tune final placement vertically
const SINGLE_THIRD_ROW_OFFSET_X = 2;         // nudge lone third-row ribbon to align with perspective
const RIBBON_SCALE = 0.29;                  // uniform scaling factor before perspective warp

const CSA_RIBBON_MAX = 3;
const CSA_RIBBON_ROTATION = 1 * Math.PI / 180;   // mirrored (CW) rotation for CSA ribbons
const CSA_RIBBON_SKEW_STRENGTH = 0.08;           // mirrored horizontal skew (positive lifts left side)
const CSA_RIBBON_OFFSET_X = -150;                // fine-tune CSA placement horizontally (mirrored)
const CSA_RIBBON_OFFSET_Y = 182;                 // fine-tune CSA placement vertically
const CSA_RIBBON_SCALE = RIBBON_SCALE * 1.4;     // CSA ribbons render slightly larger than awards
const CSA_RIBBON_CURVE_DEPTH = 2;               // shallower curve than medals for a flatter appearance
const CSA_SHADOW_OFFSET_X = 0.5;                 // subtler mirror shadow for CSA ribbons
const CSA_SHADOW_BLUR = 1.1;                     // softer drop shadow for thinner CSA ribbons
const CSA_SHADOW_COLOR = 'rgba(0,0,0,0.24)';     // lighter drop shadow tone for CSA ribbons
const CSA_RIBBON_DRAW_ALPHA = 0.80;              // transparency when placing CSA ribbons on uniform
const CSA_RIBBON_BRIGHTEN_ALPHA = 0.0;          // additional brighten overlay applied to CSA ribbons

const AWARD_PLACEMENTS = {
    1: { x: 385, y: 45 },
    2: { x: 382, y: 45 },
    3: { x: 384, y: 44 },
    default: { x: 380, y: 46 },
};

function getAwardPlacement(count) {
    return AWARD_PLACEMENTS[count] || AWARD_PLACEMENTS.default;
}

/**
 * Builds the Project Uniform canvas inside `container`, loading every layer in parallel
 * before delegating to the drawing pipeline.
 */
export function mergeImagesOnCanvas(container, backgroundImageUrl, foregroundItems, awardImageUrls, highestRank, qualificationsToRender, groups, groupTooltipMap, csaRibbonEntries = []) {
    const renderId = ++renderTicket;
    if (container) {
        container._puRenderId = renderId;
    }

    const fgUrls = (foregroundItems || []).map(it => (typeof it === "string" ? it : it?.url));
    const csaImageUrls = (csaRibbonEntries || []).map(entry => entry?.imageKey).filter(Boolean);
    debugLog("[PU:render] mergeImagesOnCanvas", {
        backgroundImageUrl,
        fgCount: fgUrls.length,
        awardCount: awardImageUrls.length,
        csaCount: csaImageUrls.length,
        highestRank: highestRank?.name
    });

    // Remove old canvas if it exists
    const old = container.querySelector(".discourse-project-uniform-canvas");
    if (old) {
        old._teardownTooltips?.();
        old.remove();
        debugLog("[PU:render] Removed previous canvas instance");
    }

    // Create fresh canvas surface
    const canvas = document.createElement("canvas");
    canvas.className = "discourse-project-uniform-canvas";
    Object.assign(canvas.style, { position: "relative", zIndex: "0", pointerEvents: "auto", display: "block", margin: "0 auto" });
    const ctx = canvas.getContext("2d");

    // Load all images (background, foreground, awards) in parallel
    Promise.all([
        loadImageCached(backgroundImageUrl || ""),
        ...fgUrls.map(u => loadImageCached(u || "")),
        ...awardImageUrls.map(u => loadImageCached(u || "")),
        ...csaImageUrls.map(u => loadImageCached(u || "")),
    ])
        .then(([bg, ...rest]) => {
            if (!container || container._puRenderId !== renderId) {
                debugLog("[PU:render] Stale render resolved – skipping append", { renderId });
                return;
            }
            debugLog("[PU:render] Images loaded for render");
            const fg = rest.slice(0, fgUrls.length);
            const aw = rest.slice(fgUrls.length, fgUrls.length + awardImageUrls.length);
            const csaImages = rest.slice(fgUrls.length + awardImageUrls.length);

            // Add alt text to award images using award metadata
            aw.forEach(img => {
                if (!img) return;
                const imgPath = normalizePath(img.src);
                const match = awards.find(a => normalizePath(a.imageKey) === imgPath);
                img.alt = match?.name || "";
            });

            csaImages.forEach((img, index) => {
                if (!img) return;
                const entry = csaRibbonEntries[index];
                if (!entry) return;
                img.alt = entry.name;
            });

            drawEverything(
                ctx,
                canvas,
                container,
                bg,
                fg,
                aw,
                highestRank,
                qualificationsToRender,
                groups,
                groupTooltipMap,
                foregroundItems,
                csaImages,
                csaRibbonEntries
            );
        })
        .catch(e => debugLog("[PU:render] Error loading images:", e));
}

/**
 * Coordinates drawing the background, foreground overlays, ribbons, and tooltip regions.
 */
function drawEverything(ctx, canvas, container, bgImage, fgImages, awardImages, highestRank, qualificationsToRender, groups, groupTooltipMap, foregroundItems = [], csaImages = [], csaRibbonEntries = []) {
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

    // Draw all foreground layers (centered by default; absolute if {x,y} provided)
    drawImages(ctx, fgImages, canvas, foregroundItems);

    // Register tooltips for groups
    let groupTipCount = 0;
    const resolveGroupTooltip = (name) => {
        if (!groupTooltipMap) {
            return null;
        }
        const key = String(name || "");
        const keyLC = key.toLowerCase();
        if (typeof groupTooltipMap.get === "function") {
            return groupTooltipMap.get(keyLC) || groupTooltipMap.get(key) || null;
        }
        return groupTooltipMap[keyLC] || groupTooltipMap[key] || null;
    };
    groups.forEach(g => {
        const data = resolveGroupTooltip(g.name);
        if (data?.tooltipAreas) {
            data.tooltipAreas.forEach(a => {
                registerTooltip(a.x, a.y, a.width, a.height, `<img src="${data.tooltipImage}"> ${data.tooltipText}`);
                groupTipCount++;
            });
        }
    });
    debugLog("[PU:render] Group tooltips registered:", groupTipCount);

    // Register tooltips for rank. If there is no rank image (e.g., Private/Gunner),
    // fall back to absolute coordinates.
    if (highestRank && highestRank.tooltipAreas) {
        const rankImg = fgImages.length ? fgImages[0] : null;
        const x = rankImg?.naturalWidth ? (canvas.width - rankImg.naturalWidth) / 2 : 0;
        const y = rankImg?.naturalHeight ? (canvas.height - rankImg.naturalHeight) / 2 : 0;
        const tip =
            (highestRank.tooltipImage ? `<img src="${highestRank.tooltipImage}"> ` : "") +
            (highestRank.tooltipText || "");
        highestRank.tooltipAreas.forEach(a =>
            registerTooltip(x + a.x, y + a.y, a.width, a.height, tip)
        );
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
        const hasSeniorPilot = qualificationsToRender.some(q => q?.name === "Senior Pilot");
        const tooltipRects = drawAwards(
            aCtx,
            awardImages.filter(Boolean),
            awardsCanvas,
            AWARD_INDEX,
            hasSeniorPilot
        );

        // Scale ribbons before placing on uniform
        const scale = RIBBON_SCALE;
        const scaled = document.createElement("canvas");
        scaled.width = awardsCanvas.width * scale;
        scaled.height = awardsCanvas.height * scale;
        scaled.getContext("2d").drawImage(awardsCanvas, 0, 0, scaled.width, scaled.height);

        // Set ribbon position based on count
        const count = awardImages.length;
        debugLog("[PU:render] Awards placed (count):", count);
        const { x: awardsX, y: awardsY } = getAwardPlacement(count);

        const perspective = buildRibbonPerspectiveCanvas(scaled);
        const perspectiveCanvas = perspective.canvas;
        const destWidth = perspectiveCanvas.width;
        const destHeight = perspectiveCanvas.height;

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 2.0; // slightly softer shadow without bleeding onto lower row
        ctx.shadowOffsetX = -0.75;
        ctx.shadowOffsetY = 0;
        const skewTan = Math.tan(RIBBON_SKEW_STRENGTH);
        ctx.translate(awardsX + RIBBON_OFFSET_X, awardsY + RIBBON_OFFSET_Y);
        ctx.transform(1, skewTan, 0, 1, 0, 0);
        ctx.translate(destWidth / 2, destHeight / 2);
        ctx.rotate(RIBBON_ROTATION);
        ctx.drawImage(perspectiveCanvas, -destWidth / 2, -destHeight / 2);
        ctx.restore();

        const cos = Math.cos(RIBBON_ROTATION);
        const sin = Math.sin(RIBBON_ROTATION);

        // Map tooltip rectangles through the perspective + skew + rotation transform
        tooltipRects.forEach(t => {
            const corners = [
                { x: t.x, y: t.y },
                { x: t.x + t.width, y: t.y },
                { x: t.x, y: t.y + t.height },
                { x: t.x + t.width, y: t.y + t.height },
            ].map(pt => {
                const sx = pt.x * scale;
                const sy = pt.y * scale;
                const mapped = perspective.mapPoint(sx, sy);
                const localX = mapped.x - destWidth / 2;
                const localY = mapped.y - destHeight / 2;
                const rotX = localX * cos - localY * sin;
                const rotY = localX * sin + localY * cos;
                const afterRotX = rotX + destWidth / 2;
                const afterRotY = rotY + destHeight / 2;
                const skewY = afterRotY + afterRotX * skewTan;
                return {
                    x: awardsX + RIBBON_OFFSET_X + afterRotX,
                    y: awardsY + RIBBON_OFFSET_Y + skewY,
                };
            });

            const minX = Math.min(...corners.map(c => c.x));
            const maxX = Math.max(...corners.map(c => c.x));
            const minY = Math.min(...corners.map(c => c.y));
            const maxY = Math.max(...corners.map(c => c.y));
            const padding = 1;
            const width = Math.max(0, maxX - minX - padding * 2);
            const height = Math.max(0, maxY - minY - padding * 2);
            registerTooltip(minX + padding, minY + padding, width, height, t.content);
        });
        debugLog("[PU:render] Award tooltip rects registered:", tooltipRects.length);
    } catch (e) {
        debugLog("[PU:render] Error processing awards:", e);
    }

    if (csaImages.length && csaRibbonEntries.length) {
        try {
            const csaCanvas = document.createElement("canvas");
            const csaCtx = csaCanvas.getContext("2d");
            const csaPairs = csaImages
                .map((img, index) => ({ img, entry: csaRibbonEntries[index] }))
                .filter(pair => pair.img && pair.entry);
            const tooltipRects = drawCsaRibbonRow(
                csaCtx,
                csaPairs.map(pair => pair.img),
                csaCanvas,
                csaPairs.map(pair => pair.entry)
            );
            const csaCount = csaPairs.length;
            if (tooltipRects.length && csaCount) {
                const scale = CSA_RIBBON_SCALE;
                const scaled = document.createElement("canvas");
                scaled.width = Math.max(1, Math.round(csaCanvas.width * scale));
                scaled.height = Math.max(1, Math.round(csaCanvas.height * scale));
                scaled.getContext("2d").drawImage(csaCanvas, 0, 0, scaled.width, scaled.height);

                const perspective = buildRibbonPerspectiveCanvas(scaled, { curveDepth: CSA_RIBBON_CURVE_DEPTH });
                const perspectiveCanvas = perspective.canvas;
                const destWidth = perspectiveCanvas.width;
                const destHeight = perspectiveCanvas.height;

                const placement = getAwardPlacement(Math.min(CSA_RIBBON_MAX, csaCount));
                const baseAnchorX = placement.x + RIBBON_OFFSET_X;
                const mirroredAnchorX = canvas.width - baseAnchorX;
                const anchorX = mirroredAnchorX + CSA_RIBBON_OFFSET_X;
                const anchorY = placement.y + CSA_RIBBON_OFFSET_Y;

                ctx.save();
                ctx.shadowColor = CSA_SHADOW_COLOR;
                ctx.shadowBlur = CSA_SHADOW_BLUR;
                ctx.shadowOffsetX = CSA_SHADOW_OFFSET_X;
                ctx.shadowOffsetY = 0;
                const skewTan = Math.tan(CSA_RIBBON_SKEW_STRENGTH);
                ctx.translate(anchorX, anchorY);
                ctx.transform(1, skewTan, 0, 1, 0, 0);
                ctx.translate(destWidth / 2, destHeight / 2);
                ctx.rotate(CSA_RIBBON_ROTATION);
                const previousAlpha = ctx.globalAlpha;
                ctx.globalAlpha = CSA_RIBBON_DRAW_ALPHA;
                ctx.drawImage(perspectiveCanvas, -destWidth / 2, -destHeight / 2);
                ctx.globalAlpha = previousAlpha;
                ctx.restore();

                const cos = Math.cos(CSA_RIBBON_ROTATION);
                const sin = Math.sin(CSA_RIBBON_ROTATION);

                tooltipRects.forEach(t => {
                    const corners = [
                        { x: t.x, y: t.y },
                        { x: t.x + t.width, y: t.y },
                        { x: t.x, y: t.y + t.height },
                        { x: t.x + t.width, y: t.y + t.height },
                    ].map(pt => {
                        const sx = pt.x * scale;
                        const sy = pt.y * scale;
                        const mapped = perspective.mapPoint(sx, sy);
                        const localX = mapped.x - destWidth / 2;
                        const localY = mapped.y - destHeight / 2;
                        const rotX = localX * cos - localY * sin;
                        const rotY = localX * sin + localY * cos;
                        const afterRotX = rotX + destWidth / 2;
                        const afterRotY = rotY + destHeight / 2;
                        const skewY = afterRotY + afterRotX * skewTan;
                        return {
                            x: anchorX + afterRotX,
                            y: anchorY + skewY,
                        };
                    });

                    const minX = Math.min(...corners.map(c => c.x));
                    const maxX = Math.max(...corners.map(c => c.x));
                    const minY = Math.min(...corners.map(c => c.y));
                    const maxY = Math.max(...corners.map(c => c.y));
                    const padding = 1;
                    const width = Math.max(0, maxX - minX - padding * 2);
                    const height = Math.max(0, maxY - minY - padding * 2);
                    registerTooltip(minX + padding, minY + padding, width, height, t.content);
                });
                debugLog("[PU:render] CSA ribbon tooltip rects registered:", tooltipRects.length);
            }
        } catch (e) {
            debugLog("[PU:render] Error processing CSA ribbons:", e);
        }
    }

    // Add the finished canvas to container and activate tooltips
    container.prepend(canvas);
    setupTooltips(canvas);
    debugLog("[PU:render] Canvas appended and tooltips set up");
}

/**
 * Draws foreground overlays while keeping the image/item index alignment intact.
 */
function drawImages(ctx, images = [], canvas, items = []) {
    images.forEach((img, i) => {
        const it = items[i];

        if (!img) {
            debugLog(`[PU:render] Foreground image ${i} unavailable`, it);
            return;
        }

        if (img?.naturalWidth && img?.naturalHeight) {
            const hasPos = it && typeof it === "object" && Number.isFinite(it.x) && Number.isFinite(it.y);
            const x = hasPos ? it.x : (canvas.width - img.naturalWidth) / 2;
            const y = hasPos ? it.y : (canvas.height - img.naturalHeight) / 2;
            ctx.drawImage(img, x, y, img.naturalWidth, img.naturalHeight);
            debugLog(`[PU:render] Drew foreground image ${i} at (${x}, ${y}) size ${img.naturalWidth}x${img.naturalHeight}`);
        } else {
            debugLog(`[PU:render] Foreground image ${i} missing dimensions`, img);
        }
    });
}

/**
 * Applies a subtle taper and downward curve to the ribbon block before the final rotation.
 * Returns both the warped canvas and a helper that maps points through the same transform.
 */
function buildRibbonPerspectiveCanvas(sourceCanvas, options = {}) {
    const width = sourceCanvas.width || 1;
    const height = sourceCanvas.height || 1;
    const {
        curveDepth = RIBBON_CURVE_DEPTH,
        taper = RIBBON_TAPER,
        sliceCount = RIBBON_SLICE_COUNT,
    } = options;
    const slices = Math.max(12, sliceCount);
    const sliceWidth = width / slices;
    const info = [];

    let destWidth = 0;
    for (let i = 0; i < slices; i++) {
        const srcX = i * sliceWidth;
        const tMid = (i + 0.5) / slices;
        const scaleX = 1 - (taper * tMid);
        const destSliceWidth = sliceWidth * scaleX;
        const curve = curveDepth * Math.sin(Math.PI * tMid);
        info.push({ srcX, destX: destWidth, destWidth: destSliceWidth, curve });
        destWidth += destSliceWidth;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(destWidth));
    canvas.height = Math.max(1, Math.round(height + curveDepth));
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;

    info.forEach(segment => {
        ctx.drawImage(
            sourceCanvas,
            segment.srcX,
            0,
            sliceWidth,
            height,
            segment.destX,
            segment.curve,
            segment.destWidth,
            height
        );
    });

    const mapPoint = (x, y) => {
        const clampedX = Math.min(Math.max(x, 0), width);
        const idx = Math.min(info.length - 1, Math.floor(clampedX / sliceWidth));
        const segment = info[idx];
        const next = info[Math.min(info.length - 1, idx + 1)];
        const localT = sliceWidth === 0 ? 0 : (clampedX - segment.srcX) / sliceWidth;
        const curve = segment.curve + (next.curve - segment.curve) * localT;
        const destX = segment.destX + (segment.destWidth * localT);
        return { x: destX, y: curve + y };
    };

    return { canvas, mapPoint };
}

/**
 * Lays out up to three rows of award ribbons and returns tooltip rectangles for each.
 */
function drawAwards(ctx, awardImages, canvas, AWARD_INDEX, hasSeniorPilot) {
    const perRow = [4, 4, 4];
    const maxRibbons = perRow.reduce((sum, count) => sum + count, 0);
    const sorted = [...awardImages]
        .sort((a, b) => (AWARD_INDEX[a.alt] ?? Infinity) - (AWARD_INDEX[b.alt] ?? Infinity))
        .slice(0, maxRibbons)
        .reverse();
    const final = sorted;

    const rowCounts = Array(perRow.length).fill(0);
    const rows = [];
    let r = 0;

    final.forEach((_img) => {
        while (r < perRow.length - 1 && rowCounts[r] >= perRow[r]) {
            r++;
        }
        rows.push(r);
        rowCounts[r]++;
    });

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
        const ribbonHeight = Math.round(img.naturalHeight * RIBBON_HEIGHT_SCALE);
        const rowHeight = ribbonHeight + RIBBON_ROW_GAP;
        let x = startX + ((inRow - 1 - col) * img.naturalWidth);
        if (hasSeniorPilot && row === 2 && inRow === 1 && final.length === 9) {
            // Special-case: 9 ribbons produce a single badge on the third row; nudge into perspective line
            x += SINGLE_THIRD_ROW_OFFSET_X;
        }
        const extraHeight = row === 0 ? TOP_ROW_EXTRA_HEIGHT : 0;
        const y = canvas.height - ribbonHeight - (row * rowHeight);
        const drawY = y - extraHeight;
        ctx.drawImage(img, x, drawY, img.naturalWidth, ribbonHeight + extraHeight);

        // Build tooltip content for award
        const srcPath = normalizePath(img.src);
        const meta = awards.find(a => normalizePath(a.imageKey) === srcPath || a.name === img.alt) || {};
        const content = `<img src="${meta.tooltipImage || meta.imageKey}"> ${meta.tooltipText || meta.name}`;
        tips.push({ x, y: drawY, width: img.naturalWidth, height: ribbonHeight + extraHeight, content });
    });
    return tips; // return all award tooltip areas
}

function drawCsaRibbonRow(ctx, images = [], canvas, entries = []) {
    const limitedImages = images.slice(0, CSA_RIBBON_MAX);
    const limitedEntries = entries.slice(0, CSA_RIBBON_MAX);
    if (!limitedImages.length) {
        canvas.width = 1;
        canvas.height = 1;
        return [];
    }

    ctx.imageSmoothingEnabled = true;
    const gap = 2;
    const widths = limitedImages.map(img => Math.max(1, Math.round(img.naturalWidth || 0)));
    const heights = limitedImages.map(img => Math.max(1, Math.round((img.naturalHeight || 0) * RIBBON_HEIGHT_SCALE)));
    const maxHeight = Math.max(...heights, 1);

    const totalWidth = widths.reduce((sum, width, index) => sum + width + (index > 0 ? gap : 0), 0);
    canvas.width = Math.max(1, totalWidth);
    canvas.height = Math.max(1, maxHeight);

    const tips = [];
    let currentX = 0;
    limitedImages.forEach((img, index) => {
        const width = widths[index];
        const height = heights[index];
        const drawY = maxHeight - height;
        ctx.drawImage(img, currentX, drawY, width, height);

        const entry = limitedEntries[index];
        const tooltipContent = entry ? `<img src="${entry.tooltipImage}"> ${entry.tooltipText}` : "";
        tips.push({ x: currentX, y: drawY, width, height, content: tooltipContent });

        currentX += width + gap;
    });

    if (CSA_RIBBON_BRIGHTEN_ALPHA > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = CSA_RIBBON_BRIGHTEN_ALPHA;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    return tips;
}
