/**
 * Prepares data for Project Uniform rendering. Selects the correct background, gathers
 * foreground overlays, resolves qualification and award imagery, and registers tooltips
 * before delegating to the canvas renderer.
 */
import {
    backgroundImages,
    ranks,
    officerRanks,
    enlistedRanks,
    lanyardToImageMapLC,
    groupToImageMapLC,
    qualificationsByNameLC,
    lanyardTooltipRegion,
    lanyardTooltipMapLC,
    groupTooltipMapLC,
    awardsByNameLC,
    leadershipQualificationsOrder,
    leadershipQualificationAliases,
    marksmanshipQualificationsOrder,
    pilotQualificationsOrder,
    ctmQualificationsOrder,
    ctmRenderDefaults,
    csaRibbonGroupMapLC,
    csaLeadershipOverrideByRibbonCount,
    csaLeadershipQualificationNames,
    paraTooltipEnlisted,
    paraTooltipOfficer,
    paraCollarImageEnlisted,
    paraCollarImageOfficer
} from "discourse/plugins/discourse-project-uniform/discourse/uniform-data";

import { mergeImagesOnCanvas, PU_FILTERS } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-render";
import { clearTooltips, registerTooltip } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-tooltips";
import { debugLog, puPaths } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-utils";

// Normalizes potentially nullish values into lowercase strings for set lookups.
const toLC = (value) => String(value || "").toLowerCase();
// Flags strings that begin with a digit so CSA ribbons can be sorted numerically first.
const startsWithDigit = (value) => /^\d/.test(String(value || ""));
// Compares CSA ribbon names with numeric awareness and case-insensitive locale order.
const compareCsaNames = (a, b) => {
    const aDigit = startsWithDigit(a);
    const bDigit = startsWithDigit(b);
    if (aDigit !== bDigit) {
        return aDigit ? -1 : 1;
    }
    return String(a || "").localeCompare(String(b || ""), undefined, { sensitivity: "base", numeric: true });
};

const leadershipAliasMapLC = Object.freeze(
    Object.fromEntries(
        Object.entries(leadershipQualificationAliases || {}).map(([alias, canonical]) => [
            toLC(alias),
            toLC(canonical)
        ])
    )
);

// Resolves leadership qualification aliases to their canonical lowercase names.
const canonicalLeadershipName = (value) => leadershipAliasMapLC[value] || value;

const CSA_LEADERSHIP_NAMES = new Set(
    csaLeadershipQualificationNames.map((name) => canonicalLeadershipName(toLC(name)))
);

const leadershipOrderLC = leadershipQualificationsOrder
    .map((name) => canonicalLeadershipName(toLC(name)))
    .filter((name, idx, arr) => arr.indexOf(name) === idx);
const marksmanshipOrderLC = marksmanshipQualificationsOrder.map(toLC);
const pilotOrderLC = pilotQualificationsOrder.map(toLC);
const ctmOrderLC = ctmQualificationsOrder.map(toLC);
const CTM_NAME_SET = new Set(ctmOrderLC);
const CTM_BASE_PLACEMENT = Object.freeze({
    x: Number(ctmRenderDefaults?.basePlacement?.x ?? 0),
    y: Number(ctmRenderDefaults?.basePlacement?.y ?? 0),
});
const CTM_ROTATION_DEGREES = Number(ctmRenderDefaults?.rotationDegrees ?? 0);
const CTM_ANCHOR_OFFSET_X = Number(ctmRenderDefaults?.leaderAnchorOffset?.x ?? 0);
const CTM_ANCHOR_OFFSET_Y = Number(ctmRenderDefaults?.leaderAnchorOffset?.y ?? 0);
const CTM_PLAIN_NAME_LC = toLC(ctmRenderDefaults?.plainVariantName || "CTM");
const CTM_PLAIN_EXTRA_Y = Number(ctmRenderDefaults?.plainVariantExtraYOffset ?? 0);
const officerRankNameSetLC = new Set(officerRanks.map(toLC));
const enlistedRankNameSetLC = new Set(enlistedRanks.map(toLC));

