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
const RIBBON_ROTATION = -2 * Math.PI / 180;  // subtle overall CCW tilt layered on skew
const RIBBON_TAPER = 0;                      // taper disabled (minimal distance change)
const RIBBON_CURVE_DEPTH = 3;                // downward bulge in px (scaled space)
const RIBBON_SKEW_STRENGTH = -0.08;          // horizontal skew (negative lifts right side upward)
const RIBBON_SLICE_COUNT = 48;               // controls smoothness of taper/curve sampling
const RIBBON_OFFSET_X = 2;                   // fine-tune final placement horizontally
const RIBBON_OFFSET_Y = 6;                   // fine-tune final placement vertically
const SINGLE_THIRD_ROW_OFFSET_X = 2;         // nudge lone third-row ribbon to align with perspective
const RIBBON_SCALE = 0.29;                  // uniform scaling factor before perspective warp

const CSA_RIBBON_MAX = 3;
const CSA_RIBBON_ROTATION = 1 * Math.PI / 180;   // mirrored (CW) rotation for CSA ribbons
const CSA_RIBBON_SKEW_STRENGTH = 0.07;           // mirrored horizontal skew (positive lifts left side)
const CSA_RIBBON_OFFSETS_BY_COUNT = {
    1: { x: -154, y: 181 },
    2: { x: -151, y: 181 },
    3: { x: -149, y: 181 },
};
const CSA_RIBBON_DEFAULT_OFFSET = CSA_RIBBON_OFFSETS_BY_COUNT[3];
const CSA_RIBBON_SCALE = RIBBON_SCALE * 1.4;     // CSA ribbons render slightly larger than awards
const CSA_RIBBON_CURVE_DEPTH = 2;               // shallower curve than medals for a flatter appearance
const CSA_SHADOW_OFFSET_X = 0.8;                 // subtle mirrored shadow for CSA ribbons
const CSA_SHADOW_BLUR = 1.5;                     // slightly stronger drop shadow for thinner CSA ribbons
const CSA_SHADOW_COLOR = 'rgba(0,0,0,0.3)';      // drop shadow tone for CSA ribbons
const CSA_RIBBON_DRAW_ALPHA = 1.0;              // opacity when placing CSA ribbons on uniform
const CSA_RIBBON_BRIGHTEN_ALPHA = 0;            // additional brighten overlay applied to CSA ribbons

export const PU_FILTERS = Object.freeze({
    qualificationMuted: "saturate(0.85) brightness(0.85)", // shared CTM/leadership tone adjustment
    medalRibbonTone: "saturate(0.8) brightness(0.9)",       // medal ribbon tone adjustment
    csaRibbonTone: "saturate(1) brightness(1)",         // CSA ribbon tone adjustment
});

const PERSPECTIVE_CACHE = new Map();

const AWARD_PLACEMENTS = {
    1: { x: 385, y: 45 },
    2: { x: 382, y: 45 },
    3: { x: 384, y: 44 },
    default: { x: 380, y: 46 },
};

function getAwardPlacement(count) {
    return AWARD_PLACEMENTS[count] || AWARD_PLACEMENTS.default;
}

function detachExistingCanvas(container) {
    const existing = container?.querySelector?.(".discourse-project-uniform-canvas");
    if (existing) {
        existing._teardownTooltips?.();
        existing.remove();
        debugLog("[PU:render] Removed previous canvas instance");
    }
}

function createCanvasSurface() {
    const canvas = document.createElement("canvas");
    canvas.className = "discourse-project-uniform-canvas";
    Object.assign(canvas.style, { position: "relative", zIndex: "0", pointerEvents: "auto", display: "block", margin: "0 auto" });
    return canvas;
}

function loadRenderAssets(backgroundImageUrl, foregroundUrls, awardUrls, csaUrls) {
    return Promise.all([
        loadImageCached(backgroundImageUrl || ""),
        ...foregroundUrls.map(u => loadImageCached(u || "")),
        ...awardUrls.map(u => loadImageCached(u || "")),
        ...csaUrls.map(u => loadImageCached(u || "")),
    ]).then(([background, ...rest]) => {
        const fg = rest.slice(0, foregroundUrls.length);
        const aw = rest.slice(foregroundUrls.length, foregroundUrls.length + awardUrls.length);
        const csa = rest.slice(foregroundUrls.length + awardUrls.length);
        return { background, foreground: fg, awards: aw, csa };
    });
}

