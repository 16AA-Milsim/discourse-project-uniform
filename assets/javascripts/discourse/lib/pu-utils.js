/**
 * Shared utilities for Project Uniform rendering. Handles debug toggles, path helpers,
 * lightweight image caching, and geometry math used by the canvas pipeline.
 */

export const DEBUG_MODE = false; // if true here, admin setting is ignored and debug is always on

// Runtime override from admin setting (mutable, set at boot by initializer)
let ADMIN_DEBUG_FLAG = false;

/**
 * Allows the initializer to provide the admin-controlled debug flag.
 */
export function setAdminDebugFlag(value) {
    ADMIN_DEBUG_FLAG = !!value;
}

/**
 * Returns the effective debug state using both the code toggle and admin override.
 */
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

const RENAMED_FILES = Object.freeze({
    'berets': {
      'para_beret.png': "para_beret__v2.png",
      'recruit_beret.png': "recruit_beret__v2.png"
    },
    'csa': {
      '3lsr_ba.png': "3lsr_ba__v2.png",
      '3lsr_raf.png': "3lsr_raf__v2.png",
      'itc_ba.png': "itc_ba__v2.png",
      'itc_raf.png': "itc_raf__v2.png",
      'media_ba.png': "media_ba__v2.png",
      'media_raf.png': "media_raf__v2.png",
      'reme_ba.png': "reme_ba__v2.png",
      'reme_raf.png': "reme_raf__v2.png",
      'rlc_ba.png': "rlc_ba__v2.png",
      'rlc_raf.png': "rlc_raf__v2.png",
      'rro_ba.png': "rro_ba__v2.png",
      'rro_raf.png': "rro_raf__v2.png"
    },
    'csa_tooltips': {
      '3lsr.png': "3lsr__v2.png",
      'itc.png': "itc__v2.png",
      'media.png': "media__v2.png",
      'reme.png': "reme__v2.png",
      'rlc.png': "rlc__v2.png",
      'rro.png': "rro__v2.png"
    },
    'groups': {
      '16csmr.png': "16csmr__v2.png",
      '7rha.png': "7rha__v2.png",
      'para-officer.png': "para-officer__v2.png",
      'para-tooltip-officer.png': "para-tooltip-officer__v2.png",
      'para-tooltip.png': "para-tooltip__v2.png",
      'para.png': "para__v2.png",
      'ramc.png': "ramc__v2.png",
      'royal_artillery.png': "royal_artillery__v2.png"
    },
    'lanyards': {
      'black_and_olive_lanyard.png': "black_and_olive_lanyard__v2.png",
      'black_lanyard.png': "black_lanyard__v2.png",
      'blue_lanyard.png': "blue_lanyard__v2.png",
      'green_and_lightgrey_lanyard.png': "green_and_lightgrey_lanyard__v2.png",
      'green_lanyard.png': "green_lanyard__v2.png",
      'lightblue_and_maroon_lanyard.png': "lightblue_and_maroon_lanyard__v2.png",
      'red_and_black_lanyard.png': "red_and_black_lanyard__v2.png",
      'red_and_blue_lanyard.png': "red_and_blue_lanyard__v2.png",
      'red_and_green_lanyard.png': "red_and_green_lanyard__v2.png",
      'red_lanyard.png': "red_lanyard__v2.png",
      'white_and_blue_lanyard.png': "white_and_blue_lanyard__v2.png"
    },
    'medals': {
      'citation.png': "citation__v2.png",
      'esprit_de_corps.png': "esprit_de_corps__v2.png",
      'esprit_de_corps_gold.png': "esprit_de_corps_gold__v2.png",
      'long_service_medal.png': "long_service_medal__v2.png",
      'long_service_medal_10_years.png': "long_service_medal_10_years__v2.png",
      'long_service_medal_5_years.png': "long_service_medal_5_years__v2.png",
      'mention_in_dispatches.png': "mention_in_dispatches__v2.png",
      'meritorious_service_medal.png': "meritorious_service_medal__v2.png",
      'mission_maker_first_class.png': "mission_maker_first_class__v2.png",
      'mission_maker_second_class.png': "mission_maker_second_class__v2.png",
      'mission_maker_third_class.png': "mission_maker_third_class__v2.png",
      'most_valuable_soldier.png': "most_valuable_soldier__v2.png",
      'recruiter_medal.png': "recruiter_medal__v2.png",
      'rro_excellence.png': "rro_excellence__v2.png",
      'significant_effort.png': "significant_effort__v2.png",
      'significant_effort_gold.png': "significant_effort_gold__v2.png",
      'technical_excellence.png': "technical_excellence__v2.png"
    },
    'qualifications': {
      '1st_class_marksman.png': "1st_class_marksman__v2.png",
      'cc.png': "cc__v3.png",
      'cmt.png': "cmt__v2.png",
      'ftcc.png': "ftcc__v3.png",
      'juniorpilot2.png': "juniorpilot2__v2.png",
      'paratrooper.png': "paratrooper__v2.png",
      'paratrooper_raf.png': "paratrooper_raf__v2.png",
      'pcbc.png': "pcbc__v3.png",
      'psbc.png': "psbc__v3.png",
      'scbc.png': "scbc__v3.png",
      'seniorpilot2.png': "seniorpilot2__v2.png",
      'sharpshooter.png': "sharpshooter__v2.png",
      'sniper.png': "sniper__v2.png"
    },
    'ranks': {
      '2lt.png': "2lt__v2.png",
      'capt.png': "capt__v2.png",
      'cpl.png': "cpl__v2.png",
      'csgt.png': "csgt__v2.png",
      'fgoff.png': "fgoff__v2.png",
      'fltlt.png': "fltlt__v2.png",
      'fsacr.png': "fsacr__v2.png",
      'lcpl.png': "lcpl__v2.png",
      'lt.png': "lt__v2.png",
      'maj.png': "maj__v2.png",
      'pltoff.png': "pltoff__v2.png",
      'sacr.png': "sacr__v2.png",
      'sgt.png': "sgt__v2.png",
      'sqnldr.png': "sqnldr__v2.png",
      'ssgt.png': "ssgt__v2.png",
      'wo2.png': "wo2__v2.png"
    },
    'ribbons': {
      'citation_1.png': "citation_1__v2.png",
      'citation_2.png': "citation_2__v2.png",
      'citation_3.png': "citation_3__v2.png",
      'citation_4.png': "citation_4__v2.png",
      'citation_5.png': "citation_5__v2.png",
      'esprit_de_corps.png': "esprit_de_corps__v2.png",
      'esprit_de_corps_gold.png': "esprit_de_corps_gold__v2.png",
      'long_service_medal.png': "long_service_medal__v2.png",
      'long_service_medal_10_years.png': "long_service_medal_10_years__v2.png",
      'long_service_medal_5_years.png': "long_service_medal_5_years__v2.png",
      'mention_in_dispatches_1.png': "mention_in_dispatches_1__v2.png",
      'mention_in_dispatches_2.png': "mention_in_dispatches_2__v2.png",
      'mention_in_dispatches_3.png': "mention_in_dispatches_3__v2.png",
      'mention_in_dispatches_4.png': "mention_in_dispatches_4__v2.png",
      'mention_in_dispatches_5.png': "mention_in_dispatches_5__v2.png",
      'meritorious_service_medal.png': "meritorious_service_medal__v2.png",
      'mission_maker_first_class.png': "mission_maker_first_class__v2.png",
      'mission_maker_second_class.png': "mission_maker_second_class__v2.png",
      'mission_maker_third_class.png': "mission_maker_third_class__v2.png",
      'most_valuable_soldier.png': "most_valuable_soldier__v2.png",
      'recruiter_medal.png': "recruiter_medal__v2.png",
      'rro_excellence.png': "rro_excellence__v2.png",
      'significant_effort.png': "significant_effort__v2.png",
      'significant_effort_gold.png': "significant_effort_gold__v2.png",
      'technical_excellence.png': "technical_excellence__v2.png",
      'white_ribbon.png': "white_ribbon__v2.png"
    },
    'tooltip_lanyardimages': {
      'black_dzf.png': "black_dzf__v2.png",
      'green_dzf.png': "green_dzf__v2.png",
      'hq_dzf.png': "hq_dzf__v2.png",
      'mi_dzf.png': "mi_dzf__v2.png",
      'red_and_blue_dzf.png': "red_and_blue_dzf__v2.png",
      'red_dzf.png': "red_dzf__v2.png"
    },
    'tooltip_qualificationimages': {
      '1stclassmarksman.jpg': "1stclassmarksman__v2.jpg",
      '2ndclassmarksman.jpg': "2ndclassmarksman__v2.jpg",
      '3rdclassmarksman.jpg': "3rdclassmarksman__v2.jpg",
      'advancedat.jpg': "advancedat__v2.jpg",
      'advancedsignals.jpg': "advancedsignals__v2.jpg",
      'apachepilotqual.png': "apachepilotqual__v2.png",
      'basicat.jpg': "basicat__v2.jpg",
      'basicsignals.jpg': "basicsignals__v2.jpg",
      'cicp1.png': "cicp1__v2.png",
      'cicp2.png': "cicp2__v2.png",
      'cc.png': "cc__v2.png",
      'cmt.jpg': "cmt__v2.jpg",
      'ctm.jpg': "ctm__v2.jpg",
      'ctmbronze.png': "ctmbronze__v2.png",
      'ctmgold.png': "ctmgold__v2.png",
      'ctmsilver.png': "ctmsilver__v2.png",
      'forwardobserver.jpg': "forwardobserver__v2.jpg",
      'freefaller.jpg': "freefaller__v2.jpg",
      'ftcc.jpg': "ftcc__v2.jpg",
      'heavyweaponsoperator.png': "heavyweaponsoperator__v2.png",
      'itcinstructor.png': "itcinstructor__v2.png",
      'jtac.jpg': "jtac__v2.jpg",
      'juniorpilot.jpg': "juniorpilot__v2.jpg",
      'machinegunner.png': "machinegunner__v2.png",
      'mortarlinecommander.jpg': "mortarlinecommander__v2.jpg",
      'mortaroperator.jpg': "mortaroperator__v2.jpg",
      'navigation.jpg': "navigation__v2.jpg",
      'parachutejumpinstructor.jpg': "parachutejumpinstructor__v2.jpg",
      'paratrooper.jpg': "paratrooper__v2.jpg",
      'pathfinder.png': "pathfinder__v2.png",
      'pcbc.jpg': "pcbc__v2.jpg",
      'psbc.jpg': "psbc__v2.jpg",
      'scbc.jpg': "scbc__v2.jpg",
      'seniorpilot.jpg': "seniorpilot__v2.jpg",
      'sharpshooter.png': "sharpshooter__v2.png",
      'sniper.jpg': "sniper__v2.jpg"
    },
    'tooltip_rankimages': {
      '2lt.jpg': "2lt__v2.jpg",
      'capt.jpg': "capt__v2.jpg",
      'cpl.jpg': "cpl__v2.jpg",
      'csgt.jpg': "csgt__v2.jpg",
      'fgoff.jpg': "fgoff__v2.jpg",
      'fltlt.jpg': "fltlt__v2.jpg",
      'fsacr.png': "fsacr__v2.png",
      'gnr.jpg': "gnr__v2.jpg",
      'lcpl.jpg': "lcpl__v2.jpg",
      'lt.jpg': "lt__v2.jpg",
      'maj.jpg': "maj__v2.jpg",
      'pltoff.jpg': "pltoff__v2.jpg",
      'pte.jpg': "pte__v2.jpg",
      'sacr.png': "sacr__v2.png",
      'sgt.jpg': "sgt__v2.jpg",
      'sqnldr.jpg': "sqnldr__v2.jpg",
      'ssgt.jpg': "ssgt__v2.jpg",
      'wo2.jpg': "wo2__v2.jpg"
    },
    'uniforms': {
      'ba_enlisted_uniform.png': "ba_enlisted_uniform__v2.png",
      'ba_officers_uniform.png': "ba_officers_uniform__v2.png",
      'raf_enlisted_uniform.png': "raf_enlisted_uniform__v2.png",
      'raf_officers_uniform.png': "raf_officers_uniform__v2.png"
    }
  });