const ANALOG_FONT_SPEC = Object.freeze({ family: "Analog", url: puPaths.font("ANALOG.TTF") });

// White chest patch name placement (tweak margins/rotation/scale here)
const RECRUIT_NAME_LAYOUT = Object.freeze({
    patchRect: Object.freeze({ x: 443, y: 142, width: 118, height: 62 }),
    marginLeft: 7,
    marginRight: 6,
    marginY: 4,
    rotationDegrees: -6,
    scaleX: 1,
    scaleY: 2,
    maxFontSize: 26,
    minFontSize: 18,
    fillStyle: "#1b1d22dd",
    pivot: "center",
    letterSpacing: 0,
    pivotOffsetX: 0,
    pivotOffsetY: 0,
    skewXDegrees: -4,
    skewYDegrees: 0,
    perspectiveStep: -0.1,
    perspectiveOrigin: "left",
    perspectiveMinScale: 0.65,
});

// Sleeve patch number placement (center anchor, rotation, scale, skew are tweakable)
const RECRUIT_NUMBER_LAYOUT = Object.freeze({
    center: Object.freeze({ x: 660, y: 281 }),
    width: 140,
    height: 120,
    rotationDegrees: -45,
    scaleX: 0.6,
    scaleY: 1,
    skewXDegrees: -26,
    skewYDegrees: 0,
    maxFontSize: 35,
    minFontSize: 24,
    fillStyle: "#1b1d22",
    letterSpacing: -1,
    pivot: "center",
    offsetX: 0,
    offsetY: 0,
    pivotOffsetX: 0,
    pivotOffsetY: 0,
});

// Finds the highest-ranked name in the supplied order that the caller possesses.
function highestIn(order, have) {
    for (let i = order.length - 1; i >= 0; i--) if (have.has(order[i])) return order[i];
}

// Removes any existing Project Uniform canvas (and its tooltip wiring) from the container.
function removeExistingCanvas(container) {
    if (!container?.querySelector) {
        return;
    }
    const existing = container.querySelector(".discourse-project-uniform-canvas");
    if (existing) {
        existing._teardownTooltips?.();
        existing.remove();
        debugLog("[PU:prepare] Removed existing canvas (early cleanup)");
    }
}

function shrinkRect(rect, marginLeft = 0, marginRight = marginLeft, marginTop = 0, marginBottom = marginTop) {
    const x = Number(rect?.x) || 0;
    const y = Number(rect?.y) || 0;
    const width = Math.max(0, Number(rect?.width) || 0);
    const height = Math.max(0, Number(rect?.height) || 0);
    const shrinkLeft = Math.max(0, Number(marginLeft) || 0);
    const shrinkRight = Math.max(0, Number(marginRight) || 0);
    const shrinkTop = Math.max(0, Number(marginTop) || 0);
    const shrinkBottom = Math.max(0, Number(marginBottom) || 0);
    return {
        x: x + shrinkLeft,
        y: y + shrinkTop,
        width: Math.max(0, width - shrinkLeft - shrinkRight),
        height: Math.max(0, height - shrinkTop - shrinkBottom),
    };
}

function rectFromCenter(center, width, height) {
    const w = Math.max(0, Number(width) || 0);
    const h = Math.max(0, Number(height) || 0);
    const cx = Number(center?.x) || 0;
    const cy = Number(center?.y) || 0;
    return {
        x: cx - w / 2,
        y: cy - h / 2,
        width: w,
        height: h,
    };
}

// Produces a helper that records foreground overlay metadata in insertion order.
function createForegroundAdder(store) {
    return (urlOrArray, options) => {
        if (!urlOrArray) {
            return null;
        }

        const item = { url: urlOrArray };
        if (options && typeof options === "object") {
            if (Number.isFinite(options.x)) {
                item.x = options.x;
            }
            if (Number.isFinite(options.y)) {
                item.y = options.y;
            }
            if (Number.isFinite(options.rotationDegrees)) {
                item.rotationDegrees = options.rotationDegrees;
            }
        }

        store.push(item);
        return item;
    };
}

