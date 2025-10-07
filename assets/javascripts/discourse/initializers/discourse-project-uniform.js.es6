// discourse-project-uniform.js.es6

// Import Discourse plugin API helper
import { withPluginApi } from "discourse/lib/plugin-api";
// Import debug toggle/logger
import { debugLog, setAdminDebugFlag, isDebugEnabled, loadImageCached } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-utils";
// Import preparation/rendering pipeline
import { prepareAndRenderImages } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-prepare";
// Import award and tooltip data
import { awards, groupTooltipMapLC, csaRibbons } from "discourse/plugins/discourse-project-uniform/discourse/uniform-data";

let STATIC_ASSETS_PRELOADED = false;

function toggleBadgesSection(hidden) {
    const badges = document.querySelector?.(".top-section.badges-section") || document.querySelector?.(".top-section .badges-section");
    if (!badges) {
        return;
    }
    if (badges.dataset.puOriginalDisplay === undefined) {
        badges.dataset.puOriginalDisplay = badges.style.display || "";
    }
    badges.style.display = hidden ? "none" : badges.dataset.puOriginalDisplay;
}

function updateBadgesForContainer(containerElement) {
    const hasCanvas = !!containerElement?.querySelector?.(".discourse-project-uniform-canvas");
    toggleBadgesSection(hasCanvas);
}

function ensureBadgeObserver(containerElement) {
    if (!containerElement || containerElement._puBadgeObserver) {
        updateBadgesForContainer(containerElement);
        return;
    }
    const observer = new MutationObserver(() => updateBadgesForContainer(containerElement));
    observer.observe(containerElement, { childList: true, subtree: true });
    containerElement._puBadgeObserver = observer;
    updateBadgesForContainer(containerElement);
}

function ensureUniformPlaceholder() {}

function preloadStaticAssets() {
    if (STATIC_ASSETS_PRELOADED) {
        return;
    }
    STATIC_ASSETS_PRELOADED = true;

    try {
        const urls = new Set();
        awards.forEach((award) => {
            award?.imageKey && urls.add(award.imageKey);
            award?.tooltipImage && urls.add(award.tooltipImage);
        });
        csaRibbons.forEach((ribbon) => {
            ribbon?.imageKey && urls.add(ribbon.imageKey);
            ribbon?.tooltipImage && urls.add(ribbon.tooltipImage);
        });

        urls.forEach((url) => {
            loadImageCached(url).catch((e) => debugLog("[PU:init] Preload failed", url, e));
        });
        debugLog("[PU:init] Preloaded static assets", urls.size);
    } catch (e) {
        debugLog("[PU:init] Asset preload error", e);
    }
}

function tearDownExistingUniform(containerElement = document) {
    const canvas = containerElement.querySelector?.(".discourse-project-uniform-canvas");
    if (canvas) {
        canvas._teardownTooltips?.();
        canvas.remove();
        debugLog("[PU:init] Removed existing canvas", { scoped: containerElement !== document });
    }

    const placeholder = containerElement.querySelector?.(".discourse-project-uniform-placeholder");
    if (placeholder) {
        placeholder.remove();
        debugLog("[PU:init] Removed existing placeholder", { scoped: containerElement !== document });
    }

    updateBadgesForContainer(containerElement);
}

