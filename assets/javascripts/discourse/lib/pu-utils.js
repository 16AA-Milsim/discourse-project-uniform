// pu-utils.js

export const DEBUG_MODE = false; // if true here, admin setting is ignored and debug is always on

// --- Runtime override from admin setting (mutable, set at boot by initializer) ---
let ADMIN_DEBUG_FLAG = false;

// Called from initializer with the site setting value
export function setAdminDebugFlag(value) {
    ADMIN_DEBUG_FLAG = !!value;
}

// Effective debug state: code flag OR admin flag
export function isDebugEnabled() {
    return !!DEBUG_MODE || ADMIN_DEBUG_FLAG;
}

/**
 * Logs debug messages to the browser console if effective debug is enabled.
 */
export function debugLog(...args) {
    if (!isDebugEnabled()) return;
    const ts = new Date().toISOString();
    // Use console.debug so it only shows when “Verbose” is enabled in devtools
    console.debug(`[ProjectUniform ${ts}]`, ...args);
}

import getURL from "discourse-common/lib/get-url";

const BASE = "/plugins/discourse-project-uniform/images";
const EXT_CANDIDATES = ["png", "jpg", "jpeg"];

// Reads the plugin version from plugin.rb
function versionSuffix() {
  try {
    const site = window?.Discourse?.__container__?.lookup("site:main") || window?.__site__;
    const v = site?.project_uniform_version;
    return v ? `?v=${encodeURIComponent(v)}` : "";
  } catch {
    return "";
  }
}

export const puPaths = {
  uniform: (file) => getURL(`${BASE}/uniforms/${file}${versionSuffix()}`),

  rank: (fileOrKey) => {
    const m = String(fileOrKey).match(/^(.*?)(?:\.(png|jpg|jpeg))?$/i);
    const base = m ? m[1] : String(fileOrKey);
    return EXT_CANDIDATES.map(
      (ext) => getURL(`${BASE}/ranks/${base}.${ext}${versionSuffix()}`)
    );
  },

  ribbon:  (file) => getURL(`${BASE}/ribbons/${file}${versionSuffix()}`),
  medal:   (file) => getURL(`${BASE}/medals/${file}${versionSuffix()}`),
  lanyard: (file) => getURL(`${BASE}/lanyards/${file}${versionSuffix()}`),
  group:   (file) => getURL(`${BASE}/groups/${file}${versionSuffix()}`),

  qual: (fileOrKey) => {
    const m = String(fileOrKey).match(/^(.*?)(?:\.(png|jpg|jpeg))?$/i);
    const base = m ? m[1] : String(fileOrKey);
    return EXT_CANDIDATES.map(
      (ext) => getURL(`${BASE}/qualifications/${base}.${ext}${versionSuffix()}`)
    );
  },

  tooltipRank:    (file) => getURL(`${BASE}/tooltip_rankimages/${file}${versionSuffix()}`),
  tooltipQual:    (file) => getURL(`${BASE}/tooltip_qualificationimages/${file}${versionSuffix()}`),
  tooltipLanyard: (file) => getURL(`${BASE}/tooltip_lanyardimages/${file}${versionSuffix()}`),
};

// Simple in-memory cache for loaded images, keyed by URL
const imageCache = new Map();

// Loads an image from a URL or a list of candidate URLs (tries each until one works).
export function loadImageCached(urlOrCandidates) {
    const candidates = Array.isArray(urlOrCandidates) ? urlOrCandidates : [urlOrCandidates];
    const tryNext = (idx) =>
        new Promise((resolve, reject) => {
            const url = candidates[idx];
            if (!url) return resolve(null); // nothing left to try
            if (imageCache.has(url)) {
                debugLog("[loadImageCached] Cache hit:", url);
                return resolve(imageCache.get(url));
            }
            const img = new Image();
            img.onload = () => {
                imageCache.set(url, img);
                debugLog("[loadImageCached] Loaded:", url, { w: img.naturalWidth, h: img.naturalHeight });
                resolve(img);
            };
            img.onerror = (e) => {
                debugLog("[loadImageCached] ERROR:", url, e);
                // fall through to the next candidate
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

// Applies a transformation to a 2D point based on translation, rotation, skew, and offset.
export function transformPoint(x, y, tx, ty, angle, tanSkewY, offsetX, offsetY) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const x0 = x - offsetX, y0 = y - offsetY; // shift point by offset
    return {
        x: tx + c * x0 + (tanSkewY * c - s) * y0,
        y: ty + s * x0 + (tanSkewY * s + c) * y0
    };
}