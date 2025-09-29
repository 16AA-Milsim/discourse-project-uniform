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
    csaRibbonGroupMapLC,
    csaLeadershipOverrideByRibbonCount,
    csaLeadershipQualificationNames,
    paraTooltipEnlisted,
    paraTooltipOfficer,
    paraCollarImageEnlisted,
    paraCollarImageOfficer
} from "discourse/plugins/discourse-project-uniform/discourse/uniform-data";

import { mergeImagesOnCanvas } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-render";
import { clearTooltips, registerTooltip } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-tooltips";
import { debugLog } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-utils";

const toLC = (value) => String(value || "").toLowerCase();
const startsWithDigit = (value) => /^\d/.test(String(value || ""));
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
const CTM_DEFAULT_PLACEMENT = Object.freeze({ x: 202, y: 222 });
const CTM_ROTATION_DEGREES = 3;
const CTM_LEADERSHIP_OFFSET_X = 30;

/**
 * Finds the highest-ranked name in `order` that is present in the provided set.
 */
function highestIn(order, have) {
    for (let i = order.length - 1; i >= 0; i--) if (have.has(order[i])) return order[i];
}

/**
 * Assembles all imagery for the supplied user state and triggers `mergeImagesOnCanvas`.
 */
export function prepareAndRenderImages(groups, userBadges, idToBadge, container, awards, groupTooltipLookup = groupTooltipMapLC) {
    debugLog("[PU:prepare] start");
    clearTooltips(); // reset tooltips before rendering
    const removeExistingCanvas = () => {
        if (!container?.querySelector) {
            return;
        }
        const existing = container.querySelector(".discourse-project-uniform-canvas");
        if (existing) {
            existing._teardownTooltips?.();
            existing.remove();
            debugLog("[PU:prepare] Removed existing canvas (early cleanup)");
        }
    };

    removeExistingCanvas();

    let bg = "";                        // background image URL (string)
    const foregroundItems = [];         // ALWAYS push objects: { url: string|array, x?, y? }
    const awardUrls = [];               // award ribbons (strings)
    const qualsToRender = [];           // qualification objects we’ll still pass to renderer (for tooltips)

    // Helper: always push as object so the renderer sees `.url`
    const pushFg = (urlOrArray, options) => {
        if (!urlOrArray) {
            return;
        }

        if (options && typeof options === "object") {
            const item = { url: urlOrArray };
            if (Number.isFinite(options.x)) {
                item.x = options.x;
            }
            if (Number.isFinite(options.y)) {
                item.y = options.y;
            }
            if (Number.isFinite(options.rotationDegrees)) {
                item.rotationDegrees = options.rotationDegrees;
            }
            foregroundItems.push(item);
        } else {
            foregroundItems.push({ url: urlOrArray });
        }
    };

    // Helpers for case-insensitive work
    const groupNameSetLC = new Set(groups.map(g => toLC(g.name)));
    const is16CSMR = ["16csmr", "16csmr_ic", "16csmr_2ic"].some(n => groupNameSetLC.has(n));
    const is7RHA = ["7rha", "7rha_ic", "7rha_2ic"].some(n => groupNameSetLC.has(n));

    const csaRibbonMembership = new Map();
    groups.forEach((group) => {
        const ribbon = csaRibbonGroupMapLC[toLC(group.name)];
        if (ribbon) {
            csaRibbonMembership.set(ribbon.name, ribbon);
        }
    });

    const csaRibbonsToRender = [...csaRibbonMembership.values()]
        .sort((a, b) => compareCsaNames(a.name, b.name))
        .slice(0, 3);
    const csaRibbonCount = csaRibbonsToRender.length;
    const hasCsaRibbons = csaRibbonCount > 0;
    const leadershipOverrideForCount = hasCsaRibbons
        ? (csaLeadershipOverrideByRibbonCount[csaRibbonCount] || csaLeadershipOverrideByRibbonCount.default)
        : null;

    // Badge name set (lowercased) the user has
    const badgeNameSetLC = new Set(
        userBadges.map(ub => toLC(idToBadge.get(ub.badge_id)?.name)).filter(Boolean)
    );
    const leadershipBadgeNameSetLC = new Set(
        [...badgeNameSetLC].map((name) => canonicalLeadershipName(name))
    );
    debugLog("[PU:prepare] Inputs:", { groups: groups.map(g => g.name), is16CSMR, badgeNames: [...badgeNameSetLC], csaRibbons: csaRibbonsToRender.map(r => r.name) });

    // Find highest rank first (case-insensitive)
    const highestRank = ranks.find(r => groupNameSetLC.has(toLC(r.name)));
    debugLog("[PU:prepare] Highest rank:", highestRank?.name || null);
    if (highestRank && toLC(highestRank.name) === "recruit") {
        debugLog("[PU:prepare] Recruit rank detected – skipping uniform render");
        removeExistingCanvas();
        return;
    }
    const isRAFUniform = highestRank?.service === "RAF";

    // Decide background from service + category, else fall back
    if (highestRank) {
        if (highestRank.service === "RAF" && highestRank.category === "officer") {
            bg = backgroundImages.rafOfficer; debugLog("[PU:prepare] Background=RAF officer");
        } else if (highestRank.service === "RAF" && highestRank.category === "enlisted") {
            bg = backgroundImages.rafEnlisted; debugLog("[PU:prepare] Background=RAF enlisted");
        } else if (highestRank.category === "officer") {
            bg = backgroundImages.officer; debugLog("[PU:prepare] Background=BA officer");
        } else if (highestRank.category === "enlisted") {
            bg = backgroundImages.enlisted; debugLog("[PU:prepare] Background=BA enlisted");
        }
    } else {
        // legacy fallback using group presence if no rank matched
        const officerRanksLC = officerRanks.map(toLC);
        const enlistedRanksLC = enlistedRanks.map(toLC);
        if ([...groupNameSetLC].some(n => officerRanksLC.includes(n))) {
            bg = backgroundImages.officer; debugLog("[PU:prepare] Background=BA officer (fallback)");
        } else if ([...groupNameSetLC].some(n => enlistedRanksLC.includes(n))) {
            bg = backgroundImages.enlisted; debugLog("[PU:prepare] Background=BA enlisted (fallback)");
        } else {
            debugLog("[PU:prepare] Background not determined (no rank match)");
        }
    }

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

    // Build adjusted qualification list with ribbon-row-specific tooltip boxes
    const adjustedQuals = qualsToRender.map((q) => {
        const rrAreas = q?.ribbonRowVariants?.ribbonRowTooltipAreas?.[ribbonRows];
        let clone = q;
        const ensureClone = () => {
            if (clone === q) {
                clone = { ...q };
            }
        };
        const setTooltipAreas = (areas = []) => {
            ensureClone();
            clone.tooltipAreas = areas.map((area) => ({ ...area }));
        };

        if (Array.isArray(rrAreas)) {
            setTooltipAreas(rrAreas);
        } else if (Array.isArray(q.tooltipAreas)) {
            setTooltipAreas(q.tooltipAreas);
        }

        const nameLC = toLC(q.name);
        const canonicalLC = canonicalLeadershipName(nameLC);
        const leadershipOverrideCandidate = leadershipOverrideForCount &&
            CSA_LEADERSHIP_NAMES.has(canonicalLC);
        const isCtm = CTM_NAME_SET.has(nameLC);

        if (leadershipOverrideCandidate && leadershipOverrideForCount?.tooltipAreas) {
            setTooltipAreas(leadershipOverrideForCount.tooltipAreas);
        }

        if (isCtm) {
            const baseAreas = clone?.tooltipAreas?.length
                ? clone.tooltipAreas
                : Array.isArray(q.tooltipAreas) ? q.tooltipAreas : [];
            if (baseAreas?.length) {
                const offsetX = hasLeadershipQual ? CTM_LEADERSHIP_OFFSET_X : 0;
                const offsetY = leadershipOverrideForCount?.imagePlacement?.y || 0;
                const shiftedAreas = baseAreas.map((area) => ({
                    ...area,
                    x: area.x + offsetX,
                    y: area.y + offsetY + (nameLC === toLC("CTM") ? 3 : 0),
                }));
                setTooltipAreas(shiftedAreas);
            }
        }

        return clone;
    });

    // Push qualification images into foregroundItems, using absolute coords for pilots only
    const service = highestRank?.service; // "BA" | "RAF"
    qualsToRender.forEach((q) => {
        const chosenUrl = (q.serviceVariants && q.serviceVariants[service]) || q.imageKey;

        // Pilot-only: absolute coords per ribbonRows, stored with the qual
        const pilotPos = q?.ribbonRowVariants?.imagePlacementByRows?.[ribbonRows];
        const nameLC = toLC(q.name);
        const canonicalLC = canonicalLeadershipName(nameLC);
        const leadershipOverrideActive = leadershipOverrideForCount &&
            CSA_LEADERSHIP_NAMES.has(canonicalLC);
        const isCtm = CTM_NAME_SET.has(nameLC);

        let finalPos = pilotPos ? { ...pilotPos } : null;
        if (!finalPos && leadershipOverrideActive && leadershipOverrideForCount?.imagePlacement) {
            finalPos = { ...leadershipOverrideForCount.imagePlacement };
        }

        if (isCtm) {
            if (!finalPos) {
                finalPos = { ...CTM_DEFAULT_PLACEMENT };
            }

            const offsetY = leadershipOverrideForCount?.imagePlacement?.y || 0;
            if (offsetY) {
                finalPos = { ...finalPos, y: finalPos.y + offsetY };
            }

            if (hasLeadershipQual) {
                finalPos = { ...finalPos, x: finalPos.x + CTM_LEADERSHIP_OFFSET_X };
            }

            if (nameLC === toLC("CTM")) {
                finalPos = { ...finalPos, y: finalPos.y + 2 };
            }
        }

        let pushOptions = finalPos ? { ...finalPos } : null;
        if (isCtm) {
            pushOptions = pushOptions ? { ...pushOptions } : {};
            pushOptions.rotationDegrees = CTM_ROTATION_DEGREES;
        }

        if (pushOptions) {
            pushFg(chosenUrl, pushOptions);
        } else {
            // Other quals: centered by renderer
            pushFg(chosenUrl);
        }

        debugLog("[PU:prepare] Add qualification image (post-awards):", q.name, finalPos || "(centered)");
    });

    // Render if a background exists; foregrounds are optional (e.g., Private/Gunner)
    if (bg) {
        // Swap CSA ribbon art if the current service has a dedicated variant.
        const csaRibbonsForService = csaRibbonsToRender.map((ribbon) => {
            const serviceKey = highestRank?.service;
            const variantImage = serviceKey ? ribbon?.serviceVariants?.[serviceKey] : null;
            if (variantImage && variantImage !== ribbon.imageKey) {
                return { ...ribbon, imageKey: variantImage };
            }
            return ribbon;
        });

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

/**
 * Registers tooltip hitboxes for any lanyards the user qualifies for.
 */
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
