# Production Sidecar Install (Discourse Docker)

The steps below assume a standard Discourse Docker install in `/var/discourse`
with the main forum container named `app`.

1. Create a sidecar directory on the host:

```bash
mkdir -p /var/discourse/uniform-renderer
cd /var/discourse/uniform-renderer
```

2. Create the sidecar files (`package.json`, `server.js`, `Dockerfile`,
`docker-compose.yml`, `.env`):

```bash
cat > package.json <<'JSON'
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
JSON

cat > server.js <<'JS'
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
const RENDERED_SELECTOR = `${CANVAS_SELECTOR}[data-pu-rendered='true']`;

let browser;
let activeRenders = 0;
const slotQueue = [];

async function getBrowser() {
  if (!browser) {
    const args = ["--disable-dev-shm-usage"];
    if (LOCALHOST_RESOLVE_TO) {
      args.push(
        `--host-resolver-rules=MAP localhost ${LOCALHOST_RESOLVE_TO},MAP 127.0.0.1 ${LOCALHOST_RESOLVE_TO}`
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
    if (!/^https?:\/\//i.test(url)) {
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

      const canvas = await page.$(CANVAS_SELECTOR);
      if (!canvas) {
        return res.status(422).json({ error: "canvas_not_found" });
      }

      let png;
      try {
        const dataUrl = await page.$eval(CANVAS_SELECTOR, (element) => {
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
    `uniform-renderer listening on ${PORT} (localhost->${LOCALHOST_RESOLVE_TO || "default"})`
  );
});
JS

cat > Dockerfile <<'DOCKER'
FROM mcr.microsoft.com/playwright:v1.58.2-jammy

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

ENV NODE_ENV=production
EXPOSE 3011

CMD ["npm", "start"]
DOCKER

cat > docker-compose.yml <<'YAML'
services:
  uniform-renderer:
    build: .
    container_name: uniform-renderer
    restart: unless-stopped
    network_mode: "host"
    env_file:
      - .env
YAML

cat > .env <<'ENV'
RENDERER_KEY=CHANGE_ME_TO_A_RANDOM_LONG_STRING
PORT=3011
LOCALHOST_RESOLVE_TO=
NAV_TIMEOUT_MS=45000
RENDER_TIMEOUT_MS=45000
NAV_RETRIES=2
MAX_CONCURRENT_RENDERS=2
SLOT_WAIT_TIMEOUT_MS=120000
ENV
```

3. Generate a strong renderer key and place it in `.env`:

```bash
openssl rand -hex 32
```

4. Build and start the sidecar:

```bash
cd /var/discourse/uniform-renderer
docker compose up -d --build
```

5. Verify health from the host:

```bash
curl -s http://127.0.0.1:3011/health
```

Expected response includes `{"ok":true, ...}`.

6. Verify reachability from the Discourse container:

```bash
docker exec app curl -s http://172.17.0.1:3011/health
```

If `172.17.0.1` does not work on your host, find the gateway from inside `app`:

```bash
docker exec app sh -lc "ip route | awk '/default/ {print $3}'"
```

Then use that IP in `discourse_project_uniform_renderer_url`.

7. Configure these site settings in Discourse Admin:

* `discourse_project_uniform_public_enabled = true`
* `discourse_project_uniform_renderer_url = http://172.17.0.1:3011/render`
* `discourse_project_uniform_renderer_visit_base_url = https://your-forum-domain`
* `discourse_project_uniform_renderer_key = <same value as RENDERER_KEY in .env>`

8. Validate end-to-end:

```bash
curl -I https://your-forum-domain/uniform/USERNAME.png
```

First request may return a placeholder while a background render job runs. A
subsequent request should return `project-uniform-USERNAME.png`.

#### Production Security Notes

* Do not expose the renderer port publicly. Restrict port `3011` via host
  firewall/security group rules.
* Keep `RENDERER_KEY` secret and rotate it if leaked.
* Set `discourse_project_uniform_renderer_visit_base_url` to the canonical
  forum URL the sidecar should render.
