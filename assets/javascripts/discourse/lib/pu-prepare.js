/**
 * Prepares data for Project Uniform rendering. Selects the correct background, gathers
 * foreground overlays, resolves qualification and award imagery, and registers tooltips
 * before delegating to the canvas renderer.
 */
import {
    backgroundImages, ranks, officerRanks, enlistedRanks,
    lanyardToImageMap, groupToImageMap, qualifications,
    lanyardTooltipRegion, lanyardTooltipMap
} from "discourse/plugins/discourse-project-uniform/discourse/uniform-data";

import { mergeImagesOnCanvas } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-render";
import { clearTooltips, registerTooltip } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-tooltips";
import { debugLog } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-utils";

const lanyardTooltipMapLC = Object.fromEntries(
    Object.entries(lanyardTooltipMap).map(([k, v]) => [k.toLowerCase(), v])
);

/**
 * Finds the highest-ranked name in `order` that is present in the provided set.
 */
function highestIn(order, have) {
    for (let i = order.length - 1; i >= 0; i--) if (have.has(order[i])) return order[i];
}

/**
 * Assembles all imagery for the supplied user state and triggers `mergeImagesOnCanvas`.
 */
export function prepareAndRenderImages(groups, userBadges, idToBadge, container, awards, groupTooltipMap) {
    debugLog("[PU:prepare] start");
    clearTooltips(); // reset tooltips before rendering

    let bg = "";                        // background image URL (string)
    const foregroundItems = [];         // ALWAYS push objects: { url: string|array, x?, y? }
    const awardUrls = [];               // award ribbons (strings)
    const qualsToRender = [];           // qualification objects we’ll still pass to renderer (for tooltips)

    // Helper: always push as object so the renderer sees `.url`
    const pushFg = (urlOrArray, pos) => {
        if (!urlOrArray) return;
        if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
            foregroundItems.push({ url: urlOrArray, x: pos.x, y: pos.y });
        } else {
            foregroundItems.push({ url: urlOrArray });
        }
    };

    // Helpers for case-insensitive work
    const lc = (s) => String(s || "").toLowerCase();
    const groupNameSetLC = new Set(groups.map(g => lc(g.name)));
    const is16CSMR = ["16csmr", "16csmr_ic", "16csmr_2ic"].some(n => groupNameSetLC.has(n));

    // Badge name set (lowercased) the user has
    const badgeNameSetLC = new Set(
        userBadges.map(ub => lc(idToBadge.get(ub.badge_id)?.name)).filter(Boolean)
    );
    debugLog("[PU:prepare] Inputs:", { groups: groups.map(g => g.name), is16CSMR, badgeNames: [...badgeNameSetLC] });

    // Find highest rank first (case-insensitive)
    const highestRank = ranks.find(r => groupNameSetLC.has(lc(r.name)));
    debugLog("[PU:prepare] Highest rank:", highestRank?.name || null);
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
        const officerRanksLC = officerRanks.map(lc);
        const enlistedRanksLC = enlistedRanks.map(lc);
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

    // Add group images and lanyards (BA only), using case-insensitive maps
    const toLcMap = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]));
    const groupToImageMapLC = toLcMap(groupToImageMap);
    const lanyardToImageMapLC = toLcMap(lanyardToImageMap);

    groups.forEach(g => {
        const key = lc(g.name);

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

    // Determine highest leadership and marksmanship badges (case-insensitive)
    const leadershipOrder = ["FTCC", "SCBC", "PSBC", "PCBC"];
    const leadershipOrderLC = leadershipOrder.map(lc);
    const highestLeadershipLC = highestIn(leadershipOrderLC, badgeNameSetLC);

    const marksmanshipOrder = ["1st Class Marksman", "Sharpshooter", "Sniper"];
    const marksmanshipOrderLC = marksmanshipOrder.map(lc);
    const highestMarksmanshipLC = highestIn(marksmanshipOrderLC, badgeNameSetLC);

    // Pilot quals: prefer Senior over Junior if both present
    const pilotOrder = ["Junior Pilot", "Senior Pilot"];
    const pilotOrderLC = pilotOrder.map(lc);
    const highestPilotLC = highestIn(pilotOrderLC, badgeNameSetLC);

    // Process each badge for qualifications and awards
    userBadges.forEach(ub => {
        const badge = idToBadge.get(ub.badge_id); if (!badge) return;
        const name = badge.name;
        const nameLC = lc(name);

        // Skip certain marksmanship badges for 16CSMR
        if (is16CSMR && marksmanshipOrderLC.includes(nameLC)) {
            debugLog("[PU:prepare] Skip (16CSMR rule):", name);
            return;
        }

        const q = qualifications.find(q => lc(q.name) === nameLC);
        const isLeader = leadershipOrderLC.includes(nameLC);
        const isMarks = marksmanshipOrderLC.includes(nameLC);
        const isPilot = pilotOrderLC.includes(nameLC);

        // Skip lower leadership/marksmanship/pilot badges
        if ((isLeader && nameLC !== highestLeadershipLC) ||
            (isMarks && nameLC !== highestMarksmanshipLC) ||
            (isPilot && nameLC !== highestPilotLC)) {
            debugLog("[PU:prepare] Skip (not highest in pilot/leader/marks):", name);
            return;
        }

        // Add qualification if allowed (check rank restrictions)
        const restrictedLC = new Set((q?.restrictedRanks || []).map(lc));
        if (q?.imageKey && !restrictedLC.has(lc(highestRank?.name))) {
            if (nameLC === lc("CMT") && !is16CSMR) {
                debugLog("[PU:prepare] Skip CMT (not 16CSMR)");
            } else {
                qualsToRender.push(q);
                debugLog("[PU:prepare] Queue qualification:", name);
            }
        } else if (restrictedLC.has(lc(highestRank?.name))) {
            debugLog("[PU:prepare] Skip qualification (restricted by rank):", name, "for", highestRank?.name);
        }

        // Add award ribbon image if present (case-insensitive)
        const aw = awards.find(a => lc(a.name) === nameLC);
        if (aw?.imageKey) {
            awardUrls.push(aw.imageKey);
            debugLog("[PU:prepare] Add award ribbon:", name, aw.imageKey);
        }
    });

    // Determine ribbon row count and adjust qualification tooltips accordingly
    const totalAwards = awardUrls.length;
    const ribbonRows = totalAwards === 0 ? 0 : totalAwards <= 4 ? 1 : 2;

    // Build adjusted qualification list with ribbon-row-specific tooltip boxes
    const adjustedQuals = qualsToRender.map((q) => {
        const rrAreas =
            q?.ribbonRowVariants?.ribbonRowTooltipAreas?.[ribbonRows];
        return rrAreas ? { ...q, tooltipAreas: rrAreas } : q;
    });

    // Push qualification images into foregroundItems, using absolute coords for pilots only
    const service = highestRank?.service; // "BA" | "RAF"
    qualsToRender.forEach((q) => {
        const chosenUrl = (q.serviceVariants && q.serviceVariants[service]) || q.imageKey;

        // Pilot-only: absolute coords per ribbonRows, stored with the qual
        const pilotPos = q?.ribbonRowVariants?.imagePlacementByRows?.[ribbonRows];
        if (pilotPos) {
            pushFg(chosenUrl, pilotPos);
        } else {
            // Other quals: centered by renderer
            pushFg(chosenUrl);
        }

        debugLog("[PU:prepare] Add qualification image (post-awards):", q.name, pilotPos || "(centered)");
    });

    // Render if a background exists; foregrounds are optional (e.g., Private/Gunner)
    if (bg) {
        const toLcTooltipMap = (obj) =>
            Object.fromEntries(Object.entries(obj).flatMap(([k, v]) => [[k, v], [k.toLowerCase(), v]]));

        mergeImagesOnCanvas(
            container,
            bg,
            foregroundItems,           // every item is an object with a `.url` (and maybe x,y)
            awardUrls.filter(Boolean),
            highestRank,
            adjustedQuals,
            groups,
            toLcTooltipMap(groupTooltipMap)
        );

        // Only register lanyard tooltips for BA uniforms
        if (!isRAFUniform) {
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
