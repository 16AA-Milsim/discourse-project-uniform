// pu-prepare.js

// Import data for backgrounds, ranks, groups, qualifications, and lanyards
import {
    backgroundImages, ranks, officerRanks, enlistedRanks,
    lanyardToImageMap, groupToImageMap, qualifications,
    lanyardTooltipRegion, lanyardTooltipMap
} from "discourse/plugins/discourse-project-uniform/discourse/uniform-data";
// Import render function
import { mergeImagesOnCanvas } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-render";
// Import tooltip helpers
import { clearTooltips, registerTooltip } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-tooltips";
// Import debug logging
import { debugLog } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-utils";

// Finds the highest-ranked name in `order` that is present in `have`
function highestIn(order, have) {
    for (let i = order.length - 1; i >= 0; i--) if (have.has(order[i])) return order[i];
}

// Main function to prepare image lists and trigger rendering
export function prepareAndRenderImages(groups, userBadges, idToBadge, container, awards, groupTooltipMap) {
    debugLog("[PU:prepare] start");
    clearTooltips(); // reset tooltips before rendering

    let bg = "";                   // background image URL
    const fgUrls = [];             // list of foreground image URLs
    const awardUrls = [];          // list of award ribbon image URLs
    const qualsToRender = [];      // list of qualification objects to render

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
            bg = backgroundImages.rafOfficer;
            debugLog("[PU:prepare] Background=RAF officer");
        } else if (highestRank.service === "RAF" && highestRank.category === "enlisted") {
            bg = backgroundImages.rafEnlisted;
            debugLog("[PU:prepare] Background=RAF enlisted");
        } else if (highestRank.category === "officer") {
            bg = backgroundImages.officer;
            debugLog("[PU:prepare] Background=BA officer");
        } else if (highestRank.category === "enlisted") {
            bg = backgroundImages.enlisted;
            debugLog("[PU:prepare] Background=BA enlisted");
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

    debugLog("[PU:prepare] Highest rank:", highestRank?.name || null);
    if (highestRank?.imageKey) fgUrls.push(highestRank.imageKey);

    // Add group images (always) and lanyards (BA only) for each group (case-insensitive keys)
    const toLcMap = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]));
    const groupToImageMapLC = toLcMap(groupToImageMap);
    const lanyardToImageMapLC = toLcMap(lanyardToImageMap);

    groups.forEach(g => {
        const key = lc(g.name);

        // Group crest/badge image (always allowed)
        const gi = groupToImageMapLC[key];
        if (gi) {
            fgUrls.push(gi);
            debugLog("[PU:prepare] Add group image:", g.name, gi);
        }

        // Lanyards: suppressed entirely when the uniform is RAF
        if (!isRAFUniform) {
            const li = lanyardToImageMapLC[key];
            if (li) {
                fgUrls.push(li);
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
    debugLog("[PU:prepare] Highest leadership:", highestLeadershipLC, "Highest marksmanship:", highestMarksmanshipLC);

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

        // Skip lower leadership/marksmanship badges
        if (isLeader && nameLC !== highestLeadershipLC) { debugLog("[PU:prepare] Skip (not highest leadership):", name); }
        if (isMarks && nameLC !== highestMarksmanshipLC) { debugLog("[PU:prepare] Skip (not highest marks):", name); }
        if ((isLeader && nameLC !== highestLeadershipLC) || (isMarks && nameLC !== highestMarksmanshipLC)) return;
        if ((isLeader && nameLC !== highestLeadershipLC) ||
            (isMarks && nameLC !== highestMarksmanshipLC) ||
            (isPilot && nameLC !== highestPilotLC)) {
            debugLog("[PU:prepare] Skip (not highest in pilot/leader/marks):", name);
            return;
        }

        // Add qualification image if allowed (case-insensitive restrictions)
        const restrictedLC = new Set((q?.restrictedRanks || []).map(lc));
        if (q?.imageKey && !restrictedLC.has(lc(highestRank?.name))) {
            if (nameLC === lc("CMT") && !is16CSMR) { debugLog("[PU:prepare] Skip CMT (not 16CSMR)"); }
            else {
                const service = highestRank?.service; // "BA" | "RAF"
                const chosenQualImage = (q.serviceVariants && q.serviceVariants[service]) || q.imageKey;
                fgUrls.push(chosenQualImage); debugLog("[PU:prepare] Add qualification image:", name, q.imageKey); qualsToRender.push(q);
            }
        } else if (restrictedLC.has(lc(highestRank?.name))) {
            debugLog("[PU:prepare] Skip qualification (restricted by rank):", name, "for", highestRank?.name);
        }

        // Add award ribbon image if present (case-insensitive match)
        const aw = awards.find(a => lc(a.name) === nameLC);
        if (aw?.imageKey) { awardUrls.push(aw.imageKey); debugLog("[PU:prepare] Add award ribbon:", name, aw.imageKey); }
    });

    // Filter out invalid foregrounds
    const validFg = fgUrls.filter(Boolean);
    debugLog("[PU:prepare] Summary before render:", { bg: !!bg, fgCount: validFg.length, awards: awardUrls.length, quals: qualsToRender.map(q => q.name) });

    // Only render if background and at least one foreground exist
    if (bg && validFg.length) {
        // Pass a case-insensitive tooltip map to the renderer
        const toLcTooltipMap = (obj) => Object.fromEntries(
            Object.entries(obj).flatMap(([k, v]) => [[k, v], [k.toLowerCase(), v]])
        );
    mergeImagesOnCanvas(
    container,
    bg,
    validFg,
    awardUrls.filter(Boolean),
    highestRank,
    qualsToRender,
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
        debugLog("[PU:prepare] Nothing to render – missing bg or no foregrounds");
    }
    debugLog("[PU:prepare] end");
}

// Registers tooltips for any lanyards the player has
function registerLanyardTooltips(groups) {
    groups.forEach(group => {
        const data = lanyardTooltipMap[group.name];
        if (!data) return;
        const content = `<img src="${data.tooltipImage}"> ${data.tooltipText}`;
        debugLog("[PU:prepare] Register lanyard tooltip:", group.name, lanyardTooltipRegion);
        registerTooltip(lanyardTooltipRegion.x, lanyardTooltipRegion.y, lanyardTooltipRegion.width, lanyardTooltipRegion.height, content);
    });
}
