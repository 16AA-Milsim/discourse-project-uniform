import { withPluginApi } from "discourse/lib/plugin-api";

const SETTING_SELECTOR =
  '[data-setting="discourse_project_uniform_public_enabled"]';
const GUIDE_SELECTOR = ".pu-public-guide";
const GUIDE_HTML = `
  <details class="pu-public-guide-details">
    <summary>Public PNG Renderer Setup (click to expand)</summary>
    <div class="pu-public-guide-content">
      <p>
        Use this guide if you want <code>/uniform/USERNAME.png</code> to always be
        generated and updated automatically.
      </p>

      <h4>0) Prerequisites check</h4>
      <pre><code>docker --version
docker compose version</code></pre>
      <p>
        If either command fails, install Docker first.
      </p>

      <h4>1) Create renderer directory on the host, for example</h4>
      <pre><code>mkdir -p /opt/docker/uniform-renderer
cd /opt/docker/uniform-renderer</code></pre>

      <h4>2) Create <code>package.json</code></h4>
      <pre><code>cat > package.json <<'JSON'
{
  "name": "uniform-renderer",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.21.2",
    "playwright": "^1.58.2"
  }
}
JSON</code></pre>

      <h4>3) Create <code>server.js</code></h4>
      <pre><code>cat > server.js <<'JS'
import express from "express";
import { chromium } from "playwright";

const app = express();
app.use(express.json({ limit: "1mb" }));

function envNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const PORT = Number(process.env.PORT || 3011);
const RENDERER_KEY = String(process.env.RENDERER_KEY || "");
const LOCALHOST_RESOLVE_TO = String(process.env.LOCALHOST_RESOLVE_TO || "").trim();
const NAV_TIMEOUT_MS = envNumber(process.env.NAV_TIMEOUT_MS, 45_000);
const RENDER_TIMEOUT_MS = envNumber(process.env.RENDER_TIMEOUT_MS, 45_000);
const NAV_RETRIES = Math.max(0, envNumber(process.env.NAV_RETRIES, 2));
const MAX_CONCURRENT_RENDERS = Math.max(1, envNumber(process.env.MAX_CONCURRENT_RENDERS, 2));
const SLOT_WAIT_TIMEOUT_MS = Math.max(1_000, envNumber(process.env.SLOT_WAIT_TIMEOUT_MS, 120_000));
const RENDERER_USER_AGENT = String(
  process.env.RENDERER_USER_AGENT ||
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
).trim();

const ROOT_SELECTOR = "#project-uniform-root";
const CANVAS_SELECTOR = ".discourse-project-uniform-canvas";
const RENDERED_SELECTOR = CANVAS_SELECTOR + "[data-pu-rendered='true']";

let browser;
let activeRenders = 0;
const slotQueue = [];

async function getBrowser() {
  if (!browser) {
    const args = ["--disable-dev-shm-usage"];
    if (LOCALHOST_RESOLVE_TO) {
      args.push(
        "--host-resolver-rules=MAP localhost " +
          LOCALHOST_RESOLVE_TO +
          ",MAP 127.0.0.1 " +
          LOCALHOST_RESOLVE_TO
      );
    }
    browser = await chromium.launch({ headless: true, args });
  }
  return browser;
}

function authFailed(req) {
  if (!RENDERER_KEY) {
    return false;
  }
  return req.header("x-renderer-key") !== RENDERER_KEY;
}

function releaseRenderSlot() {
  activeRenders = Math.max(0, activeRenders - 1);
  const next = slotQueue.shift();
  if (!next) {
    return;
  }
  clearTimeout(next.timer);
  activeRenders += 1;
  next.resolve();
}

async function acquireRenderSlot() {
  if (activeRenders < MAX_CONCURRENT_RENDERS) {
    activeRenders += 1;
    return;
  }

  await new Promise((resolve, reject) => {
    const queued = {
      resolve,
      timer: setTimeout(() => {
        const index = slotQueue.indexOf(queued);
        if (index >= 0) {
          slotQueue.splice(index, 1);
        }
        reject(new Error("render_queue_timeout"));
      }, SLOT_WAIT_TIMEOUT_MS),
    };
    slotQueue.push(queued);
  });
}

async function waitForRenderState(page) {
  try {
    await page.waitForFunction(
      ({ rootSelector }) => {
        const root = document.querySelector(rootSelector);
        if (!root) {
          return false;
        }
        const state = root.dataset?.puRenderState;
        return state === "rendered" || state === "failed";
      },
      { rootSelector: ROOT_SELECTOR },
      { timeout: RENDER_TIMEOUT_MS }
    );
  } catch (error) {
    const message = String(error?.message || "");
    if (!message.includes("Timeout")) {
      throw error;
    }
  }

  return page.evaluate(
    ({ rootSelector, renderedSelector }) => {
      const root = document.querySelector(rootSelector);
      const renderedCanvas = document.querySelector(renderedSelector);
      return {
        rootExists: !!root,
        state: root?.dataset?.puRenderState || "",
        message: root?.dataset?.puRenderMessage || root?.textContent?.trim() || "",
        hasRenderedCanvas: !!renderedCanvas,
      };
    },
    { rootSelector: ROOT_SELECTOR, renderedSelector: RENDERED_SELECTOR }
  );
}

function isRetryableNavigationError(error) {
  const message = String(error?.message || "");
  return (
    message.includes("ERR_EMPTY_RESPONSE") ||
    message.includes("ERR_CONNECTION_RESET") ||
    message.includes("ERR_CONNECTION_CLOSED") ||
    message.includes("ERR_ABORTED") ||
    message.includes("Timeout")
  );
}

async function navigateWithRetry(page, url) {
  let lastError;
  for (let attempt = 0; attempt <= NAV_RETRIES; attempt += 1) {
    try {
      return await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
    } catch (error) {
      lastError = error;
      if (!isRetryableNavigationError(error) || attempt >= NAV_RETRIES) {
        throw error;
      }
      await page.waitForTimeout(500 * (attempt + 1));
    }
  }
  throw lastError || new Error("navigation_failed");
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    activeRenders,
    queuedRenders: slotQueue.length,
    maxConcurrentRenders: MAX_CONCURRENT_RENDERS,
  });
});

app.post("/render", async (req, res) => {
  const startedAt = Date.now();
  let context;
  let slotAcquired = false;
  try {
    if (authFailed(req)) {
      return res.status(403).json({ error: "forbidden" });
    }

    const url = String(req.body?.url || "").trim();
    if (!/^https?:\\/\\//i.test(url)) {
      return res.status(422).json({ error: "invalid_url" });
    }

    const b = await getBrowser();
    await acquireRenderSlot();
    slotAcquired = true;

    context = await b.newContext({
      viewport: { width: 900, height: 1400 },
      userAgent: RENDERER_USER_AGENT,
    });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
    page.setDefaultTimeout(RENDER_TIMEOUT_MS);

    try {
      await navigateWithRetry(page, url);
      const state = await waitForRenderState(page);
      if (!state.hasRenderedCanvas) {
        const fallbackMessage = state.rootExists
          ? "uniform_canvas_not_ready"
          : "uniform_root_not_found";
        return res.status(422).json({
          error: "uniform_not_renderable",
          message: String(state.message || fallbackMessage).slice(0, 280),
        });
      }

      const selector = CANVAS_SELECTOR;
      const canvas = await page.$(selector);
      if (!canvas) {
        return res.status(422).json({ error: "canvas_not_found" });
      }

      let png;
      try {
        const dataUrl = await page.$eval(selector, (element) => {
          if (!(element instanceof HTMLCanvasElement)) {
            throw new Error("canvas_not_html_canvas");
          }
          return element.toDataURL("image/png");
        });

        const prefix = "data:image/png;base64,";
        if (!dataUrl.startsWith(prefix)) {
          throw new Error("invalid_canvas_data_url");
        }
        png = Buffer.from(dataUrl.slice(prefix.length), "base64");
      } catch (_error) {
        const box = await canvas.boundingBox();
        if (!box) {
          return res.status(422).json({ error: "canvas_bounds_not_found" });
        }
        png = await page.screenshot({
          type: "png",
          clip: {
            x: Math.max(0, box.x),
            y: Math.max(0, box.y),
            width: Math.max(1, box.width),
            height: Math.max(1, box.height),
          },
          omitBackground: true,
        });
      }

      res.setHeader("Content-Type", "image/png");
      console.log(
        "[render] ok ms=" +
          (Date.now() - startedAt) +
          " bytes=" +
          png.length +
          " active=" +
          activeRenders +
          " queued=" +
          slotQueue.length +
          " url=" +
          url
      );
      return res.send(png);
    } finally {
      await context.close();
      context = null;
      if (slotAcquired) {
        releaseRenderSlot();
        slotAcquired = false;
      }
    }
  } catch (error) {
    const message = error?.message || "unknown";
    const timeoutError = message.includes("render_queue_timeout");
    const status = timeoutError ? 503 : 500;
    const errorCode = timeoutError ? "renderer_busy" : "render_failed";
    console.warn(
      "[render] fail ms=" +
        (Date.now() - startedAt) +
        " status=" +
        status +
        " active=" +
        activeRenders +
        " queued=" +
        slotQueue.length +
        " message=" +
        message.slice(0, 200)
    );
    return res.status(status).json({
      error: errorCode,
      message,
    });
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
    if (slotAcquired) {
      releaseRenderSlot();
    }
  }
});

process.on("SIGTERM", async () => {
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(
    "uniform-renderer listening on " +
      PORT +
      " (localhost->" +
      (LOCALHOST_RESOLVE_TO || "default") +
      ")"
  );
});
JS</code></pre>

      <h4>4) Create <code>Dockerfile</code></h4>
      <pre><code>cat > Dockerfile <<'DOCKER'
FROM mcr.microsoft.com/playwright:v1.58.2-jammy

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

ENV NODE_ENV=production
EXPOSE 3011

CMD ["npm", "start"]
DOCKER</code></pre>

      <h4>5) Create <code>docker-compose.yml</code></h4>
      <pre><code>cat > docker-compose.yml <<'YAML'
services:
  uniform-renderer:
    build: .
    container_name: uniform-renderer
    restart: unless-stopped
    network_mode: "host"
    env_file:
      - .env
YAML</code></pre>

      <h4>6) Create <code>.env</code></h4>
      <pre><code>cat > .env <<'ENV'
RENDERER_KEY=CHANGE_ME_TO_A_RANDOM_LONG_STRING
PORT=3011
LOCALHOST_RESOLVE_TO=
NAV_TIMEOUT_MS=45000
RENDER_TIMEOUT_MS=45000
NAV_RETRIES=2
MAX_CONCURRENT_RENDERS=2
SLOT_WAIT_TIMEOUT_MS=120000
ENV</code></pre>
      <p>
        Generate a strong key with <code>openssl rand -hex 32</code>, then replace
        <code>CHANGE_ME_TO_A_RANDOM_LONG_STRING</code> inside <code>.env</code>.
      </p>

      <h4>7) Start the renderer</h4>
      <pre><code>cd /opt/docker/uniform-renderer
docker compose up -d --build</code></pre>

      <h4>8) Verify the renderer is healthy</h4>
      <pre><code>curl -s http://127.0.0.1:3011/health</code></pre>
      <p>
        Expected response: <code>{"ok":true}</code>
      </p>

      <h4>9) Configure plugin settings in Discourse Admin</h4>
      <ol>
        <li>
          Enable <code>discourse_project_uniform_public_enabled</code>.
        </li>
        <li>
          Set <code>discourse_project_uniform_renderer_url</code> to
          the renderer endpoint reachable from inside the Discourse container.
          Common examples:
          <code>http://172.17.0.1:3011/render</code> (renderer on Docker host)
          or <code>http://127.0.0.1:3011/render</code> (same network namespace).
          Verify from the Discourse container with:
          <pre><code>docker ps --format '{{.Names}}'
docker exec &lt;DISCOURSE_CONTAINER_NAME&gt; curl -s http://172.17.0.1:3011/health</code></pre>
        </li>
        <li>
          Set <code>discourse_project_uniform_renderer_visit_base_url</code> to
          a URL the renderer can open for your forum pages.
          In production, this is normally your live forum URL, for example
          <code>https://forum.example.com</code>.
          Use an internal URL only if the renderer cannot reach the public URL.
        </li>
        <li>
          Set <code>discourse_project_uniform_renderer_key</code> to the same value as
          <code>RENDERER_KEY</code> in <code>.env</code>.
        </li>
      </ol>

      <h4>10) Test a PNG endpoint</h4>
      <pre><code>curl -I https://forum.example.com/uniform/USERNAME.png</code></pre>
      <p>
        Replace <code>USERNAME</code> with a valid forum username.
      </p>

      <h4>Troubleshooting</h4>
      <ol>
        <li>
          <code>403 forbidden</code> from renderer: renderer key mismatch.
        </li>
        <li>
          <code>Connection refused</code> to renderer URL: renderer container is not running.
        </li>
        <li>
          Placeholder text instead of PNG for a long time: check renderer logs with
          <code>docker logs --tail=200 uniform-renderer</code>.
        </li>
        <li>
          <code>uniform_not_renderable</code>: this user does not currently produce a uniform canvas
          (for example missing rank/group data), so PNG generation is skipped until their profile data changes.
        </li>
      </ol>
    </div>
  </details>
`;