const RENAMED_BASES = Object.freeze({
    'qualifications': {
      '1st_class_marksman': "1st_class_marksman__v2",
      'cc': "cc__v3",
      'cmt': "cmt__v2",
      'ctm': "ctm__v2",
      'ctm_gold': "ctm_gold__v2",
      'ctm_silver': "ctm_silver__v2",
      'ctm_bronze': "ctm_bronze__v2",
      'ftcc': "ftcc__v3",
      'juniorpilot2': "juniorpilot2__v2",
      'paratrooper': "paratrooper__v2",
      'paratrooper_raf': "paratrooper_raf__v2",
      'pcbc': "pcbc__v3",
      'psbc': "psbc__v3",
      'scbc': "scbc__v3",
      'seniorpilot2': "seniorpilot2__v2",
      'sharpshooter': "sharpshooter__v2",
      'sniper': "sniper__v2"
    },
    'ranks': {
      '2lt': "2lt__v2",
      'capt': "capt__v2",
      'cpl': "cpl__v2",
      'csgt': "csgt__v2",
      'fgoff': "fgoff__v2",
      'fltlt': "fltlt__v2",
      'fsacr': "fsacr__v2",
      'lcpl': "lcpl__v2",
      'lt': "lt__v2",
      'maj': "maj__v2",
      'pltoff': "pltoff__v2",
      'sacr': "sacr__v2",
      'sgt': "sgt__v2",
      'sqnldr': "sqnldr__v2",
      'ssgt': "ssgt__v2",
      'wo2': "wo2__v2"
    }
  });

