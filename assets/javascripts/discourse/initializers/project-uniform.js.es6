// project-uniform.js.es6

// Import Discourse plugin API helper
import { withPluginApi } from "discourse/lib/plugin-api";
// Import debug toggle/logger
import { DEBUG_MODE, debugLog } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-utils";
// Import preparation/rendering pipeline
import { prepareAndRenderImages } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-prepare";
// Import award and tooltip data
import { awards, groupTooltipMap } from "discourse/plugins/discourse-project-uniform/discourse/uniform-data";

export default {
    name: "project-uniform",
    initialize(container) {
        // Use the Discourse plugin API (min version 0.8.26)
        withPluginApi("0.8.26", (api) => {
            const siteSettings = container.lookup("site-settings:main");

            // Run logic on every page change
            api.onPageChange((url) => {
                debugLog("[PU:init] onPageChange URL:", url);

                // Only run on user summary pages
                if (!(url && url.includes("/u/") && url.includes("/summary"))) {
                    debugLog("[PU:init] Not a user summary page – bail early");
                    return;
                }

                // Locate main content container
                const containerElement = document.querySelector(".user-content");
                if (!containerElement) {
                    debugLog("[PU:init] No .user-content container found");
                    return;
                }

                // Prevent duplicate rendering if placeholder already exists
                if (document.querySelector(".project-uniform-placeholder")) {
                    debugLog("[PU:init] Placeholder already present – avoiding duplicate render");
                    return;
                }

                // If admin-only mode is enabled, ensure current user is admin
                if (siteSettings.project_uniform_admin_only) {
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
                            badgeNames: userBadges.map(ub => idToBadge.get(ub.badge_id)?.name).filter(Boolean)
                        });

                        const badgeNames = userBadges.map(ub => idToBadge.get(ub.badge_id)?.name).filter(Boolean);
                        const existingInfo = containerElement.querySelector(".project-uniform-user-info");

                        // If debug mode is enabled, show group/badge text block above uniform
                        if (DEBUG_MODE) {
                            const info = existingInfo || document.createElement("div");
                            info.className = "project-uniform-user-info";
                            info.style.cssText = "text-align:center;margin-bottom:10px;";
                            info.innerHTML = `
                <p>Groups: ${groups.map(g => g.name).join(", ") || "None"}</p>
                <p>Badges: ${badgeNames.length ? badgeNames.join(", ") : "None"}</p>`;
                            if (!existingInfo) containerElement.prepend(info);
                        } else {
                            // Remove debug info block if it exists
                            existingInfo?.remove();
                        }

                        // Call render pipeline
                        debugLog("[PU:init] Calling prepareAndRenderImages...");
                        prepareAndRenderImages(groups, userBadges, idToBadge, containerElement, awards, groupTooltipMap);
                        debugLog("[PU:init] prepareAndRenderImages done");
                    })
                    .catch(e => debugLog("[PU:init] Error fetching user data:", e));
            });
        });
    }
};
