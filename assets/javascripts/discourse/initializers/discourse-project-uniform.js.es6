// discourse-project-uniform.js.es6

// Import Discourse plugin API helper
import { withPluginApi } from "discourse/lib/plugin-api";
// Import debug toggle/logger
import { debugLog, setAdminDebugFlag, isDebugEnabled, loadImageCached, setAssetCacheData } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-utils";
import { bootstrapPublicUniform } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-public";
import getURL from "discourse-common/lib/get-url";
// Import preparation/rendering pipeline
import { prepareAndRenderImages } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-prepare";
// Import award and tooltip data
import { awards, groupTooltipMapLC, csaRibbons } from "discourse/plugins/discourse-project-uniform/discourse/uniform-data";

let STATIC_ASSETS_PRELOADED = false;
let REQUEST_COUNTER = 0;
const USER_DATA_CACHE = new Map();
const USER_DATA_TTL_MS = 60 * 1000;
let BADGE_OBSERVER_CONTAINER = null;

function setPublicEmbedMode(enabled) {
    const active = !!enabled;
    document.body?.classList.toggle("pu-uniform-embed-mode", active);
    document.documentElement?.classList.toggle("pu-uniform-embed-mode", active);
}

function readCachedUserData(cacheKey) {
    const entry = USER_DATA_CACHE.get(cacheKey);
    if (!entry) return null;
    const now = Date.now();
    if (entry.data && entry.expiresAt > now) {
        return entry.data;
    }
    if (entry.expiresAt <= now) {
        USER_DATA_CACHE.delete(cacheKey);
    }
    return null;
}

function fetchUserData(cacheKey, usernameParam, fetchJson) {
    const now = Date.now();
    const existing = USER_DATA_CACHE.get(cacheKey);
    if (existing?.data && existing.expiresAt > now) {
        return Promise.resolve(existing.data);
    }
    if (existing?.promise && existing.expiresAt > now) {
        return existing.promise;
    }

    const promise = Promise.all([
        fetchJson(`/u/${usernameParam}.json`),
        fetchJson(`/user-badges/${usernameParam}.json`)
    ])
        .then(([userSummaryData, badgeData]) => {
            const data = { userSummaryData, badgeData };
            USER_DATA_CACHE.set(cacheKey, {
                data,
                expiresAt: Date.now() + USER_DATA_TTL_MS
            });
            return data;
        })
        .catch((error) => {
            USER_DATA_CACHE.delete(cacheKey);
            throw error;
        });

    USER_DATA_CACHE.set(cacheKey, {
        promise,
        expiresAt: now + USER_DATA_TTL_MS
    });

    return promise;
}

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
    BADGE_OBSERVER_CONTAINER = containerElement;
    updateBadgesForContainer(containerElement);
}

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

    const additional = containerElement.querySelector?.(".project-uniform-additional-quals");
    if (additional) {
        additional.remove();
        debugLog("[PU:init] Removed additional qualifications", { scoped: containerElement !== document });
    }

    const title = containerElement.querySelector?.(".project-uniform-title");
    if (title) {
        title.remove();
        debugLog("[PU:init] Removed uniform title", { scoped: containerElement !== document });
    }

    if (containerElement === document && BADGE_OBSERVER_CONTAINER?._puBadgeObserver) {
        BADGE_OBSERVER_CONTAINER._puBadgeObserver.disconnect();
        delete BADGE_OBSERVER_CONTAINER._puBadgeObserver;
        BADGE_OBSERVER_CONTAINER = null;
    }

    updateBadgesForContainer(containerElement);
}

function matchPublicUniformUrl(url) {
    if (!url) {
        return null;
    }
    try {
        const path = new URL(url, window.location.origin).pathname;
        const match = path.match(/\/uniform\/([^/]+)\/?$/i);
        if (match) {
            return decodeURIComponent(match[1]);
        }
    } catch { /* noop */ }
    return null;
}

function waitForElement(selector, timeoutMs = 2000) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(selector);
        if (existing) {
            return resolve(existing);
        }

        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) {
                observer.disconnect();
                resolve(el);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            reject(new Error("Element not found"));
        }, timeoutMs);
    });
}

