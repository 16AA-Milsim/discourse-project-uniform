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
import { debugLog, puPaths, loadImageCached, applyAssetCacheParams, removeUniformCanvas } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-utils";

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
const leadershipOrderSetLC = new Set(leadershipOrderLC);
const marksmanshipOrderSetLC = new Set(marksmanshipOrderLC);
const pilotOrderSetLC = new Set(pilotOrderLC);
const additionalQualificationsOrder = Object.freeze([
    "CIC Phase 1",
    "CIC Phase 2",
    "Basic AT",
    "Machine Gunner",
    "Navigation",
    "3rd Class Marksman",
    "2nd Class Marksman",
    "1st Class Marksman",
    "Sharpshooter",
    "Sniper",
    "Basic Signals",
    "Advanced Signaller",
    "CTM",
    "CTM Bronze",
    "CTM Silver",
    "CTM Gold",
    "CMT",
    "Mortar Operator",
    "Mortar Line Commander",
    "Advanced AT",
    "Heavy Weapons Operator",
    "Forward Observer",
    "JTAC",
    "Paratrooper",
    "Freefaller",
    "Parachute Jump Instructor",
    "Pathfinder",
    "Junior Pilot",
    "Senior Pilot",
    "Apache Pilot Qualification",
    "FTCC",
    "CC",
    "SCBC",
    "PSBC",
    "PCBC",
    "ITC Instructor",
]);
const additionalQualificationsOrderMapLC = new Map(
    additionalQualificationsOrder.map((name, index) => [toLC(name), index])
);
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
const RESTRICTED_RANK_CACHE = new WeakMap();

const ANALOG_FONT_SPEC = Object.freeze({ family: "Analog", url: puPaths.font("ANALOG.TTF") });

