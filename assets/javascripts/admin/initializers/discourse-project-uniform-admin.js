import { withPluginApi } from "discourse/lib/plugin-api";

const SETTING_SELECTOR =
  '[data-setting="discourse_project_uniform_public_enabled"]';

/**
 * Locks the public uniform setting UI so it cannot be toggled while the feature
 * is still under development.
 *
 * @returns {boolean} True when the setting row is found and locked.
 */
function lockPublicUniformSetting() {
  const row = document.querySelector(SETTING_SELECTOR);
  if (!row) {
    return false;
  }

  row.classList.add("pu-setting-locked");

  const input = row.querySelector('input[type="checkbox"]');
  if (input) {
    input.disabled = true;
    input.setAttribute("aria-disabled", "true");
  }

  return true;
}

/**
 * Watches the admin settings UI until the target setting row is available,
 * then applies the locked state.
 */
function watchForSettingRow() {
  if (lockPublicUniformSetting()) {
    return;
  }

  const observer = new MutationObserver(() => {
    if (lockPublicUniformSetting()) {
      observer.disconnect();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  setTimeout(() => observer.disconnect(), 10000);
}

export default {
  name: "discourse-project-uniform-admin",

  initialize() {
    withPluginApi((api) => {
      api.onPageChange((url) => {
        if (!url?.includes("/admin")) {
          return;
        }

        if (
          url.includes("/admin/site_settings") ||
          url.includes("/admin/plugins/discourse-project-uniform")
        ) {
          watchForSettingRow();
        }
      });
    });
  },
};