// Collates group membership flags used by later rendering rules.
function buildGroupContext(groups) {
    const groupNameSetLC = new Set(groups.map(g => toLC(g?.name)));
    const is16CSMR = ["16csmr", "16csmr_ic", "16csmr_2ic"].some(n => groupNameSetLC.has(n));
    const is7RHA = ["7rha", "7rha_ic", "7rha_2ic"].some(n => groupNameSetLC.has(n));
    return { groupNameSetLC, is16CSMR, is7RHA };
}

// Maps badge names into lookup sets for qualification and award filtering.
function buildBadgeContext(userBadges, idToBadge) {
    const badgeNames = userBadges
        .map(ub => idToBadge.get(ub.badge_id)?.name)
        .filter(Boolean);
    const badgeNameSetLC = new Set(badgeNames.map(toLC));
    const leadershipBadgeNameSetLC = new Set(
        [...badgeNameSetLC].map((name) => canonicalLeadershipName(name))
    );
    return { badgeNames, badgeNameSetLC, leadershipBadgeNameSetLC };
}

// Chooses the highest-priority rank based on the user's group memberships.
function resolveHighestRank(groupNameSetLC) {
    return ranks.find(r => groupNameSetLC.has(toLC(r.name))) || null;
}

// Determines the uniform background and RAF flag using rank or group hints.
function determineBackgroundInfo(highestRank, groupNameSetLC) {
    let background = "";

    if (highestRank) {
        if (highestRank.service === "RAF" && highestRank.category === "officer") {
            background = backgroundImages.rafOfficer;
            debugLog("[PU:prepare] Background=RAF officer");
        } else if (highestRank.service === "RAF" && highestRank.category === "enlisted") {
            background = backgroundImages.rafEnlisted;
            debugLog("[PU:prepare] Background=RAF enlisted");
        } else if (highestRank.category === "officer") {
            background = backgroundImages.officer;
            debugLog("[PU:prepare] Background=BA officer");
        } else if (highestRank.category === "enlisted") {
            background = backgroundImages.enlisted;
            debugLog("[PU:prepare] Background=BA enlisted");
        }
    } else {
        if ([...groupNameSetLC].some(n => officerRankNameSetLC.has(n))) {
            background = backgroundImages.officer;
            debugLog("[PU:prepare] Background=BA officer (fallback)");
        } else if ([...groupNameSetLC].some(n => enlistedRankNameSetLC.has(n))) {
            background = backgroundImages.enlisted;
            debugLog("[PU:prepare] Background=BA enlisted (fallback)");
        } else {
            debugLog("[PU:prepare] Background not determined (no rank match)");
        }
    }

    return { background, isRAFUniform: highestRank?.service === "RAF" };
}

function isRecruitRank(highestRank) {
    return !!highestRank && toLC(highestRank.name) === "recruit";
}

function sanitizeRecruitDisplayName(user) {
    const name = (user?.name || "").trim();
    if (name) {
        return name;
    }
    const username = (user?.username || user?.username_lower || "").trim();
    return username || "Recruit";
}

function resolveRecruitNumber(user) {
    const raw = user?.project_uniform_recruit_number;
    if (typeof raw === "string" && raw.trim()) {
        return raw.trim().padStart(3, "0").slice(-3);
    }
    if (Number.isFinite(raw)) {
        return String(Math.trunc(raw)).padStart(3, "0").slice(-3);
    }
    const fallback = generateFallbackRecruitNumber(user);
    debugLog("[PU:prepare] Recruit number fallback applied", { userId: user?.id, fallback });
    return fallback;
}

function generateFallbackRecruitNumber(user) {
    const seedParts = [
        user?.id,
        user?.username_lower,
        user?.username,
        user?.created_at
    ].filter(Boolean);

    if (seedParts.length === 0) {
        return "000";
    }

    let hash = 0x811c9dc5; // FNV-1a 32-bit offset basis
    const source = seedParts.join("|");
    for (let i = 0; i < source.length; i++) {
        hash ^= source.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193); // FNV-1a prime
    }
    const normalized = Math.abs(hash) % 900;
    return String(normalized + 100).padStart(3, "0");
}

