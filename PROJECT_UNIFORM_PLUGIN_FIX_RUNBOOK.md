# Project Uniform Plugin Fix Runbook

This runbook documents the **permanent code-level fix** for stale/missing ORBAT uniform tooltips.

Date: 2026-03-11
Server: `discourse.16aa.net`

## Scope

Apply a durable fix in plugin source code so temporary render failures do not remain stuck as tooltip misses.

What this fix does:

1. Prevents `uniform-missing-*.png` responses from being cached by browser/CDN.
2. (Optional, recommended) Adds one retry path in ORBAT preview fetch with a cache-buster.

Cloudflare cache/rate-limit rules were already configured separately.

## 1) Patch `discourse-project-uniform` (required)

File:

`plugins/discourse-project-uniform/app/controllers/discourse_project_uniform/uniforms_controller.rb`

In `image`, inside the `snapshot.blank?` + `placeholder.present?` branch, replace:

```ruby
expires_in 30.seconds, public: true
```

with:

```ruby
# Missing placeholders are transient; do not allow edge/browser caching.
expires_now
response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
response.headers["Pragma"] = "no-cache"
response.headers["Surrogate-Control"] = "no-store"
```

Keep the existing `send_data` call and filename `uniform-missing-#{user.username}.png`.

## 2) Patch `discourse-orbat` (optional but recommended)

File:

`plugins/discourse-orbat/assets/javascripts/discourse/components/orbat-node.js`

In `#fetchUniformPng(url)`:

1. Add `cache: "no-store"` to `fetch(...)`.
2. If first fetch returns non-OK or `content-disposition` contains `uniform-missing-`, retry once with a cache-busted URL:

```js
const retryUrl = `${url}${url.includes("?") ? "&" : "?"}_orbat_retry=${Date.now()}`;
```

and fetch retry with:

```js
cache: "no-store",
headers: {
  Accept: "image/png",
  "Cache-Control": "no-cache"
}
```

Then run the same PNG validity checks (content-type/disposition/blob size) before returning `{ available: true, url: URL.createObjectURL(blob) }`.

## 3) Persisted deployment path

Do **not** patch only inside a running container unless this is emergency-only.

Use your real plugin repositories:

1. Commit both patches to source control.
2. Update plugin refs in your Discourse app config (if pinned).
3. Rebuild app container:

```bash
cd /var/discourse
./launcher rebuild app
```

4. Ensure sidecar is running:

```bash
cd /var/discourse/uniform-renderer
docker compose ps
curl -sS http://127.0.0.1:3011/health
```

## 4) Post-deploy verification

### A. Plugin runtime and queue

```bash
docker exec -u discourse app bash -lc 'cd /var/www/discourse && RAILS_ENV=production bundle exec rails runner "require \"sidekiq/api\"; puts \"default=#{Sidekiq::Queue.new(\"default\").size}\""'
```

Expected: queue trends toward `0` after warm-up.

### B. Snapshot readiness for `16AA_Member`

```bash
docker exec -u discourse app bash -lc 'cd /var/www/discourse && RAILS_ENV=production bundle exec rails runner "group=Group.find_by(name: \"16AA_Member\"); users=group.users.where(staged: false).to_a; missing=users.count{|u| ck=::DiscourseProjectUniform::UniformSnapshot.cache_key_for_user(u); ::DiscourseProjectUniform::UniformSnapshot.fetch(u.id, ck).blank?}; puts \"total=#{users.size} missing=#{missing}\""'
```

Expected: `missing=0` after prewarm completes.

### C. Per-user ORBAT-style URL check

```bash
curl -skI "https://discourse.16aa.net/uniform/beach.png?v=<uniformCacheKey>"
```

Expected header:

`content-disposition: inline; filename="project-uniform-Beach.png"...`

### D. Missing placeholder cache behavior

Use a currently non-renderable test user and verify response headers:

- `cache-control` includes `no-store`
- `surrogate-control: no-store`

## 5) Success criteria

1. New/updated renderable members transition to visible ORBAT tooltip PNGs without manual direct URL visits.
2. Transient failures do not remain stuck due to stale `uniform-missing` cache.
3. `429` events on preview paths no longer leave long-lived visual misses.
