import { prepareAndRenderImages } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-prepare";
import { awards, groupTooltipMapLC } from "discourse/plugins/discourse-project-uniform/discourse/uniform-data";
import { setAssetCacheData } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-utils";
import getURL from "discourse-common/lib/get-url";

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function setRenderState(root, state, message = "") {
  if (!root?.dataset) {
    return;
  }
  root.dataset.puRenderState = state;
  root.dataset.puRenderMessage = message ? String(message).slice(0, 280) : "";
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
  const renderId = String((Number(root.dataset.puPublicRenderId || "0") || 0) + 1);
  root.dataset.puPublicRenderId = renderId;
  const isCurrentRender = () => root.dataset.puPublicRenderId === renderId;

  root.dataset.snapshotPosted = "";
  setRenderState(root, "loading");
  const username = root.dataset.username;
  if (!username) {
    root.textContent = "No username provided.";
    setRenderState(root, "failed", "missing_username");
    return;
  }

  const cacheKey = root.dataset.cacheKey || "";
  const assetTokens = parseJson(root.dataset.assetTokens, {}) || {};
  const snapshotEndpoint = root.dataset.snapshotEndpoint;
  const snapshotCacheKey = root.dataset.snapshotCacheKey || cacheKey;
  const snapshotToken = root.dataset.snapshotToken;

  setAssetCacheData({ cacheKey, assetTokens });

  const fetchJson = (url) =>
    fetch(url, {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText || "Request failed"}`.trim());
      }

      const body = await response.text();
      try {
        return JSON.parse(body);
      } catch {
        const snippet = body.slice(0, 80).replace(/\s+/g, " ");
        throw new Error(`Non-JSON response from ${url}: ${snippet}`);
      }
    });

  const encoded = encodeURIComponent(String(username).trim().toLowerCase());
  Promise.all([
    fetchJson(getURL(`/u/${encoded}.json`)),
    fetchJson(getURL(`/user-badges/${encoded}.json`)),
  ])
    .then(([userSummaryData, badgeData]) => {
      if (!isCurrentRender()) {
        return;
      }

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
        userRecord,
        {
          enableTooltips: false,
          showSupplementalPanels: false,
        }
      );

      const renderReadyPromise = waitForRenderedCanvas(root, 15_000)
        .then((canvas) => {
          if (!isCurrentRender()) {
            return null;
          }
          setRenderState(root, "rendered");
          return canvas;
        })
        .catch((error) => {
          if (!isCurrentRender()) {
            return null;
          }
          const hasCanvas = !!root.querySelector(".discourse-project-uniform-canvas");
          if (!hasCanvas) {
            root.textContent = "Uniform failed to render.";
          }
          setRenderState(root, "failed", error?.message || "render_timeout");
          return null;
        });

      if (snapshotEndpoint && !root.dataset.snapshotPosted && snapshotToken) {
        renderReadyPromise
          .then((canvas) => {
            if (!canvas) {
              return;
            }
            if (!isCurrentRender()) {
              return;
            }
            requestAnimationFrame(() => {
              canvas.toBlob(
                (blob) => {
                  if (!isCurrentRender()) {
                    return;
                  }
                  if (!blob) {
                    root.dataset.snapshotPosted = "";
                    return;
                  }

                  const url = new URL(snapshotEndpoint, window.location.origin);
                  if (snapshotCacheKey) {
                    url.searchParams.set("cache_key", snapshotCacheKey);
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
          });
      }
    })
    .catch((error) => {
      if (!isCurrentRender()) {
        return;
      }
      setRenderState(root, "failed", error?.message || "load_failed");
      const hasCanvas = !!root.querySelector(".discourse-project-uniform-canvas");
      if (!hasCanvas) {
        root.textContent = `Unable to load uniform. ${error?.message || ""}`;
      }
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