// White chest patch name placement (tweak margins/rotation/scale here)
const RECRUIT_NAME_LAYOUT = Object.freeze({
    patchRect: Object.freeze({ x: 443, y: 143, width: 118, height: 62 }),
    marginLeft: 7,
    marginRight: 6,
    marginY: 4,
    rotationDegrees: -6,
    scaleX: 1,
    scaleY: 2,
    maxFontSize: 28,
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
    center: Object.freeze({ x: 658, y: 278 }),
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

function restrictedRankSetFor(qualification) {
    if (!qualification) {
        return null;
    }
    if (RESTRICTED_RANK_CACHE.has(qualification)) {
        return RESTRICTED_RANK_CACHE.get(qualification);
    }
    const set = new Set((qualification.restrictedRanks || []).map(toLC));
    RESTRICTED_RANK_CACHE.set(qualification, set);
    return set;
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

function preloadTooltipImages(urls, label = "tooltips") {
    const unique = new Set();
    (urls || []).forEach((url) => {
        if (!url) {
            return;
        }
        const resolved = applyAssetCacheParams(url);
        if (resolved) {
            unique.add(resolved);
        }
    });

    if (!unique.size) {
        return;
    }

    unique.forEach((url) => {
        loadImageCached(url).catch((e) => debugLog("[PU:prepare] Tooltip preload failed", { label, url, e }));
    });

    debugLog("[PU:prepare] Tooltip preload queued", { label, count: unique.size });
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

function collectQualificationBadges(userBadges, idToBadge) {
    const results = [];
    const seen = new Set();

    userBadges.forEach((ub) => {
        const badge = idToBadge.get(ub.badge_id);
        if (!badge?.name) {
            return;
        }
        const q = qualificationsByNameLC[toLC(badge.name)];
        if (!q || seen.has(q.name)) {
            return;
        }
        seen.add(q.name);
        results.push({ qual: q, label: badge.name });
    });

    return results;
}

function resolveHighestMarksmanshipNameLC(entries) {
    const marksmanshipNames = entries
        .map((entry) => toLC(entry?.qual?.name))
        .filter((name) => name && marksmanshipOrderSetLC.has(name));

    if (!marksmanshipNames.length) {
        return null;
    }

    const have = new Set(marksmanshipNames);
    return highestIn(marksmanshipOrderLC, have) || null;
}

function resolveHighestCommandNameLC(entries) {
    const commandNames = entries
        .map((entry) => canonicalLeadershipName(toLC(entry?.qual?.name)))
        .filter((name) => name && leadershipOrderSetLC.has(name));

    if (!commandNames.length) {
        return null;
    }

    const have = new Set(commandNames);
    return highestIn(leadershipOrderLC, have) || null;
}

function filterAdditionalQualificationOverrides(entries) {
    if (!entries?.length) {
        return [];
    }

    const byName = new Map(entries.map((entry) => [entry?.qual?.name, entry]));

    if (byName.has("Advanced AT")) {
        byName.delete("Basic AT");
    }

    if (byName.has("Advanced Signaller")) {
        byName.delete("Basic Signals");
    }

    const filtered = Array.from(byName.values());
    const highestCommandLC = resolveHighestCommandNameLC(filtered);
    if (!highestCommandLC) {
        return filtered;
    }

    return filtered.filter((entry) => {
        const nameLC = canonicalLeadershipName(toLC(entry?.qual?.name));
        if (!leadershipOrderSetLC.has(nameLC)) {
            return true;
        }
        return nameLC === highestCommandLC;
    });
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

function renderRecruitUniform(container, user, additionalQuals = [], options = {}) {
    const { showSupplementalPanels = true, enableTooltips = true } = options;
    const backgroundUrl = backgroundImages.recruit;
    if (!backgroundUrl) {
        debugLog("[PU:prepare] Recruit background unavailable");
        renderUniformTitle(container, null);
        renderAdditionalQualifications(container, null, []);
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
        {
            textOverlays,
            fonts: [ANALOG_FONT_SPEC],
            enableTooltips,
            onRendered: showSupplementalPanels
                ? (canvas) => {
                    renderUniformTitle(container, canvas);
                    renderAdditionalQualifications(container, canvas, additionalQuals);
                }
                : null,
        }
    );

    if (!showSupplementalPanels) {
        renderUniformTitle(container, null);
        renderAdditionalQualifications(container, null, []);
    }
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

function renderAdditionalQualifications(container, canvas, qualifications = []) {
    if (!container?.querySelector) {
        return;
    }

    const existing = container.querySelector(".project-uniform-additional-quals");
    if (existing) {
        existing._puResizeObserver?.disconnect?.();
        existing.remove();
    }

    const items = (qualifications || []).filter((entry) => entry?.qual);
    if (!items.length) {
        return;
    }

    const sorted = items.slice().sort((a, b) => {
        const aOrder = additionalQualificationsOrderMapLC.get(toLC(a?.qual?.name));
        const bOrder = additionalQualificationsOrderMapLC.get(toLC(b?.qual?.name));
        const aIndex = Number.isFinite(aOrder) ? aOrder : Number.MAX_SAFE_INTEGER;
        const bIndex = Number.isFinite(bOrder) ? bOrder : Number.MAX_SAFE_INTEGER;
        if (aIndex !== bIndex) {
            return aIndex - bIndex;
        }
        return String(a?.label || a?.qual?.name || "").localeCompare(
            String(b?.label || b?.qual?.name || ""),
            undefined,
            { sensitivity: "base" }
        );
    });

    const section = document.createElement("div");
    section.className = "project-uniform-additional-quals";

    const title = document.createElement("div");
    title.className = "project-uniform-additional-quals__title";
    title.textContent = "Additional Qualifications";
    section.appendChild(title);

    const list = document.createElement("div");
    list.className = "project-uniform-additional-quals__list";

    const tooltip = document.createElement("div");
    tooltip.className = "project-uniform-additional-quals__tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.setAttribute("aria-hidden", "true");
    section.appendChild(tooltip);

    const buildItem = (entry) => {
        const qual = entry.qual;
        const item = document.createElement("div");
        item.className = "project-uniform-additional-quals__item";
        item.dataset.qualLabel = entry?.label || qual?.name || "";

        const img = document.createElement("img");
        const url = applyAssetCacheParams(qual?.tooltipImage || qual?.imageKey);
        if (url) {
            img.src = url;
        }
        img.alt = entry?.label || qual?.name || "";
        img.loading = "lazy";
        img.decoding = "async";
        item.appendChild(img);

        const label = document.createElement("div");
        label.className = "project-uniform-additional-quals__label";
        label.textContent = entry?.label || qual?.name || "";
        item.appendChild(label);

        item.addEventListener("mouseenter", () => {
            const content = qual?.tooltipText || `<b>${item.dataset.qualLabel}</b>`;
            tooltip.innerHTML = content;
            tooltip.classList.add("visible");
            tooltip.setAttribute("aria-hidden", "false");
            item.classList.add("is-tooltip-active");

            tooltip.style.visibility = "hidden";
            tooltip.style.left = "0px";
            tooltip.style.top = "0px";

            const sectionRect = section.getBoundingClientRect();
            const itemRect = item.getBoundingClientRect();
            const labelRect = label.getBoundingClientRect();
            const tipW = tooltip.offsetWidth;
            const tipH = tooltip.offsetHeight;
            const gap = 8;

            let left = itemRect.left - sectionRect.left + itemRect.width / 2 - tipW / 2;
            let top = labelRect.top - sectionRect.top - 2;
            if (!Number.isFinite(top)) {
                top = itemRect.bottom - sectionRect.top + gap;
            }

            if (left + tipW > sectionRect.width) {
                left = Math.max(0, sectionRect.width - tipW);
            }
            if (left < 0) {
                left = 0;
            }

            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
            tooltip.style.visibility = "";
        });

        item.addEventListener("mouseleave", () => {
            tooltip.classList.remove("visible");
            tooltip.setAttribute("aria-hidden", "true");
            item.classList.remove("is-tooltip-active");
        });

        return item;
    };
    const itemNodes = sorted.map(buildItem);
    let lastLayoutKey = "";
    let layoutScheduled = false;

    const layoutRows = () => {
        const total = itemNodes.length;
        if (!total) {
            list.replaceChildren();
            lastLayoutKey = "";
            return;
        }

        const itemWidth = 110;
        const columnGap = 12;
        const availableWidth = section.clientWidth || 0;
        if (!availableWidth) {
            return;
        }

        const maxColumns = Math.max(1, Math.floor((availableWidth + columnGap) / (itemWidth + columnGap)));
        const rows = Math.max(1, Math.ceil(total / maxColumns));
        const baseCount = Math.floor(total / rows);
        const remainder = total % rows;
        const layoutKey = `${rows}:${baseCount}:${remainder}`;

        if (layoutKey === lastLayoutKey) {
            return;
        }
        lastLayoutKey = layoutKey;

        list.replaceChildren();
        let index = 0;
        for (let row = 0; row < rows; row++) {
            const count = baseCount + (row < remainder ? 1 : 0);
            const rowEl = document.createElement("div");
            rowEl.className = "project-uniform-additional-quals__row";
            for (let i = 0; i < count; i++) {
                const node = itemNodes[index++];
                if (!node) break;
                rowEl.appendChild(node);
            }
            list.appendChild(rowEl);
        }
    };

    const scheduleLayout = () => {
        if (layoutScheduled) {
            return;
        }
        layoutScheduled = true;
        requestAnimationFrame(() => {
            layoutScheduled = false;
            layoutRows();
        });
    };

    section.appendChild(list);

    if (canvas?.parentNode === container && typeof canvas.after === "function") {
        canvas.after(section);
    } else {
        container.appendChild(section);
    }

    scheduleLayout();

    if (window.ResizeObserver) {
        const observer = new ResizeObserver(() => scheduleLayout());
        observer.observe(section);
        section._puResizeObserver = observer;
    }
}

function renderUniformTitle(container, canvas) {
    if (!container?.querySelector) {
        return;
    }

    const existing = container.querySelector(".project-uniform-title");
    if (existing) {
        existing.remove();
    }

    if (!canvas) {
        return;
    }

    const title = document.createElement("div");
    title.className = "project-uniform-title";
    title.textContent = "Uniform";

    if (typeof canvas.before === "function") {
        canvas.before(title);
    } else {
        container.prepend(title);
    }
}

function collectTooltipUrls({
    highestRank,
    groups,
    groupTooltipLookup,
    isRAFUniform,
    is16CSMR,
    is7RHA,
    adjustedQuals,
    csaRibbonsToRender,
    awardTooltipImages,
}) {
    const tooltipUrls = new Set();
    if (highestRank?.tooltipImage) {
        tooltipUrls.add(highestRank.tooltipImage);
    }
    groups.forEach((group) => {
        const key = String(group?.name || "").toLowerCase();
        const groupTip = typeof groupTooltipLookup?.get === "function"
            ? groupTooltipLookup.get(key) || groupTooltipLookup.get(group?.name) || null
            : groupTooltipLookup?.[key] || groupTooltipLookup?.[group?.name] || null;
        if (groupTip?.tooltipImage) {
            tooltipUrls.add(groupTip.tooltipImage);
        }
        const lanyardTip = lanyardTooltipMapLC[key];
        if (!isRAFUniform && lanyardTip?.tooltipImage) {
            tooltipUrls.add(lanyardTip.tooltipImage);
        }
    });
    if (!isRAFUniform && !is16CSMR && !is7RHA) {
        const paraTooltip = highestRank?.category === "officer"
            ? paraTooltipOfficer
            : paraTooltipEnlisted;
        if (paraTooltip?.tooltipImage) {
            tooltipUrls.add(paraTooltip.tooltipImage);
        }
    }
    adjustedQuals.forEach((qual) => {
        if (qual?.tooltipImage) {
            tooltipUrls.add(qual.tooltipImage);
        }
    });
    csaRibbonsToRender.forEach((ribbon) => {
        if (ribbon?.tooltipImage) {
            tooltipUrls.add(ribbon.tooltipImage);
        }
    });
    awardTooltipImages.forEach((url) => tooltipUrls.add(url));
    return tooltipUrls;
}

// Assembles all imagery for the supplied user state and triggers canvas rendering.
export function prepareAndRenderImages(groups, userBadges, idToBadge, container, awards, groupTooltipLookup = groupTooltipMapLC, user = null, options = {}) {
    debugLog("[PU:prepare] start");
    clearTooltips();
    removeUniformCanvas(container, "PU:prepare");
    const showSupplementalPanels = options?.showSupplementalPanels !== false;
    const enableTooltips = options?.enableTooltips !== false;

    const foregroundItems = [];         // ALWAYS push objects: { url: string|array, x?, y? }
    const awardUrls = [];               // award ribbons (strings)
    const awardTooltipImages = [];      // award tooltip images
    const qualsToRender = [];           // qualification objects we’ll still pass to renderer (for tooltips)

    const pushFg = createForegroundAdder(foregroundItems);

    const { groupNameSetLC, is16CSMR, is7RHA } = buildGroupContext(groups);
    const { badgeNames, badgeNameSetLC, leadershipBadgeNameSetLC } = buildBadgeContext(userBadges, idToBadge);
    const allQualifications = collectQualificationBadges(userBadges, idToBadge);
    const { ribbonsToRender: csaRibbonsToRender, count: csaRibbonCount, leadershipOverrideForCount } = buildCsaContext(groups);

    debugLog("[PU:prepare] Inputs:", { groups: groups.map(g => g.name), is16CSMR, badgeNames, csaRibbons: csaRibbonsToRender.map(r => r.name) });

    const highestRank = resolveHighestRank(groupNameSetLC);
    debugLog("[PU:prepare] Highest rank:", highestRank?.name || null);
    if (isRecruitRank(highestRank)) {
        renderRecruitUniform(container, user || {}, allQualifications, {
            showSupplementalPanels,
            enableTooltips,
        });
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
        if (is16CSMR && marksmanshipOrderSetLC.has(nameLC)) {
            debugLog("[PU:prepare] Skip (16CSMR rule):", name);
            return;
        }

        const q = qualificationsByNameLC[nameLC];
        const isLeader = leadershipOrderSetLC.has(canonicalNameLC);
        const isMarks = marksmanshipOrderSetLC.has(nameLC);
        const isPilot = pilotOrderSetLC.has(nameLC);
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
        const restrictedLC = restrictedRankSetFor(q);
        if (q?.imageKey && !restrictedLC?.has(highestRankLC)) {
            if (nameLC === cmtKeyLC && !is16CSMR) {
                debugLog("[PU:prepare] Skip CMT (not 16CSMR)");
            } else {
                qualsToRender.push(q);
                debugLog("[PU:prepare] Queue qualification:", name);
            }
        } else if (restrictedLC?.has(highestRankLC)) {
            debugLog("[PU:prepare] Skip qualification (restricted by rank):", name, "for", highestRank?.name);
        }

        // Add award ribbon image if present (case-insensitive)
        const aw = awardsByNameLC[nameLC] || awards?.find?.(a => toLC(a.name) === nameLC);
        if (aw?.imageKey) {
            awardUrls.push(aw.imageKey);
            debugLog("[PU:prepare] Add award ribbon:", name, aw.imageKey);
        }
        if (aw?.tooltipImage || aw?.imageKey) {
            awardTooltipImages.push(aw.tooltipImage || aw.imageKey);
        }
    });

    // Determine ribbon row count and adjust qualification tooltips accordingly
    const perRowCapacity = 4;
    const maxRibbonRows = 3;
    const clampedAwards = Math.min(awardUrls.length, perRowCapacity * maxRibbonRows);
    const ribbonRows = clampedAwards === 0 ? 0 : Math.ceil(clampedAwards / perRowCapacity);
    const hasLeadershipQual = qualsToRender.some((qual) =>
        leadershipOrderSetLC.has(canonicalLeadershipName(toLC(qual.name)))
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
    const renderedQualNames = new Set(qualsToRender.map((qual) => qual?.name).filter(Boolean));
    const highestMarksmanshipAdditionalLC = resolveHighestMarksmanshipNameLC(allQualifications);
    const additionalQuals = filterAdditionalQualificationOverrides(
        allQualifications
        .filter((entry) => !renderedQualNames.has(entry.qual.name))
        .filter((entry) => {
            const nameLC = toLC(entry?.qual?.name);
            if (!nameLC || !marksmanshipOrderSetLC.has(nameLC)) {
                return true;
            }
            return highestMarksmanshipAdditionalLC ? nameLC === highestMarksmanshipAdditionalLC : true;
        })
    );

    qualsToRender.forEach((q) => {
        const adjustedQual = adjustedQualMap.get(q) || q;
        const chosenUrl = (q.serviceVariants && q.serviceVariants[service]) || q.imageKey;

        const placementByRows = q?.ribbonRowVariants?.imagePlacementByRows;
        const pilotPos = placementByRows?.[ribbonRows] || placementByRows?.default || placementByRows?.all;
        const nameLC = toLC(q.name);
        const canonicalLC = canonicalLeadershipName(nameLC);
        const isLeader = leadershipOrderSetLC.has(canonicalLC);
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

    // Preload tooltip imagery for the active uniform so hover images render instantly.
    const tooltipUrls = collectTooltipUrls({
        highestRank,
        groups,
        groupTooltipLookup,
        isRAFUniform,
        is16CSMR,
        is7RHA,
        adjustedQuals,
        csaRibbonsToRender,
        awardTooltipImages,
    });
    preloadTooltipImages([...tooltipUrls], "uniform-tooltips");

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
            csaRibbonsForService,
            {
                enableTooltips,
                onRendered: showSupplementalPanels
                    ? (canvas) => {
                        renderUniformTitle(container, canvas);
                        renderAdditionalQualifications(container, canvas, additionalQuals);
                    }
                    : null
            }
        );

        if (!showSupplementalPanels) {
            renderUniformTitle(container, null);
            renderAdditionalQualifications(container, null, []);
        }

        // Only register lanyard tooltips for BA uniforms
        if (enableTooltips && !isRAFUniform) {
            if (!is16CSMR && !is7RHA) {
                const paraTooltip = highestRank?.category === "officer"
                    ? paraTooltipOfficer
                    : paraTooltipEnlisted;
                registerCollarTooltip(paraTooltip);
            }
            registerLanyardTooltips(groups);
        } else if (enableTooltips) {
            debugLog("[PU:prepare] RAF uniform – skipping lanyard tooltips");
        }
    } else {
        debugLog("[PU:prepare] Nothing to render – missing bg");
        renderUniformTitle(container, null);
        renderAdditionalQualifications(container, null, []);
    }
}

// Registers tooltip hitboxes covering the collar insignia region.
function registerCollarTooltip(tooltip) {
    if (!tooltip?.tooltipAreas?.length) {
        return;
    }
    const imageUrl = applyAssetCacheParams(tooltip.tooltipImage);
    const content = `${imageUrl ? `<img src="${imageUrl}"> ` : ""}${tooltip.tooltipText || ""}`;
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
        const imageUrl = applyAssetCacheParams(data.tooltipImage);
        const content = `${imageUrl ? `<img src="${imageUrl}"> ` : ""}${data.tooltipText || ""}`;
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
