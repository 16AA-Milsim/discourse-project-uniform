/**
 * Shared utilities for Project Uniform rendering. Handles debug toggles, path helpers,
 * lightweight image caching, and geometry math used by the canvas pipeline.
 */

export const DEBUG_MODE = false; // if true here, admin setting is ignored and debug is always on

// Runtime override from admin setting (mutable, set at boot by initializer)
let ADMIN_DEBUG_FLAG = false;

// Allows the initializer to provide the admin-controlled debug flag.
export function setAdminDebugFlag(value) {
    ADMIN_DEBUG_FLAG = !!value;
}

// Returns the effective debug state using both the code toggle and admin override.
export function isDebugEnabled() {
    return !!DEBUG_MODE || ADMIN_DEBUG_FLAG;
}

// Logs debug messages to the browser console if effective debug is enabled.
export function debugLog(...args) {
    if (!isDebugEnabled()) return;
    const ts = new Date().toISOString();
    // Use console.debug so it only shows when “Verbose” is enabled in devtools
    console.debug(`[ProjectUniform ${ts}]`, ...args);
}

// Removes the uniform canvas and its tooltip wiring from a container.
export function removeUniformCanvas(container, logTag = null) {
    if (!container?.querySelector) {
        return null;
    }
    const existing = container.querySelector(".discourse-project-uniform-canvas");
    if (existing) {
        existing._teardownTooltips?.();
        existing.remove();
        if (logTag) {
            debugLog(`[${logTag}] Removed existing canvas`, { scoped: container !== document });
        }
    }
    return existing;
}

import getURL from "discourse-common/lib/get-url";

const PLUGIN_BASE = "/plugins/discourse-project-uniform";
const PLUGIN_BASE_URL = getURL(PLUGIN_BASE);
const IMAGE_BASE = `${PLUGIN_BASE}/images`;
const FONT_BASE = `${PLUGIN_BASE}/fonts`;
const IMAGE_BASE_URL = `${PLUGIN_BASE_URL}/images`;
const FONT_BASE_URL = `${PLUGIN_BASE_URL}/fonts`;
let IMAGE_BASE_PATH = IMAGE_BASE;
let FONT_BASE_PATH = FONT_BASE;

try {
    IMAGE_BASE_PATH = new URL(IMAGE_BASE_URL, window.location.origin).pathname;
    FONT_BASE_PATH = new URL(FONT_BASE_URL, window.location.origin).pathname;
} catch {
    // Fallback to non-prefixed paths if URL parsing fails.
    IMAGE_BASE_PATH = IMAGE_BASE;
    FONT_BASE_PATH = FONT_BASE;
}

// Simple in-memory cache for loaded images, keyed by URL
const imageCache = new Map();

let ASSET_CACHE_KEY = null;
let ASSET_TOKENS = null;

export function setAssetCacheData({ cacheKey, assetTokens } = {}) {
    ASSET_CACHE_KEY = cacheKey || null;
    ASSET_TOKENS = assetTokens || null;
}

// Appends cache-busting query params when URLs reference plugin assets.
export function applyAssetCacheParams(url) {
    if (!url || (!ASSET_CACHE_KEY && !ASSET_TOKENS)) {
        return url;
    }

    try {
        const parsed = new URL(url, window.location.origin);
        const path = parsed.pathname || "";

        let category = null;
        let file = null;

        if (path.startsWith(`${IMAGE_BASE_PATH}/`)) {
            const relative = path.slice(IMAGE_BASE_PATH.length + 1);
            const parts = relative.split("/");
            category = parts.shift() || null;
            file = parts.join("/");
        } else if (path.startsWith(`${FONT_BASE_PATH}/`)) {
            category = "fonts";
            file = path.slice(FONT_BASE_PATH.length + 1);
        } else {
            return url;
        }

        if (ASSET_CACHE_KEY) {
            parsed.searchParams.set("v", ASSET_CACHE_KEY);
        }

        const token = category && file ? ASSET_TOKENS?.[category]?.[file] : null;
        if (token) {
            parsed.searchParams.set("t", token);
        }

        const search = parsed.searchParams.toString();
        const originPrefix = parsed.origin !== window.location.origin ? parsed.origin : "";
        return `${originPrefix}${parsed.pathname}${search ? `?${search}` : ""}${parsed.hash || ""}`;
    } catch {
        return url;
    }
}

// Provides canonical asset URL builders scoped by asset category.
export const puPaths = {
    uniform: (file) => getURL(`${IMAGE_BASE}/uniforms/${file}`),
    rank: (file) => getURL(`${IMAGE_BASE}/ranks/${file}`),
    ribbon: (file) => getURL(`${IMAGE_BASE}/ribbons/${file}`),
    medal: (file) => getURL(`${IMAGE_BASE}/medals/${file}`),
    lanyard: (file) => getURL(`${IMAGE_BASE}/lanyards/${file}`),
    group: (file) => getURL(`${IMAGE_BASE}/groups/${file}`),
    csaRibbon: (file) => getURL(`${IMAGE_BASE}/csa/${file}`),
    csaTooltip: (file) => getURL(`${IMAGE_BASE}/csa_tooltips/${file}`),
    qual: (file) => getURL(`${IMAGE_BASE}/qualifications/${file}`),
    tooltipRank: (file) => getURL(`${IMAGE_BASE}/tooltip_rankimages/${file}`),
    tooltipQual: (file) => getURL(`${IMAGE_BASE}/tooltip_qualificationimages/${file}`),
    tooltipLanyard: (file) => getURL(`${IMAGE_BASE}/tooltip_lanyardimages/${file}`),
    font: (file) => getURL(`${FONT_BASE}/${file}`),
};

// Loads an image (trying multiple candidates) and caches it for reuse.
export function loadImageCached(urlOrCandidates) {
    const candidates = Array.isArray(urlOrCandidates) ? urlOrCandidates : [urlOrCandidates];
    const tryNext = (idx) =>
        new Promise((resolve, reject) => {
            const rawUrl = candidates[idx];
            if (!rawUrl) {
                return resolve(null); // nothing left to try
            }
            const url = applyAssetCacheParams(rawUrl);
            if (imageCache.has(url)) {
                debugLog("[loadImageCached] Cache hit:", url);
                return resolve(imageCache.get(url));
            }
            const img = new Image();
            try {
                const parsed = new URL(url, window.location.origin);
                if (parsed.origin !== window.location.origin) {
                    img.crossOrigin = "anonymous";
                }
            } catch {
                // ignore URL parse errors; treat as same-origin
            }
            img.onload = () => {
                imageCache.set(url, img);
                debugLog("[loadImageCached] Loaded:", url, { w: img.naturalWidth, h: img.naturalHeight });
                resolve(img);
            };
            img.onerror = (e) => {
                debugLog("[loadImageCached] ERROR:", url, e);
                tryNext(idx + 1).then(resolve).catch(reject);
            };
            debugLog("[loadImageCached] Begin:", url);
            img.src = url;
        });
    return tryNext(0);
}

// Converts a possibly relative URL to its normalized path component.
export function normalizePath(url) {
    try {
        return new URL(url, window.location.origin).pathname;
    } catch {
        return url;
    }
}