export default {
    name: "discourse-project-uniform",
    initialize(container) {
        // Use the Discourse plugin API (min version 0.8.26)
        withPluginApi("0.8.26", (api) => {
            const siteSettings = container.lookup("site-settings:main");
            // Wire the admin setting into the utils runtime flag
            setAdminDebugFlag(!!siteSettings.discourse_project_uniform_debug_enabled);

            preloadStaticAssets();

            // Run logic on every page change
            api.onPageChange((url) => {
                debugLog("[PU:init] onPageChange URL:", url);

                // Only run on user summary pages
                if (!(url && url.includes("/u/") && url.includes("/summary"))) {
                    debugLog("[PU:init] Not a user summary page – bail early");
                    tearDownExistingUniform();
                    return;
                }

                // Locate main content container
                const containerElement = document.querySelector(".user-content");
                if (!containerElement) {
                    debugLog("[PU:init] No .user-content container found");
                    tearDownExistingUniform();
                    return;
                }

                ensureBadgeObserver(containerElement);

                // If admin-only mode is enabled, ensure current user is admin
                if (siteSettings.discourse_project_uniform_adminvisibility_only_enabled) {
                    const currentUser = api.getCurrentUser();
                    const allowed = !!(currentUser && currentUser.admin);
                    debugLog("[PU:init] Admin-only mode:", { currentUser: currentUser?.username, allowed });
                    if (!allowed) return;
                }

                // Extract username (prefer controller:user, fallback to URL)
                let username = null;
                let extractionMethod = null;

                try {
                    // Try controller:user first (works on this instance)
                    const userCtrl = container.lookup?.("controller:user");
                    if (userCtrl?.model?.username) {
                        username = userCtrl.model.username;
                        extractionMethod = "controller:user";
                    }
                } catch { /* noop */ }

                if (!username) {
                    // Fallback: parse from URL
                    const path = new URL(url, window.location.origin).pathname;
                    const m = path.match(/\/u\/([^/]+)\/summary\/?$/i);
                    if (m) {
                        username = decodeURIComponent(m[1]);
                        extractionMethod = "URL fallback";
                    }
                }

                if (!username) {
                    debugLog("[PU:init] Could not determine username from page");
                    return;
                }

                debugLog(`[PU:init] Extracted username via ${extractionMethod}:`, username);
                const usernameParam = encodeURIComponent(String(username).trim().toLowerCase());

                if (containerElement._puLastUsername && containerElement._puLastUsername !== username) {
                    debugLog("[PU:init] Detected different user – clearing existing uniform", {
                        previous: containerElement._puLastUsername,
                        next: username,
                    });
                    tearDownExistingUniform(containerElement);
                    containerElement._puLastRenderSignature = null;
                }

                // Helper function to fetch JSON with debug logging
                const fetchJson = (u) => {
                    debugLog("[PU:init][fetch:BEGIN]", u);
                    return fetch(u)
                        .then(r => {
                            if (!r.ok) {
                                debugLog("[PU:init][fetch:ERR]", u, r.status, r.statusText);
                                throw new Error(r.statusText);
                            }
                            return r.json();
                        })
                        .then(j => { debugLog("[PU:init][fetch:OK]", u); return j; });
                };

                // Fetch user summary and badge data
                Promise.all([
                    fetchJson(`/u/${usernameParam}.json`),
                    fetchJson(`/user-badges/${usernameParam}.json`)
                ])
                    .then(([userSummaryData, badgeData]) => {
                        const ok = !!(userSummaryData?.user && badgeData?.user_badges);
                        debugLog("[PU:init] Fetched payloads ok:", ok);
                        if (!ok) return;

                        // Extract groups, badges, and mapping of badge IDs
                        const groups = userSummaryData.user.groups || [];
                        const idToBadge = new Map((badgeData.badges || []).map(b => [b.id, b]));
                        const userBadges = badgeData.user_badges || [];

                        debugLog("[PU:init] User snapshot:", {
                            groups: groups.map(g => g.name),
                            badgeCount: userBadges.length,
                            badgeNames: userBadges.map(ub => idToBadge.get(ub.badge_id)?.name).filter(Boolean),
                            displayName: (userSummaryData.user?.name || "").trim() || (userSummaryData.user?.username || "").trim(),
                            recruitNumber: userSummaryData.user?.project_uniform_recruit_number || null
                        });

                        const badgeNames = userBadges.map(ub => idToBadge.get(ub.badge_id)?.name).filter(Boolean);
                        const existingInfo = containerElement.querySelector(".discourse-project-uniform-user-info");

                        // If debug mode is enabled, show group/badge text block above uniform
                        if (isDebugEnabled()) {
                            const info = existingInfo || document.createElement("div");
                            info.className = "discourse-project-uniform-user-info";
                            info.style.cssText = "text-align:center;margin-bottom:10px;";
                            info.innerHTML = `
                <p>Groups: ${groups.map(g => g.name).join(", ") || "None"}</p>
                <p>Badges: ${badgeNames.length ? badgeNames.join(", ") : "None"}</p>`;
                            if (!existingInfo) containerElement.prepend(info);
                        } else {
                            // Remove debug info block if it exists
                            existingInfo?.remove();
                        }

                        const userRecord = userSummaryData.user;
                        const displayName = (userRecord?.name || "").trim() || (userRecord?.username || "").trim();
                        const recruitNumber = userRecord?.project_uniform_recruit_number || null;

                        const signature = JSON.stringify({
                            groups: groups.map(g => g.name).sort(),
                            badges: userBadges.map(ub => ub.badge_id).sort((a, b) => a - b),
                            displayName,
                            recruitNumber,
                        });

                        if (containerElement._puLastRenderSignature === signature) {
                            debugLog("[PU:init] Render skipped; signature unchanged");
                            return;
                        }

                        tearDownExistingUniform(containerElement);

                        // Call render pipeline
                        debugLog("[PU:init] Calling prepareAndRenderImages...");
                        prepareAndRenderImages(groups, userBadges, idToBadge, containerElement, awards, groupTooltipMapLC, userRecord);
                        containerElement._puLastRenderSignature = signature;
                        containerElement._puLastUsername = username;
                        updateBadgesForContainer(containerElement);
                        debugLog("[PU:init] prepareAndRenderImages done");
                    })
                    .catch(e => debugLog("[PU:init] Error fetching user data:", e));
            });
        });
    }
};
