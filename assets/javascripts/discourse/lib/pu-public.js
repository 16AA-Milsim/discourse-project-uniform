import { prepareAndRenderImages } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-prepare";
import { awards, groupTooltipMapLC } from "discourse/plugins/discourse-project-uniform/discourse/uniform-data";
import { setAssetCacheData } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-utils";

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function waitForCanvas(container, timeoutMs) {
  return new Promise((resolve, reject) => {
    const existing = container.querySelector(".discourse-project-uniform-canvas");
    if (existing) {
      return resolve(existing);
    }

    const observer = new MutationObserver(() => {
      const canvas = container.querySelector(".discourse-project-uniform-canvas");
      if (canvas) {
        observer.disconnect();
        resolve(canvas);
      }
    });

    observer.observe(container, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error("Timed out waiting for uniform canvas"));
    }, timeoutMs);
  });
}

function waitForRenderedCanvas(container, timeoutMs) {
  const startedAt = Date.now();
  return waitForCanvas(container, timeoutMs).then(
    (canvas) =>
      new Promise((resolve, reject) => {
        const tick = () => {
          if (canvas.dataset.puRendered === "true") {
            return resolve(canvas);
          }
          if (Date.now() - startedAt > timeoutMs) {
            return reject(new Error("Timed out waiting for uniform render"));
          }
          requestAnimationFrame(tick);
        };
        tick();
      })
  );
}

function renderUniform(root) {
  root.dataset.snapshotPosted = "";
  const username = root.dataset.username;
  if (!username) {
    root.textContent = "No username provided.";
    return;
  }

  const cacheKey = root.dataset.cacheKey || "";
  const assetTokens = parseJson(root.dataset.assetTokens, {}) || {};
  const snapshotEndpoint = root.dataset.snapshotEndpoint;
  const snapshotCacheKey = root.dataset.snapshotCacheKey || cacheKey;
  const snapshotToken = root.dataset.snapshotToken;
  const basePath = root.dataset.basePath || "";

  setAssetCacheData({ cacheKey, assetTokens });

  const fetchJson = (url) =>
    fetch(url, { credentials: "same-origin" }).then((response) => {
      if (!response.ok) {
        throw new Error(response.statusText || "Request failed");
      }
      return response.json();
    });

  const encoded = encodeURIComponent(String(username).trim().toLowerCase());
  const prefix = basePath && basePath !== "/" ? basePath : "";
  Promise.all([
    fetchJson(`${prefix}/u/${encoded}.json`),
    fetchJson(`${prefix}/user-badges/${encoded}.json`),
  ])
    .then(([userSummaryData, badgeData]) => {
      const loading = root.querySelector("p");
      if (loading) {
        loading.remove();
      }
      const userRecord = userSummaryData?.user;
      if (!userRecord) {
        throw new Error("User data unavailable");
      }

      const groups = userRecord.groups || [];
      const idToBadge = new Map((badgeData.badges || []).map((b) => [b.id, b]));
      const userBadges = badgeData.user_badges || [];

      prepareAndRenderImages(
        groups,
        userBadges,
        idToBadge,
        root,
        awards,
        groupTooltipMapLC,
        userRecord
      );

      setTimeout(() => {
        const canvas = root.querySelector(".discourse-project-uniform-canvas");
        if (!canvas && !root.dataset.snapshotPosted) {
          root.textContent = "Uniform failed to render.";
        }
      }, 2500);

      if (snapshotEndpoint && !root.dataset.snapshotPosted && snapshotToken) {
        waitForRenderedCanvas(root, 12000)
          .then((canvas) => {
            requestAnimationFrame(() => {
              canvas.toBlob(
                (blob) => {
                  if (!blob) {
                    root.dataset.snapshotPosted = "";
                    return;
                  }

                  const url = new URL(snapshotEndpoint, window.location.origin);
                  if (snapshotCacheKey) {
                    url.searchParams.set("cache_key", snapshotCacheKey);
                  }
                  if (snapshotToken) {
                    url.searchParams.set("token", snapshotToken);
                  }

                  root.dataset.snapshotPosted = "true";
                  fetch(url.toString(), {
                    method: "POST",
                    headers: {
                      "Content-Type": "image/png",
                      "X-Uniform-Token": snapshotToken || "",
                      "X-Uniform-Cache-Key": snapshotCacheKey || "",
                    },
                    body: blob,
                    credentials: "same-origin",
                  }).catch(() => {
                    root.dataset.snapshotPosted = "";
                  });
                },
                "image/png"
              );
            });
          })
          .catch(() => {
            root.dataset.snapshotPosted = "";
          });
      }
    })
    .catch((error) => {
      root.textContent = `Unable to load uniform. ${error?.message || ""}`;
    });
}

export function bootstrapPublicUniform(rootOrId = "project-uniform-root") {
  const root =
    typeof rootOrId === "string"
      ? document.getElementById(rootOrId)
      : rootOrId;
  if (!root) {
    return;
  }

  renderUniform(root);
}