function renderRecruitUniform(container, user) {
    const backgroundUrl = backgroundImages.recruit;
    if (!backgroundUrl) {
        debugLog("[PU:prepare] Recruit background unavailable");
        return;
    }

    const displayName = sanitizeRecruitDisplayName(user);
    const recruitNumber = resolveRecruitNumber(user);
    const nameRect = shrinkRect(
        RECRUIT_NAME_LAYOUT.patchRect,
        RECRUIT_NAME_LAYOUT.marginLeft,
        RECRUIT_NAME_LAYOUT.marginRight,
        RECRUIT_NAME_LAYOUT.marginY,
        RECRUIT_NAME_LAYOUT.marginY
    );
    const numberRect = rectFromCenter(RECRUIT_NUMBER_LAYOUT.center, RECRUIT_NUMBER_LAYOUT.width, RECRUIT_NUMBER_LAYOUT.height);

    const textOverlays = [
        {
            text: displayName,
            rect: nameRect,
            fontFamily: ANALOG_FONT_SPEC.family,
            fontWeight: "400",
            maxFontSize: RECRUIT_NAME_LAYOUT.maxFontSize,
            minFontSize: RECRUIT_NAME_LAYOUT.minFontSize,
            fillStyle: RECRUIT_NAME_LAYOUT.fillStyle,
            textAlign: "center",
            textBaseline: "middle",
            transform: "uppercase",
            rotationDegrees: RECRUIT_NAME_LAYOUT.rotationDegrees,
            scaleX: RECRUIT_NAME_LAYOUT.scaleX,
            scaleY: RECRUIT_NAME_LAYOUT.scaleY,
            pivot: RECRUIT_NAME_LAYOUT.pivot,
            letterSpacing: RECRUIT_NAME_LAYOUT.letterSpacing,
            pivotOffsetX: RECRUIT_NAME_LAYOUT.pivotOffsetX,
            pivotOffsetY: RECRUIT_NAME_LAYOUT.pivotOffsetY,
            skewXDegrees: RECRUIT_NAME_LAYOUT.skewXDegrees,
            skewYDegrees: RECRUIT_NAME_LAYOUT.skewYDegrees,
            perspectiveStep: RECRUIT_NAME_LAYOUT.perspectiveStep,
            perspectiveOrigin: RECRUIT_NAME_LAYOUT.perspectiveOrigin,
            perspectiveMinScale: RECRUIT_NAME_LAYOUT.perspectiveMinScale,
        },
        {
            text: recruitNumber,
            rect: numberRect,
            fontFamily: ANALOG_FONT_SPEC.family,
            fontWeight: "400",
            maxFontSize: RECRUIT_NUMBER_LAYOUT.maxFontSize,
            minFontSize: RECRUIT_NUMBER_LAYOUT.minFontSize,
            fillStyle: RECRUIT_NUMBER_LAYOUT.fillStyle,
            textAlign: "center",
            textBaseline: "middle",
            rotationDegrees: RECRUIT_NUMBER_LAYOUT.rotationDegrees,
            scaleX: RECRUIT_NUMBER_LAYOUT.scaleX,
            scaleY: RECRUIT_NUMBER_LAYOUT.scaleY,
            skewXDegrees: RECRUIT_NUMBER_LAYOUT.skewXDegrees,
            skewYDegrees: RECRUIT_NUMBER_LAYOUT.skewYDegrees,
            letterSpacing: RECRUIT_NUMBER_LAYOUT.letterSpacing,
            pivot: RECRUIT_NUMBER_LAYOUT.pivot,
            offsetX: RECRUIT_NUMBER_LAYOUT.offsetX,
            offsetY: RECRUIT_NUMBER_LAYOUT.offsetY,
            pivotOffsetX: RECRUIT_NUMBER_LAYOUT.pivotOffsetX,
            pivotOffsetY: RECRUIT_NUMBER_LAYOUT.pivotOffsetY,
        }
    ];

    debugLog("[PU:prepare] Recruit uniform render", { displayName, recruitNumber });

    mergeImagesOnCanvas(
        container,
        backgroundUrl,
        [],
        [],
        null,
        [],
        [],
        null,
        [],
        { textOverlays, fonts: [ANALOG_FONT_SPEC] }
    );
}