function renderPublicUniform(username, site, siteSettings) {
    if (!username) {
        return;
    }

    const normalizedUsername = String(username).trim().toLowerCase();

    const enabled = !!siteSettings?.discourse_project_uniform_enabled;
    const publicEnabled = !!siteSettings?.discourse_project_uniform_public_enabled;
    if (!enabled || !publicEnabled) {
        waitForElement("#project-uniform-root", 5000)
            .then((root) => {
                root.textContent = "Public uniforms are disabled.";
            })
            .catch(() => {});
        return;
    }

    waitForElement("#project-uniform-root", 8000)
        .then((root) => {
            const cacheKey = site?.project_uniform_cache_key || "";
            const assetTokens = site?.project_uniform_asset_tokens || {};
            const encoded = encodeURIComponent(normalizedUsername);
            const tokenRequestId = String((Number(root.dataset.puPublicTokenRequestId || "0") || 0) + 1);
            root.dataset.puPublicTokenRequestId = tokenRequestId;

            root.dataset.username = normalizedUsername;
            root.dataset.cacheKey = cacheKey;
            root.dataset.assetTokens = JSON.stringify(assetTokens);

            const tokenUrl = getURL(`/uniform/${encoded}/token`);
            const snapshotEndpoint = getURL(`/uniform/${encoded}/snapshot`);

            fetch(tokenUrl, { credentials: "same-origin" })
                .then((response) => (response.ok ? response.json() : null))
                .then((payload) => {
                    root.dataset.snapshotEndpoint = snapshotEndpoint;
                    root.dataset.snapshotCacheKey = payload?.cache_key || cacheKey;
                    root.dataset.snapshotToken = payload?.token || "";
                })
                .catch(() => {
                    root.dataset.snapshotEndpoint = snapshotEndpoint;
                    root.dataset.snapshotCacheKey = cacheKey;
                    root.dataset.snapshotToken = "";
                })
                .finally(() => {
                    if (root.dataset.puPublicTokenRequestId === tokenRequestId) {
                        bootstrapPublicUniform(root);
                    }
                });
        })
        .catch(() => {
            const root = document.getElementById("project-uniform-root");
            if (root) {
                root.textContent = "Uniform container not available.";
            }
        });
}

export default {
    name: "discourse-project-uniform",
    initialize(container) {
        // Use the Discourse plugin API (min version 0.8.26)
        withPluginApi("0.8.26", (api) => {
            const siteSettings = container.lookup("site-settings:main");
            const site = container.lookup("site:main");
            setAssetCacheData({
                cacheKey: site?.project_uniform_cache_key,
                assetTokens: site?.project_uniform_asset_tokens
            });
            // Wire the admin setting into the utils runtime flag
            setAdminDebugFlag(!!siteSettings.discourse_project_uniform_debug_enabled);

            preloadStaticAssets();

            // Run logic on every page change
            api.onPageChange((url) => {
                debugLog("[PU:init] onPageChange URL:", url);

                const publicUsername = matchPublicUniformUrl(url);
                setPublicEmbedMode(!!publicUsername);
                if (publicUsername) {
                    debugLog("[PU:init] Public uniform route detected", publicUsername);
                    renderPublicUniform(publicUsername, site, siteSettings);
                    return;
                }

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

                const requestId = ++REQUEST_COUNTER;
                containerElement._puRequestId = requestId;
                containerElement._puLastRequestedUsername = username;

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

                const cacheKey = String(usernameParam || "");
                const cached = readCachedUserData(cacheKey);

                const userDataPromise = cached
                    ? Promise.resolve(cached)
                    : fetchUserData(cacheKey, usernameParam, fetchJson);

                // Fetch user summary and badge data (cached)
                userDataPromise
                    .then(({ userSummaryData, badgeData }) => {
                        if (containerElement._puRequestId !== requestId || !containerElement.isConnected) {
                            debugLog("[PU:init] Stale response ignored", { requestId, username });
                            return;
                        }

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

            const initialPublicUsername = matchPublicUniformUrl(window.location.href);
            setPublicEmbedMode(!!initialPublicUsername);
            if (initialPublicUsername) {
                debugLog("[PU:init] Initial public uniform route detected", initialPublicUsername);
                renderPublicUniform(initialPublicUsername, site, siteSettings);
            }
        });
    }
};