function applyAltTextMetadata(awardImages, csaImages, csaRibbonEntries) {
    awardImages.forEach((img) => {
        if (!img) {
            return;
        }
        const imgPath = normalizePath(img.src);
        const match = awards.find(a => normalizePath(a.imageKey) === imgPath);
        img.alt = match?.name || "";
    });

    csaImages.forEach((img, index) => {
        if (!img) {
            return;
        }
        const entry = csaRibbonEntries[index];
        if (!entry) {
            return;
        }
        img.alt = entry.name;
    });
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

    const foregroundUrls = (foregroundItems || []).map((item) => (typeof item === "string" ? item : item?.url));
    const csaImageUrls = (csaRibbonEntries || []).map((entry) => entry?.imageKey).filter(Boolean);

    debugLog("[PU:render] mergeImagesOnCanvas", {
        backgroundImageUrl,
        fgCount: foregroundUrls.length,
        awardCount: awardImageUrls.length,
        csaCount: csaImageUrls.length,
        highestRank: highestRank?.name
    });

    detachExistingCanvas(container);

    const canvas = createCanvasSurface();
    const ctx = canvas.getContext("2d");

    loadRenderAssets(backgroundImageUrl, foregroundUrls, awardImageUrls, csaImageUrls)
        .then(({ background, foreground, awards: awardImages, csa: csaImages }) => {
            if (!container || container._puRenderId !== renderId) {
                debugLog("[PU:render] Stale render resolved – skipping append", { renderId });
                return;
            }

            applyAltTextMetadata(awardImages, csaImages, csaRibbonEntries);

            renderCanvasContents(
                ctx,
                canvas,
                background,
                foreground,
                awardImages,
                highestRank,
                qualificationsToRender,
                groups,
                groupTooltipMap,
                foregroundItems,
                csaImages,
                csaRibbonEntries
            );

            prependCanvas(container, canvas);
        })
        .catch((e) => debugLog("[PU:render] Error loading images:", e));
}

/**
 * Coordinates drawing the background, foreground overlays, ribbons, and tooltip regions.
 */
function renderCanvasContents(ctx, canvas, bgImage, fgImages, awardImages, highestRank, qualificationsToRender, groups, groupTooltipMap, foregroundItems = [], csaImages = [], csaRibbonEntries = []) {
    resizeCanvasToBackground(canvas, ctx, bgImage);
    drawBackgroundLayer(ctx, canvas, bgImage);
    drawImages(ctx, fgImages, canvas, foregroundItems);

    registerGroupTooltipsForCanvas(groups, groupTooltipMap);
    registerRankTooltipsForCanvas(canvas, fgImages, highestRank);
    registerQualificationTooltipsForCanvas(qualificationsToRender);

    renderAwardsWithTooltips(ctx, canvas, awardImages, qualificationsToRender);
    renderCsaRibbonsWithTooltips(ctx, canvas, csaImages, csaRibbonEntries, highestRank);
}

function resizeCanvasToBackground(canvas, ctx, bgImage) {
    canvas.width = bgImage?.naturalWidth || 1;
    canvas.height = bgImage?.naturalHeight || 1;
    ctx.imageSmoothingEnabled = true;
    debugLog("[PU:render] Canvas size:", { w: canvas.width, h: canvas.height });
}

function drawBackgroundLayer(ctx, canvas, bgImage) {
    if (!bgImage) {
        return;
    }
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    ctx.restore();
}

function registerGroupTooltipsForCanvas(groups, groupTooltipMap) {
    let groupTipCount = 0;
    if (!groups?.length || !groupTooltipMap) {
        debugLog("[PU:render] Group tooltips registered:", groupTipCount);
        return groupTipCount;
    }

    const resolveGroupTooltip = (name) => {
        const key = String(name || "");
        const keyLC = key.toLowerCase();
        if (typeof groupTooltipMap.get === "function") {
            return groupTooltipMap.get(keyLC) || groupTooltipMap.get(key) || null;
        }
        return groupTooltipMap[keyLC] || groupTooltipMap[key] || null;
    };

    groups.forEach((group) => {
        const data = resolveGroupTooltip(group.name);
        data?.tooltipAreas?.forEach((area) => {
            registerTooltip(area.x, area.y, area.width, area.height, `<img src="${data.tooltipImage}"> ${data.tooltipText}`);
            groupTipCount++;
        });
    });

    debugLog("[PU:render] Group tooltips registered:", groupTipCount);
    return groupTipCount;
}