// Derives CSA ribbon membership and leadership overrides from group assignments.
function buildCsaContext(groups) {
    const membership = new Map();
    groups.forEach((group) => {
        const ribbon = csaRibbonGroupMapLC[toLC(group?.name)];
        if (ribbon) {
            membership.set(ribbon.name, ribbon);
        }
    });

    const ribbonsToRender = [...membership.values()]
        .sort((a, b) => compareCsaNames(a.name, b.name))
        .slice(0, 3);
    const count = ribbonsToRender.length;
    const leadershipOverrideForCount =
        csaLeadershipOverrideByRibbonCount[count] || csaLeadershipOverrideByRibbonCount.default;

    return { membership, ribbonsToRender, count, leadershipOverrideForCount };
}

// Replaces CSA ribbon imagery with service-specific variants when available.
function swapCsaVariantsForService(ribbons, service) {
    if (!service) {
        return ribbons;
    }

    return ribbons.map((ribbon) => {
        const variantImage = ribbon?.serviceVariants?.[service];
        if (variantImage && variantImage !== ribbon.imageKey) {
            return { ...ribbon, imageKey: variantImage };
        }
        return ribbon;
    });
}

// Assembles all imagery for the supplied user state and triggers canvas rendering.
export function prepareAndRenderImages(groups, userBadges, idToBadge, container, awards, groupTooltipLookup = groupTooltipMapLC, user = null) {
    debugLog("[PU:prepare] start");
    clearTooltips();
    removeExistingCanvas(container);

    const foregroundItems = [];         // ALWAYS push objects: { url: string|array, x?, y? }
    const awardUrls = [];               // award ribbons (strings)
    const qualsToRender = [];           // qualification objects we’ll still pass to renderer (for tooltips)

    const pushFg = createForegroundAdder(foregroundItems);

    const { groupNameSetLC, is16CSMR, is7RHA } = buildGroupContext(groups);
    const { badgeNames, badgeNameSetLC, leadershipBadgeNameSetLC } = buildBadgeContext(userBadges, idToBadge);
    const { ribbonsToRender: csaRibbonsToRender, count: csaRibbonCount, leadershipOverrideForCount } = buildCsaContext(groups);

    debugLog("[PU:prepare] Inputs:", { groups: groups.map(g => g.name), is16CSMR, badgeNames, csaRibbons: csaRibbonsToRender.map(r => r.name) });

    const highestRank = resolveHighestRank(groupNameSetLC);
    debugLog("[PU:prepare] Highest rank:", highestRank?.name || null);
    if (isRecruitRank(highestRank)) {
        renderRecruitUniform(container, user || {});
        return;
    }

    const { background: bg, isRAFUniform } = determineBackgroundInfo(highestRank, groupNameSetLC);

    // Highest rank image (may be an array of candidate URLs) — push as object
    if (highestRank?.imageKey) {
        pushFg(highestRank.imageKey);
    }

    groups.forEach(g => {
        const key = toLC(g.name);

        // Group crest/badge image (always allowed)
        const gi = groupToImageMapLC[key];
        if (gi) {
            pushFg(gi);
            debugLog("[PU:prepare] Add group image:", g.name, gi);
        }

        // Lanyards: suppressed entirely when the uniform is RAF
        if (!isRAFUniform) {
            const li = lanyardToImageMapLC[key];
            if (li) {
                pushFg(li);
                debugLog("[PU:prepare] Add lanyard image:", g.name, li);
            }
        } else {
            debugLog("[PU:prepare] RAF uniform – skipping lanyard image for group:", g.name);
        }
    });

    const shouldAddParaCollarImage = !isRAFUniform && !is16CSMR && !is7RHA;
    if (shouldAddParaCollarImage) {
        const paraCollarImage = highestRank?.category === "officer"
            ? paraCollarImageOfficer
            : paraCollarImageEnlisted;
        if (paraCollarImage) {
            pushFg(paraCollarImage);
            debugLog("[PU:prepare] Add default Para collar image", paraCollarImage);
        }
    }

    // Determine highest leadership and marksmanship badges (case-insensitive)
    const highestLeadershipLC = highestIn(leadershipOrderLC, leadershipBadgeNameSetLC);

    const highestMarksmanshipLC = highestIn(marksmanshipOrderLC, badgeNameSetLC);

    // Pilot quals: prefer Senior over Junior if both present
    const highestPilotLC = highestIn(pilotOrderLC, badgeNameSetLC);
    const highestCtmLC = highestIn(ctmOrderLC, badgeNameSetLC);

    const highestRankLC = toLC(highestRank?.name);
    const cmtKeyLC = toLC("CMT");
    const hasLegacyCmt = badgeNameSetLC.has(cmtKeyLC);

    // Process each badge for qualifications and awards
    userBadges.forEach(ub => {
        const badge = idToBadge.get(ub.badge_id); if (!badge) return;
        const name = badge.name;
        const nameLC = toLC(name);
        const canonicalNameLC = canonicalLeadershipName(nameLC);

        // Skip certain marksmanship badges for 16CSMR
        if (is16CSMR && marksmanshipOrderLC.includes(nameLC)) {
            debugLog("[PU:prepare] Skip (16CSMR rule):", name);
            return;
        }

        const q = qualificationsByNameLC[nameLC];
        const isLeader = leadershipOrderLC.includes(canonicalNameLC);
        const isMarks = marksmanshipOrderLC.includes(nameLC);
        const isPilot = pilotOrderLC.includes(nameLC);
        const isCtm = CTM_NAME_SET.has(nameLC);
        
        // Hide leadership qualification badges on all RAF ranks,
        // including Sergeant Aircrew and Flight Sergeant Aircrew.
        if (isLeader && highestRank?.service === "RAF") {
            debugLog("[PU:prepare] Skip leadership (RAF rank):", name, "for", highestRank?.name);
            return;
        }

        // Skip lower leadership/marksmanship/pilot/ctm badges
        if (isCtm && hasLegacyCmt) {
            debugLog("[PU:prepare] Skip CTM (legacy CMT present)", name);
            return;
        }

        if ((isLeader && canonicalNameLC !== highestLeadershipLC) ||
            (isMarks && nameLC !== highestMarksmanshipLC) ||
            (isPilot && nameLC !== highestPilotLC) ||
            (isCtm && nameLC !== highestCtmLC)) {
            debugLog("[PU:prepare] Skip (not highest in pilot/leader/marks/ctm):", name);
            return;
        }

        // Add qualification if allowed (check rank restrictions)
        const restrictedLC = new Set((q?.restrictedRanks || []).map(toLC));
        if (q?.imageKey && !restrictedLC.has(highestRankLC)) {
            if (nameLC === cmtKeyLC && !is16CSMR) {
                debugLog("[PU:prepare] Skip CMT (not 16CSMR)");
            } else {
                qualsToRender.push(q);
                debugLog("[PU:prepare] Queue qualification:", name);
            }
        } else if (restrictedLC.has(highestRankLC)) {
            debugLog("[PU:prepare] Skip qualification (restricted by rank):", name, "for", highestRank?.name);
        }

        // Add award ribbon image if present (case-insensitive)
        const aw = awardsByNameLC[nameLC] || awards?.find?.(a => toLC(a.name) === nameLC);
        if (aw?.imageKey) {
            awardUrls.push(aw.imageKey);
            debugLog("[PU:prepare] Add award ribbon:", name, aw.imageKey);
        }
    });

    // Determine ribbon row count and adjust qualification tooltips accordingly
    const perRowCapacity = 4;
    const maxRibbonRows = 3;
    const clampedAwards = Math.min(awardUrls.length, perRowCapacity * maxRibbonRows);
    const ribbonRows = clampedAwards === 0 ? 0 : Math.ceil(clampedAwards / perRowCapacity);
    const hasLeadershipQual = qualsToRender.some((qual) =>
        leadershipOrderLC.includes(canonicalLeadershipName(toLC(qual.name)))
    );
    const baseLeaderPlacement = csaLeadershipOverrideByRibbonCount?.default?.imagePlacement || { x: 0, y: 0 };
    const activeLeaderPlacement = leadershipOverrideForCount?.imagePlacement || baseLeaderPlacement;

    const adjustedQualMap = new Map();
    const ctmTooltipBases = new Map();

    // Build adjusted qualification list with ribbon-row-specific tooltip boxes
    const adjustedQuals = qualsToRender.map((q) => {
        const rrAreas = q?.ribbonRowVariants?.ribbonRowTooltipAreas?.[ribbonRows];
        const baseAreas = Array.isArray(rrAreas)
            ? rrAreas
            : Array.isArray(q.tooltipAreas)
                ? q.tooltipAreas
                : [];

        const clonedAreas = baseAreas.map((area) => ({ ...area }));
        const clone = { ...q, tooltipAreas: clonedAreas };

        const nameLC = toLC(q.name);
        const canonicalLC = canonicalLeadershipName(nameLC);
        const leadershipOverrideCandidate = leadershipOverrideForCount &&
            CSA_LEADERSHIP_NAMES.has(canonicalLC);
        const isCtm = CTM_NAME_SET.has(nameLC);

        if (leadershipOverrideCandidate && leadershipOverrideForCount?.tooltipAreas) {
            clone.tooltipAreas = leadershipOverrideForCount.tooltipAreas.map((area) => ({ ...area }));
        }

        adjustedQualMap.set(q, clone);

        if (isCtm) {
            ctmTooltipBases.set(q, baseAreas.map((area) => ({ ...area })));
        }

        return clone;
    });
    // Push qualification images into foregroundItems, using absolute coords for pilots only
    const service = highestRank?.service; // "BA" | "RAF"
    const ctmForegroundData = [];

    qualsToRender.forEach((q) => {
        const adjustedQual = adjustedQualMap.get(q) || q;
        const chosenUrl = (q.serviceVariants && q.serviceVariants[service]) || q.imageKey;

        const placementByRows = q?.ribbonRowVariants?.imagePlacementByRows;
        const pilotPos = placementByRows?.[ribbonRows] || placementByRows?.default || placementByRows?.all;
        const nameLC = toLC(q.name);
        const canonicalLC = canonicalLeadershipName(nameLC);
        const isLeader = leadershipOrderLC.includes(canonicalLC);
        const leadershipOverrideActive = leadershipOverrideForCount &&
            CSA_LEADERSHIP_NAMES.has(canonicalLC);
        const isCtm = CTM_NAME_SET.has(nameLC);

        let finalPos = pilotPos ? { ...pilotPos } : null;
        if (!finalPos && leadershipOverrideActive && leadershipOverrideForCount?.imagePlacement) {
            finalPos = { ...leadershipOverrideForCount.imagePlacement };
        }
        if (!finalPos && isLeader) {
            finalPos = { ...activeLeaderPlacement };
        }

        if (isCtm) {
            const pushOptions = { ...CTM_BASE_PLACEMENT };
            if (CTM_ROTATION_DEGREES) {
                pushOptions.rotationDegrees = CTM_ROTATION_DEGREES;
            }

            const fgEntry = pushFg(chosenUrl, pushOptions);
            if (fgEntry) {
                fgEntry.filter = PU_FILTERS.qualificationMuted;
            }

            ctmForegroundData.push({
                adjustedQual,
                baseTooltip: ctmTooltipBases.get(q) || [],
                fgEntry,
                isPlain: nameLC === CTM_PLAIN_NAME_LC,
            });

            debugLog("[PU:prepare] Queue CTM image (pending alignment):", q.name);
        } else {
            const pushOptions = finalPos ? { ...finalPos } : null;
            const fgEntry = pushFg(chosenUrl, pushOptions);
            if (fgEntry && isLeader) {
                fgEntry.filter = PU_FILTERS.qualificationMuted;
            }
            debugLog("[PU:prepare] Add qualification image (post-awards):", q.name, finalPos || "(centered)");
        }
    });

    const hasCtm = ctmForegroundData.length > 0;
    const borrowYOnly = hasCtm && csaRibbonCount > 0; // CSA present, nudge CTM upward
    const borrowFull = hasLeadershipQual;             // true leadership badge present
    const wantsLeaderAnchor = borrowYOnly || borrowFull;
    const leaderPlacement = wantsLeaderAnchor
        ? {
            x: Number(activeLeaderPlacement?.x ?? baseLeaderPlacement.x),
            y: Number(activeLeaderPlacement?.y ?? baseLeaderPlacement.y),
        }
        : null;

    ctmForegroundData.forEach((entry) => {
        let finalPosX = CTM_BASE_PLACEMENT.x;
        let finalPosY = CTM_BASE_PLACEMENT.y;

        if (leaderPlacement) {
            // Always borrow Y so CTM lifts above CSA rows.
            finalPosY = leaderPlacement.y + CTM_ANCHOR_OFFSET_Y;
            // Only borrow X when a leadership qual is actually displayed.
            if (borrowFull) {
                finalPosX = leaderPlacement.x + CTM_ANCHOR_OFFSET_X;
            }
        }

        if (entry.isPlain && CTM_PLAIN_EXTRA_Y) {
            finalPosY += CTM_PLAIN_EXTRA_Y;
        }

        if (entry.fgEntry) {
            entry.fgEntry.x = finalPosX;
            entry.fgEntry.y = finalPosY;
        }

        const baseTooltip = entry.baseTooltip.length
            ? entry.baseTooltip
            : entry.adjustedQual.tooltipAreas || [];
        if (baseTooltip.length) {
            const deltaX = finalPosX - CTM_BASE_PLACEMENT.x;
            const deltaY = finalPosY - CTM_BASE_PLACEMENT.y;
            entry.adjustedQual.tooltipAreas = baseTooltip.map((area) => ({
                ...area,
                x: area.x + deltaX,
                y: area.y + deltaY,
            }));
        }

        debugLog("[PU:prepare] Align CTM image with leadership:", entry.adjustedQual.name, { x: finalPosX, y: finalPosY });
    });

    // Render if a background exists; foregrounds are optional (e.g., Private/Gunner)
    if (bg) {
        // Swap CSA ribbon art if the current service has a dedicated variant.
        const csaRibbonsForService = swapCsaVariantsForService(csaRibbonsToRender, highestRank?.service);

        mergeImagesOnCanvas(
            container,
            bg,
            foregroundItems,           // every item is an object with a `.url` (and maybe x,y)
            awardUrls.filter(Boolean),
            highestRank,
            adjustedQuals,
            groups,
            groupTooltipLookup,
            csaRibbonsForService
        );

        // Only register lanyard tooltips for BA uniforms
        if (!isRAFUniform) {
            if (!is16CSMR && !is7RHA) {
                const paraTooltip = highestRank?.category === "officer"
                    ? paraTooltipOfficer
                    : paraTooltipEnlisted;
                registerCollarTooltip(paraTooltip);
            }
            registerLanyardTooltips(groups);
        } else {
            debugLog("[PU:prepare] RAF uniform – skipping lanyard tooltips");
        }
    } else {
        debugLog("[PU:prepare] Nothing to render – missing bg");
    }
}

// Registers tooltip hitboxes covering the collar insignia region.
function registerCollarTooltip(tooltip) {
    if (!tooltip?.tooltipAreas?.length) {
        return;
    }
    const content = `<img src="${tooltip.tooltipImage}"> ${tooltip.tooltipText}`;
    tooltip.tooltipAreas.forEach(area => {
        if (!area) return;
        debugLog("[PU:prepare] Register collar tooltip", area);
        registerTooltip(area.x, area.y, area.width, area.height, content);
    });
}

// Registers tooltip hitboxes for any lanyards the user qualifies for.
function registerLanyardTooltips(groups) {
    groups.forEach(group => {
        const key = String(group?.name || "").toLowerCase();
        const data = lanyardTooltipMapLC[key];
        if (!data) return;
        const content = `<img src="${data.tooltipImage}"> ${data.tooltipText}`;
        debugLog("[PU:prepare] Register lanyard tooltip:", group.name, lanyardTooltipRegion);
        registerTooltip(
            lanyardTooltipRegion.x,
            lanyardTooltipRegion.y,
            lanyardTooltipRegion.width,
            lanyardTooltipRegion.height,
            content
        );
    });
}
