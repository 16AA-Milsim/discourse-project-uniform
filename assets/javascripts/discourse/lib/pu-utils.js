// pu-utils.js

// Global debug mode switch
export const DEBUG_MODE = false; // (dev note: consider wiring to a site setting)

/**
 * Logs debug messages to the browser console if DEBUG_MODE is enabled.
 * Uses console.debug so logs only appear when dev tools are set to "Verbose".
 */
export function debugLog(...args) {
    if (!DEBUG_MODE) return;
    const ts = new Date().toISOString(); // timestamp for log
    console.debug(`[ProjectUniform ${ts}]`, ...args);
}

// Simple in-memory cache for loaded images, keyed by URL
const imageCache = new Map();

// Loads an image from a URL, with caching to avoid re-downloading.
export function loadImageCached(url) {
    return new Promise((resolve, reject) => {
        if (!url) {
            debugLog("[loadImageCached] Skipping empty URL");
            return resolve(null);
        }
        if (imageCache.has(url)) {
            debugLog("[loadImageCached] Cache hit:", url);
            return resolve(imageCache.get(url));
        }
        const img = new Image();
        img.onload = () => {
            imageCache.set(url, img); // store in cache
            debugLog("[loadImageCached] Loaded:", url, { w: img.naturalWidth, h: img.naturalHeight });
            resolve(img);
        };
        img.onerror = (e) => {
            debugLog("[loadImageCached] ERROR:", url, e);
            reject(e);
        };
        debugLog("[loadImageCached] Begin:", url);
        img.src = url;
    });
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