function registerRankTooltipsForCanvas(canvas, fgImages, highestRank) {
    if (!(highestRank && highestRank.tooltipAreas)) {
        return 0;
    }

    const rankImg = fgImages.length ? fgImages[0] : null;
    const x = rankImg?.naturalWidth ? (canvas.width - rankImg.naturalWidth) / 2 : 0;
    const y = rankImg?.naturalHeight ? (canvas.height - rankImg.naturalHeight) / 2 : 0;
    const tip =
        (highestRank.tooltipImage ? `<img src="${highestRank.tooltipImage}"> ` : "") +
        (highestRank.tooltipText || "");

    highestRank.tooltipAreas.forEach((area) => {
        registerTooltip(x + area.x, y + area.y, area.width, area.height, tip);
    });

    debugLog("[PU:render] Rank tooltips registered:", highestRank.tooltipAreas.length);
    return highestRank.tooltipAreas.length;
}

function registerQualificationTooltipsForCanvas(qualifications = []) {
    let qualTipCount = 0;
    qualifications.forEach((qual) => {
        qual.tooltipAreas?.forEach((area) => {
            registerTooltip(area.x, area.y, area.width, area.height, `<img src="${qual.tooltipImage}"> ${qual.tooltipText}`);
            qualTipCount++;
        });
    });
    debugLog("[PU:render] Qualification tooltips registered:", qualTipCount);
    return qualTipCount;
}