// Simple in-memory cache for loaded images, keyed by URL
const imageCache = new Map();

function remapFileName(category, fileName) {
  if (!category || !fileName) {
    return fileName;
  }
  return RENAMED_FILES?.[category]?.[fileName] || fileName;
}

function remapBaseName(category, baseName) {
  if (!category || !baseName) {
    return baseName;
  }
  return RENAMED_BASES?.[category]?.[baseName] || baseName;
}

let cachedVersionSuffix = "";
let lastVersionKey = null;

function lookupSiteModel() {
  try {
    return window?.Discourse?.__container__?.lookup?.("site:main") || window?.__site__;
  } catch {
    return null;
  }
}

function resolveVersionKey() {
  const site = lookupSiteModel();
  if (site?.project_uniform_cache_key) {
    return site.project_uniform_cache_key;
  }
  if (site?.project_uniform_version) {
    return `plugin-${site.project_uniform_version}`;
  }

  const globalFallback =
    window?.assetVersion ||
    window?.__APP_VERSION__ ||
    window?.__DISCOURSE_APP_VERSION__ ||
    window?.Discourse?.__container__?.lookup?.("app-events:main")?.appVersion;

  return globalFallback ? `site-${globalFallback}` : null;
}

// Reads the project-uniform cache key exposed by the Site serializer.
function versionSuffix() {
  const versionKey = resolveVersionKey();
  if (!versionKey) {
    cachedVersionSuffix = "";
    lastVersionKey = null;
    return "";
  }

  if (versionKey !== lastVersionKey) {
    lastVersionKey = versionKey;
    cachedVersionSuffix = `?v=${encodeURIComponent(versionKey)}`;
    imageCache.clear();
    debugLog("[versionSuffix] Cache key changed, cleared image cache", versionKey);
  }

  return cachedVersionSuffix;
}

