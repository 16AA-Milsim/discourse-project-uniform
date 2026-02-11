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

const PORT = Number(process.env.PORT || 3011);
const RENDERER_KEY = String(process.env.RENDERER_KEY || "");
const LOCALHOST_RESOLVE_TO = String(process.env.LOCALHOST_RESOLVE_TO || "").trim();
const NAV_TIMEOUT_MS = 30_000;
const SELECTOR_TIMEOUT_MS = 30_000;

let browser;

async function getBrowser() {
  if (!browser) {
    const args = [];
    if (LOCALHOST_RESOLVE_TO) {
      args.push(
        \`--host-resolver-rules=MAP localhost \${LOCALHOST_RESOLVE_TO},MAP 127.0.0.1 \${LOCALHOST_RESOLVE_TO}\`
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

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/render", async (req, res) => {
  try {
    if (authFailed(req)) {
      return res.status(403).json({ error: "forbidden" });
    }

    const url = String(req.body?.url || "").trim();
    if (!/^https?:\\/\\//i.test(url)) {
      return res.status(422).json({ error: "invalid_url" });
    }

    const b = await getBrowser();
    const page = await b.newPage({ viewport: { width: 900, height: 1400 } });

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
      await page.waitForSelector(".discourse-project-uniform-canvas[data-pu-rendered='true']", {
        timeout: SELECTOR_TIMEOUT_MS,
      });

      const selector = ".discourse-project-uniform-canvas";
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
      return res.send(png);
    } finally {
      await page.close();
    }
  } catch (error) {
    return res.status(500).json({
      error: "render_failed",
      message: error?.message || "unknown",
    });
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
    \`uniform-renderer listening on \${PORT} (localhost->\${LOCALHOST_RESOLVE_TO || "default"})\`
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