function ensurePublicPngGuide() {
  const row = document.querySelector(SETTING_SELECTOR);
  if (!row) {
    return false;
  }

  const existingGuide =
    row.nextElementSibling?.matches(GUIDE_SELECTOR) ||
    document.querySelector(GUIDE_SELECTOR);
  if (existingGuide) {
    return true;
  }

  const guide = document.createElement("div");
  guide.className = "pu-public-guide";
  guide.innerHTML = GUIDE_HTML;

  row.insertAdjacentElement("afterend", guide);
  return true;
}

function watchForSettingRow() {
  if (ensurePublicPngGuide()) {
    return;
  }

  const observer = new MutationObserver(() => {
    if (ensurePublicPngGuide()) {
      observer.disconnect();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 10000);
}

function isPluginSettingsPage(url) {
  return (
    url?.includes("/admin/site_settings") ||
    url?.includes("/admin/plugins/discourse-project-uniform")
  );
}

export default {
  name: "discourse-project-uniform-admin",

  initialize() {
    withPluginApi("0.8.26", (api) => {
      const run = (url) => {
        if (!url?.includes("/admin")) {
          return;
        }
        if (isPluginSettingsPage(url)) {
          watchForSettingRow();
        }
      };

      run(window.location.pathname + window.location.search + window.location.hash);
      api.onPageChange(run);
    });
  },
};