function renderAwardsWithTooltips(ctx, canvas, awardImages, qualificationsToRender) {
    try {
        const awardsCanvas = document.createElement("canvas");
        awardsCanvas.width = canvas.width;
        awardsCanvas.height = canvas.height;
        const aCtx = awardsCanvas.getContext("2d");
        const hasSeniorPilot = qualificationsToRender.some((q) => q?.name === "Senior Pilot");
        const tooltipRects = drawAwards(
            aCtx,
            awardImages.filter(Boolean),
            awardsCanvas,
            AWARD_INDEX,
            hasSeniorPilot
        );

        const scale = RIBBON_SCALE;
        const scaled = document.createElement("canvas");
        scaled.width = awardsCanvas.width * scale;
        scaled.height = awardsCanvas.height * scale;
        scaled.getContext("2d").drawImage(awardsCanvas, 0, 0, scaled.width, scaled.height);

        const count = awardImages.length;
        debugLog("[PU:render] Awards placed (count):", count);
        const { x: awardsX, y: awardsY } = getAwardPlacement(count);

        const perspective = buildRibbonPerspectiveCanvas(scaled);
        const perspectiveCanvas = perspective.canvas;
        const destWidth = perspectiveCanvas.width;
        const destHeight = perspectiveCanvas.height;

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 2.0;
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

        tooltipRects.forEach((tooltip) => {
            const corners = [
                { x: tooltip.x, y: tooltip.y },
                { x: tooltip.x + tooltip.width, y: tooltip.y },
                { x: tooltip.x, y: tooltip.y + tooltip.height },
                { x: tooltip.x + tooltip.width, y: tooltip.y + tooltip.height },
            ].map((pt) => {
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

            const minX = Math.min(...corners.map((c) => c.x));
            const maxX = Math.max(...corners.map((c) => c.x));
            const minY = Math.min(...corners.map((c) => c.y));
            const maxY = Math.max(...corners.map((c) => c.y));
            const padding = 1;
            const width = Math.max(0, maxX - minX - padding * 2);
            const height = Math.max(0, maxY - minY - padding * 2);
            registerTooltip(minX + padding, minY + padding, width, height, tooltip.content);
        });

        debugLog("[PU:render] Award tooltip rects registered:", tooltipRects.length);
    } catch (error) {
        debugLog("[PU:render] Error processing awards:", error);
    }
}

function renderCsaRibbonsWithTooltips(ctx, canvas, csaImages, csaRibbonEntries, highestRank) {
    if (!csaImages.length || !csaRibbonEntries.length) {
        return;
    }

    try {
        const csaCanvas = document.createElement("canvas");
        const csaCtx = csaCanvas.getContext("2d");
        const csaPairs = csaImages
            .map((img, index) => ({ img, entry: csaRibbonEntries[index] }))
            .filter((pair) => pair.img && pair.entry);
        const csaCount = csaPairs.length;
        const maskRightmostQuarter =
            highestRank?.service !== "RAF" &&
            highestRank?.category === "officer" &&
            csaCount === 3;
        const tooltipRects = drawCsaRibbonRow(
            csaCtx,
            csaPairs.map((pair) => pair.img),
            csaCanvas,
            csaPairs.map((pair) => pair.entry),
            { maskRightmostQuarter }
        );

        if (!tooltipRects.length || !csaCount) {
            return;
        }

        const scale = CSA_RIBBON_SCALE;
        const scaled = document.createElement("canvas");
        scaled.width = Math.max(1, Math.round(csaCanvas.width * scale));
        scaled.height = Math.max(1, Math.round(csaCanvas.height * scale));
        scaled.getContext("2d").drawImage(csaCanvas, 0, 0, scaled.width, scaled.height);

        const perspective = buildRibbonPerspectiveCanvas(scaled, { curveDepth: CSA_RIBBON_CURVE_DEPTH });
        const perspectiveCanvas = perspective.canvas;
        const destWidth = perspectiveCanvas.width;
        const destHeight = perspectiveCanvas.height;

        const referencePlacement = getAwardPlacement(CSA_RIBBON_MAX);
        const offsets = CSA_RIBBON_OFFSETS_BY_COUNT[csaCount] || CSA_RIBBON_DEFAULT_OFFSET;
        const mirroredAnchorX = canvas.width - (referencePlacement.x + RIBBON_OFFSET_X);
        const anchorX = mirroredAnchorX + offsets.x;
        const anchorY = referencePlacement.y + offsets.y;

        const skewTan = Math.tan(CSA_RIBBON_SKEW_STRENGTH);
        ctx.save();
        ctx.shadowColor = CSA_SHADOW_COLOR;
        ctx.shadowBlur = CSA_SHADOW_BLUR;
        ctx.shadowOffsetX = CSA_SHADOW_OFFSET_X;
        ctx.shadowOffsetY = 0;
        ctx.translate(anchorX, anchorY);
        ctx.transform(1, skewTan, 0, 1, 0, 0);
        ctx.translate(destWidth / 2, destHeight / 2);
        ctx.rotate(CSA_RIBBON_ROTATION);

        const previousAlpha = ctx.globalAlpha;
        const previousFilter = ctx.filter;
        ctx.globalAlpha = CSA_RIBBON_DRAW_ALPHA;
        ctx.filter = PU_FILTERS.csaRibbonTone;
        ctx.drawImage(perspectiveCanvas, -destWidth / 2, -destHeight / 2);
        ctx.filter = previousFilter;
        ctx.globalAlpha = previousAlpha;
        ctx.restore();

        const cos = Math.cos(CSA_RIBBON_ROTATION);
        const sin = Math.sin(CSA_RIBBON_ROTATION);

        tooltipRects.forEach((tooltip) => {
            const corners = [
                { x: tooltip.x, y: tooltip.y },
                { x: tooltip.x + tooltip.width, y: tooltip.y },
                { x: tooltip.x, y: tooltip.y + tooltip.height },
                { x: tooltip.x + tooltip.width, y: tooltip.y + tooltip.height },
            ].map((pt) => {
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

            const minX = Math.min(...corners.map((c) => c.x));
            const maxX = Math.max(...corners.map((c) => c.x));
            const minY = Math.min(...corners.map((c) => c.y));
            const maxY = Math.max(...corners.map((c) => c.y));
            const padding = 1;
            const width = Math.max(0, maxX - minX - padding * 2);
            const height = Math.max(0, maxY - minY - padding * 2);
            registerTooltip(minX + padding, minY + padding, width, height, tooltip.content);
        });

        debugLog("[PU:render] CSA ribbon tooltip rects registered:", tooltipRects.length);
    } catch (error) {
        debugLog("[PU:render] Error processing CSA ribbons:", error);
    }
}

function prependCanvas(container, canvas) {
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
            const rotationDegrees = it && typeof it === "object" && Number.isFinite(it.rotationDegrees)
                ? it.rotationDegrees
                : 0;
            const rotationRadians = rotationDegrees ? (rotationDegrees * Math.PI) / 180 : 0;
            const filter = typeof it?.filter === "string" && it.filter.trim() ? it.filter : null;

            if (rotationRadians) {
                const cx = x + img.naturalWidth / 2;
                const cy = y + img.naturalHeight / 2;
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(rotationRadians);
                if (filter) {
                    ctx.filter = filter;
                }
                ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2, img.naturalWidth, img.naturalHeight);
                ctx.restore();
            } else {
                if (filter) {
                    ctx.save();
                    ctx.filter = filter;
                    ctx.drawImage(img, x, y, img.naturalWidth, img.naturalHeight);
                    ctx.restore();
                } else {
                    ctx.drawImage(img, x, y, img.naturalWidth, img.naturalHeight);
                }
            }

            debugLog(`[PU:render] Drew foreground image ${i} at (${x}, ${y}) size ${img.naturalWidth}x${img.naturalHeight}` +
                (rotationRadians ? ` rotated ${rotationDegrees}deg` : ""));
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
    const sliceWidth = width / slices || 1;
    const cacheKey = `${width}x${height}:${curveDepth}:${taper}:${slices}`;

    let cacheEntry = PERSPECTIVE_CACHE.get(cacheKey);
    if (!cacheEntry) {
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
        cacheEntry = {
            info,
            destWidth: Math.max(1, Math.round(destWidth)),
            sliceWidth,
        };
        PERSPECTIVE_CACHE.set(cacheKey, cacheEntry);
    }

    const { info, destWidth, sliceWidth: cachedSliceWidth } = cacheEntry;

    const canvas = document.createElement("canvas");
    canvas.width = destWidth;
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
        const effectiveSliceWidth = cachedSliceWidth;
        const idx = Math.min(info.length - 1, Math.floor(clampedX / effectiveSliceWidth));
        const segment = info[idx];
        const next = info[Math.min(info.length - 1, idx + 1)];
        const localT = effectiveSliceWidth === 0 ? 0 : (clampedX - segment.srcX) / effectiveSliceWidth;
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
    const ranked = awardImages.filter(Boolean);
    const final = ranked
        .sort((a, b) => (AWARD_INDEX[a?.alt] ?? Infinity) - (AWARD_INDEX[b?.alt] ?? Infinity))
        .slice(0, maxRibbons)
        .reverse();

    const rowCounts = perRow.map(() => 0);
    const rowAssignments = [];
    let activeRow = 0;

    final.forEach((_img, idx) => {
        while (activeRow < perRow.length && rowCounts[activeRow] >= perRow[activeRow]) {
            activeRow++;
        }
        if (activeRow >= perRow.length) {
            return;
        }
        rowAssignments[idx] = activeRow;
        rowCounts[activeRow]++;
    });

    const rowOffsets = [];
    let consumed = 0;
    rowCounts.forEach((count, row) => {
        rowOffsets[row] = consumed;
        consumed += count;
    });

    debugLog("[PU:render] Awards layout:", { total: awardImages.length, considered: final.length, rowCounts });

    const tips = [];
    const gradientBounds = {
        left: Number.POSITIVE_INFINITY,
        right: 0,
        top: Number.POSITIVE_INFINITY,
        bottom: 0,
    };

    final.forEach((img, idx) => {
        if (!img?.naturalWidth || !img?.naturalHeight) {
            return;
        }
        const row = rowAssignments[idx];
        if (row === undefined) {
            return;
        }
        const inRow = rowCounts[row];
        const col = idx - (rowOffsets[row] ?? 0);

        const gap = 1;
        const rowWidth = inRow * img.naturalWidth + Math.max(0, inRow - 1) * gap;
        const startX = (canvas.width - rowWidth) / 2;

        let x = startX + (inRow - 1 - col) * (img.naturalWidth + gap);
        if (hasSeniorPilot && row === 2 && inRow === 1 && final.length === 9) {
            x += SINGLE_THIRD_ROW_OFFSET_X;
        }

        const ribbonHeight = Math.round(img.naturalHeight * RIBBON_HEIGHT_SCALE);
        const rowHeight = ribbonHeight + RIBBON_ROW_GAP;
        const extraHeight = row === 0 ? TOP_ROW_EXTRA_HEIGHT : 0;
        const y = canvas.height - ribbonHeight - row * rowHeight;
        const drawY = y - extraHeight;
        ctx.save();
        ctx.filter = PU_FILTERS.medalRibbonTone;
        ctx.drawImage(img, x, drawY, img.naturalWidth, ribbonHeight + extraHeight);
        ctx.restore();

        gradientBounds.left = Math.min(gradientBounds.left, x);
        gradientBounds.right = Math.max(gradientBounds.right, x + img.naturalWidth);
        gradientBounds.top = Math.min(gradientBounds.top, drawY);
        gradientBounds.bottom = Math.max(gradientBounds.bottom, drawY + ribbonHeight + extraHeight);

        const srcPath = normalizePath(img.src);
        const meta = awards.find(a => normalizePath(a.imageKey) === srcPath || a.name === img.alt) || {};
        const content = `<img src="${meta.tooltipImage || meta.imageKey}"> ${meta.tooltipText || meta.name}`;
        tips.push({ x, y: drawY, width: img.naturalWidth, height: ribbonHeight + extraHeight, content });
    });

    if (gradientBounds.right > gradientBounds.left && gradientBounds.bottom > gradientBounds.top) {
        const gradient = ctx.createLinearGradient(gradientBounds.left, 0, gradientBounds.right, 0);
        gradient.addColorStop(0, "rgba(0, 0, 0, 0.00)");
        gradient.addColorStop(0.55, "rgba(0, 0, 0, 0.1)");
        gradient.addColorStop(1, "rgba(0, 0, 0, 0.2)");
        ctx.save();
        ctx.fillStyle = gradient;
        ctx.fillRect(
            gradientBounds.left,
            Math.max(0, gradientBounds.top - 1),
            Math.max(1, gradientBounds.right - gradientBounds.left),
            Math.max(1, gradientBounds.bottom - gradientBounds.top + 2)
        );
        ctx.restore();
    }
    return tips;
}


function drawCsaRibbonRow(ctx, images = [], canvas, entries = [], options = {}) {
    const { maskRightmostQuarter = false } = options;
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
    const slotWidth = Math.max(...widths, 1);
    const fullRowWidth = slotWidth * CSA_RIBBON_MAX + gap * (CSA_RIBBON_MAX - 1);
    const totalRibbonWidth = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, limitedImages.length - 1);
    canvas.width = Math.max(1, Math.round(fullRowWidth));
    canvas.height = Math.max(1, maxHeight);

    const tips = [];
    let currentX = (canvas.width - totalRibbonWidth) / 2;
    limitedImages.forEach((img, index) => {
        const width = widths[index];
        const height = heights[index];
        const drawY = maxHeight - height;
        const drawX = currentX;
        ctx.drawImage(img, drawX, drawY, width, height);

        const entry = limitedEntries[index];
        const tooltipContent = entry ? `<img src="${entry.tooltipImage}"> ${entry.tooltipText}` : "";
        const isLast = index === limitedImages.length - 1;
        let effectiveWidth = width;
        if (maskRightmostQuarter && isLast) {
            // Trim a diagonal wedge so the top-right ribbon corner sits beneath
            // the officer chest strap while leaving the uniform background
            // intact.
            const denominator = width <= 20 ? 4 : 5;
            const cutWidth = Math.max(1, Math.round(width / denominator) - 3);
            const cutHeight = Math.max(4, Math.min(height, Math.round(height * 0.65)));

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(drawX + width - cutWidth, drawY);
            ctx.lineTo(drawX + width, drawY);
            ctx.lineTo(drawX + width, drawY + cutHeight);
            ctx.closePath();
            ctx.clip();
            ctx.clearRect(drawX + width - cutWidth, drawY, cutWidth, cutHeight);
            ctx.restore();

            effectiveWidth = width - cutWidth;
        }

        tips.push({ x: drawX, y: drawY, width: effectiveWidth, height, content: tooltipContent });

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

    if (canvas.width > 0 && canvas.height > 0) {
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        gradient.addColorStop(0, "rgba(0, 0, 0, 0.00)");
        gradient.addColorStop(0.6, "rgba(0, 0, 0, 0.15)");
        gradient.addColorStop(1, "rgba(0, 0, 0, 0.20)");
        ctx.save();
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    return tips;
}