function resolveAssetTokens() {
  const site = lookupSiteModel();
  if (site?.project_uniform_asset_tokens) {
    return site.project_uniform_asset_tokens;
  }
  return window?.__site__?.project_uniform_asset_tokens || null;
}

function assetToken(category, fileName) {
  if (!category || !fileName) {
    return null;
  }
  const tokens = resolveAssetTokens();
  return tokens?.[category]?.[fileName] || null;
}

function cacheBusterSuffix(category, fileName) {
  const token = assetToken(category, fileName);
  if (token) {
    return `?v=${encodeURIComponent(token)}`;
  }
  return versionSuffix();
}

// Helper to generate canonical asset URLs for each asset category
export const puPaths = {
  uniform: (file) => {
    const resolved = remapFileName("uniforms", file);
    return getURL(`${BASE}/uniforms/${resolved}${cacheBusterSuffix("uniforms", resolved)}`);
  },

  rank: (fileOrKey) => {
    const m = String(fileOrKey).match(/^(.*?)(?:\.(png|jpg|jpeg))?$/i);
    const base = m ? m[1] : String(fileOrKey);
    const resolvedBase = remapBaseName("ranks", base);
    return EXT_CANDIDATES.map((ext) => {
      const file = `${resolvedBase}.${ext}`;
      return getURL(`${BASE}/ranks/${file}${cacheBusterSuffix("ranks", file)}`);
    });
  },

  ribbon:  (file) => {
    const resolved = remapFileName("ribbons", file);
    return getURL(`${BASE}/ribbons/${resolved}${cacheBusterSuffix("ribbons", resolved)}`);
  },
  medal:   (file) => {
    const resolved = remapFileName("medals", file);
    return getURL(`${BASE}/medals/${resolved}${cacheBusterSuffix("medals", resolved)}`);
  },
  lanyard: (file) => {
    const resolved = remapFileName("lanyards", file);
    return getURL(`${BASE}/lanyards/${resolved}${cacheBusterSuffix("lanyards", resolved)}`);
  },
  group:   (file) => {
    const resolved = remapFileName("groups", file);
    return getURL(`${BASE}/groups/${resolved}${cacheBusterSuffix("groups", resolved)}`);
  },
  csaRibbon: (file) => {
    const resolved = remapFileName("csa", file);
    return getURL(`${BASE}/csa/${resolved}${cacheBusterSuffix("csa", resolved)}`);
  },
  csaTooltip: (file) => {
    const resolved = remapFileName("csa_tooltips", file);
    return getURL(`${BASE}/csa_tooltips/${resolved}${cacheBusterSuffix("csa_tooltips", resolved)}`);
  },

  qual: (fileOrKey) => {
    const m = String(fileOrKey).match(/^(.*?)(?:\.(png|jpg|jpeg))?$/i);
    const base = m ? m[1] : String(fileOrKey);
    const resolvedBase = remapBaseName("qualifications", base);
    return EXT_CANDIDATES.map((ext) => {
      const file = `${resolvedBase}.${ext}`;
      return getURL(`${BASE}/qualifications/${file}${cacheBusterSuffix("qualifications", file)}`);
    });
  },

  tooltipRank:    (file) => {
    const resolved = remapFileName("tooltip_rankimages", file);
    return getURL(`${BASE}/tooltip_rankimages/${resolved}${cacheBusterSuffix("tooltip_rankimages", resolved)}`);
  },
  tooltipQual:    (file) => {
    const resolved = remapFileName("tooltip_qualificationimages", file);
    return getURL(`${BASE}/tooltip_qualificationimages/${resolved}${cacheBusterSuffix("tooltip_qualificationimages", resolved)}`);
  },
  tooltipLanyard: (file) => {
    const resolved = remapFileName("tooltip_lanyardimages", file);
    return getURL(`${BASE}/tooltip_lanyardimages/${resolved}${cacheBusterSuffix("tooltip_lanyardimages", resolved)}`);
  },
};

/**
 * Loads an image from a URL or a list of candidate URLs (tries each until one succeeds)
 * and caches the result for subsequent calls.
 */
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
