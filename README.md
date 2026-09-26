# Instagram Account Analyzer

> Discover what content works, what goes viral, and why.

Paste an Instagram profile URL or `@username` and the app analyses that account's recent posts: it picks 10–20 representative posts, scores every post for virality **relative to the account itself**, finds the patterns shared by viral posts and turns them into data-backed insights.

**Principle:** nothing is ever made up. If real data can't be fetched, the app says so and explains why. No mock, random or placeholder metrics appear anywhere in the product; any metric the source doesn't provide stays empty and is excluded from calculations.

---

## Features

| Area | What it does |
|---|---|
| Input | `https://www.instagram.com/nike/`, `instagram.com/nike?igsh=…`, `@nike`, `nike` → `nike`. Post/reel URLs are rejected with a clear message. |
| Period | Last 1 / 3 / **6 (default)** / 12 months / everything available |
| Account header | Profile image, username, name, bio, followers, following, post count, analysed posts, period, analysis date, category (**always labelled "추정"**, keyword-based) |
| Overview | Analysed posts, viral count, avg engagement, avg likes/comments/views, Reels/Carousel/Image shares, charts |
| Viral | Viral posts only, sortable by Viral Score / Likes / Comments / Views / Engagement / Newest |
| Posts | 10–20 representative posts with badges `VIRAL` `HIGH ENGAGEMENT` `RECENT` `REPRESENTATIVE`, filters, "all posts" view |
| Patterns | Content type, hook, caption style, CTA, caption length, weekday — each with median performance, sample size and a significance label; viral-pattern lift table; format table |
| Insights | What's working / not working / viral pattern / opportunity / 5 next content ideas — every sentence carries its numbers |
| Compare | Select 2–4 posts → side-by-side table + "biggest difference" summary |
| Monthly | Month chips (APR … SEP) → post count, avg engagement, top post, viral count, main content type, that month's posts |
| History | Last 10 analysed accounts in `localStorage`, deletable one by one or all at once. No tokens are ever stored in the browser. |
| Data source | Every dashboard shows **Data Source** and **Last Updated** |

## Architecture

```
┌──────────────────────── GitHub Pages (static) ────────────────────────┐
│ React + TypeScript + Vite + Tailwind + Recharts                       │
│                                                                       │
│  features/instagram/parseUsername   ← input → username                │
│  providers/                         ← InstagramDataProvider interface │
│    MetaInstagramProvider  ─┐                                          │
│    ExternalProvider       ─┼─ services/apiClient ──► HTTPS ──┐        │
│    ImportedDataProvider  (JSON/CSV parsed in the browser)    │        │
│  analytics/  (pure functions, no I/O)                        │        │
│    viralScore.calculateViralScore()                          │        │
│    selection.selectRepresentativePosts()                     │        │
│    patterns / insights / compare / classify                  │        │
│  pages/ features/dashboard/ components/  (UI)                │        │
└──────────────────────────────────────────────────────────────┼────────┘
                                                               ▼
┌──────────────── Serverless API (Cloudflare Worker) ───────────────────┐
│ server/handler.ts  GET /api/health   GET /api/account?username=…      │
│ server/providers/meta.ts      Business Discovery + pagination         │
│ server/providers/external.ts  vendor-neutral adapter slot             │
│ Secrets: META_ACCESS_TOKEN, META_IG_USER_ID (env only)                │
└───────────────────────────────────────────────────────────────────────┘
shared/types.ts  ← the one data model (AccountDataset) both sides use
```

```
src/
  analytics/        scoring, selection, patterns, insights (unit-tested)
  components/       UI primitives, PostCard, charts
  features/
    dashboard/      tabs, compare dialog, data hook
    import/         JSON/CSV importer + dialog
    instagram/      URL/username parser
  lib/              errors, formatting, hash router, storage
  pages/            Home, Dashboard
  providers/        InstagramDataProvider + 3 implementations
  services/         API client
server/             Worker handler, providers, local dev server
shared/             data model + Graph API normalisation
tests/              vitest
```

Swapping the data source only means producing an `AccountDataset` (`shared/types.ts`). Analytics never know where the data came from.

## Instagram Data Source

Researched September 2026 against Meta's docs (Graph API **v25.0**).

| API | Can read *other* accounts? | Notes |
|---|---|---|
| Instagram API **with Facebook Login** → **Business Discovery** | ✅ public **Business/Creator** accounts | The only official way. Used here. |
| Instagram API with Instagram Login | ❌ | Business Discovery and Hashtag Search are *not* supported in this setup. Own account only. |
| Instagram Insights | ❌ | Only for accounts you manage (reach, saves, shares…). |
| Basic Display API | ❌ | Retired (Dec 2024). |

Business Discovery returns, per account: `username, name, biography, website, profile_picture_url, followers_count, follows_count, media_count`; per post: `id, caption, like_count, comments_count, view_count (Reels), media_type, media_product_type, media_url / thumbnail_url, permalink, timestamp, children`. Media is paginated with cursors (`media.after(cursor).limit(50)`).

## API Limitations

What official data **cannot** tell you (and the app therefore never claims):

- **Personal and private accounts** can't be analysed. Meta returns the same error for "doesn't exist / deleted / personal / private / age-gated", so the app does not guess which one it is.
- **Saves, shares, reach, impressions** exist only in Insights for accounts you own, so "저장 반응이 높다" style claims are impossible for other accounts.
- **Video length and image/video content** aren't returned. Content type, hook and CTA are *estimated from caption text only* and labelled as such.
- **like_count** is omitted when the owner hides likes; such posts are scored on comments/views only.
- **view_count** exists for Reels only.
- **Account category** isn't exposed, so it's a keyword estimate shown with "추정".
- Stories and ads are excluded.
- Rate limits: Business Use Case limits per app-user. The server caches each response for 15 min and caps pagination (`META_MAX_PAGES`, default 12 × 50 posts).

### External provider (Apify) — no Facebook needed

When a Facebook-linked professional account isn't an option, the server can use a third-party collector instead. It's implemented for **Apify** (`apify/instagram-profile-scraper` + `apify/instagram-post-scraper`) in `server/providers/apify.ts`; swapping vendors means writing one adapter that returns `AccountDataset`.

- Works for any **public** account (personal or professional). Private accounts are reported as such.
- Data is collected by the vendor from public Instagram pages, not via Meta's API. Numbers can differ slightly from the app, it can break when Instagram changes, and it sits in a grey zone of Instagram's terms. The dashboard labels it "External Provider (Apify)".
- **Cost:** about $2.3–2.7 per 1,000 results. One analysis ≈ `EXTERNAL_MAX_POSTS` (default 150) + 1 → ~$0.40. Apify's free plan includes ~$5/month (≈ 10–15 fresh analyses).
- **Cost controls:** one 12-month collection per account, reused for every period switch; results cached `EXTERNAL_CACHE_HOURS` (default 12 h) in Workers KV; optional `ACCESS_CODE` so only people with the code can trigger runs; also set a monthly usage limit in the Apify console.
- Preference: if Meta credentials exist the search uses Meta; otherwise it uses the external provider.

### Import fallback

For accounts the API can't reach, **JSON/CSV import** works entirely in the browser; files are never uploaded.

- **Meta Graph API JSON**: paste the raw output of Graph API Explorer (`{ "business_discovery": { … } }`) straight in.
- **App JSON**: `{ "exportedAt": "...", "profile": { "username": "...", "followersCount": 1234, … }, "media": [ { "id", "timestamp", "format": "REELS|VIDEO|CAROUSEL|IMAGE", "likeCount", "commentsCount", "viewCount", "caption", "permalink", "thumbnailUrl" } ] }`
- **CSV**: header row with any of
  `permalink/url, timestamp/date, media_type/type, caption, like_count/likes, comments_count/comments, view_count/views/plays, thumbnail_url, id`.
  Numbers like `1,234`, `1.2K`, `3만` are understood. A template can be downloaded from the import dialog. Missing columns are reported and excluded, never filled in.

## Viral Score

`src/analytics/viralScore.ts → calculateViralScore()` (all constants in `VIRAL_CONFIG`)

For each metric the post **has** (likes, comments, views):

```
ratio      = value / account median of that metric   (views vs other videos only)
ratioScore = clamp(50 + 25·log2(ratio), 0, 100)       median→50, 2×→75, 4×→100, ½×→25
percentile = share of the account's posts below it
component  = 0.6·ratioScore + 0.4·percentile·100
score      = weighted mean (likes .30, comments .25, views .45), weights renormalised over available metrics
```

- Medians need ≥ 5 posts with that metric; otherwise the metric is dropped.
- Posts younger than 72 h are left out of the baseline and flagged provisional (`*`).
- Engagement rate `(likes+comments)/followers` is shown, but within one account it's the same ratio as engagement vs median, so it isn't double-weighted.
- **Viral** = score ≥ 70 **and** at least one metric ≥ 2× the median, with ≥ 8 posts in the period.
- Each card explains itself, e.g. "계정 중앙값 대비 좋아요 2.8배 · 조회수 상위 5% (60개 중 3위)".

## Representative post selection

`src/analytics/selection.ts → selectRepresentativePosts()` mixes criteria up to 20 posts, each post once:

1. Viral: up to 8, by Viral Score
2. High engagement: 3–5, by engagement rate (performance index if followers unknown)
3. Recent: 3–5 newest
4. Representative: 3–5 posts from the most common *format × content type* combos, closest to typical performance, max 2 per combo
5. Format diversity: every format used in the period gets at least one post
6. Fill to 10 by score if needed

## Honesty rules in the insights

- Groups under 3 posts are never used for a conclusion.
- "What's working / not working" needs a median ≥ 1.2× / ≤ 0.8× **and** a one-sided sign test p < 0.10. "근거 충분" needs p < 0.01, a strict bar because many groups are tested at once.
- Viral patterns use a binomial test of "how often would this attribute show up among viral posts by chance". Weekday patterns must pass the strict bar.
- Insights are rule-based calculations on the account's numbers, not generated prose.

---

## Setup

Requirements: Node 20+ (22 recommended), npm.

```bash
git clone https://github.com/bberry0648-dotcom/instagram-account-analyzer.git
cd instagram-account-analyzer
npm install
cp .env.example .env        # fill in server secrets (never commit .env)
```

## Environment Variables

| Name | Where | Secret? | Purpose |
|---|---|---|---|
| `META_ACCESS_TOKEN` | server | **yes** | Long-lived Instagram User token (Facebook Login) with `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement` (+ `ads_read` if the Page role comes via Business Manager) |
| `META_IG_USER_ID` | server | yes | *Your* IG professional account id (`1784…`), the account that "discovers" others |
| `META_GRAPH_VERSION` | server | no | default `v25.0` |
| `META_MAX_PAGES` | server | no | pages of 50 posts per analysis, default 12 |
| `EXTERNAL_PROVIDER_NAME` | server | no | `apify` |
| `EXTERNAL_PROVIDER_KEY` | server | **yes** | Apify API token |
| `EXTERNAL_MAX_POSTS` / `EXTERNAL_CACHE_HOURS` | server | no | cost caps (150 posts, 12 h) |
| `ACCESS_CODE` | server | **yes** | if set, searching requires this code (sent as `X-Access-Code`, kept in sessionStorage only) |
| `ALLOWED_ORIGINS` | server | no | CORS allow-list, comma separated |
| `VITE_API_BASE_URL` | frontend build | **no, public** | URL of the deployed API; empty = import-only mode |

Anything prefixed `VITE_` ends up in client JavaScript. **Never put a token in a `VITE_` variable.**

### Getting a Meta token (one-time)

1. Convert your Instagram account to **Professional (Business or Creator)** and link it to a **Facebook Page**.
2. Create an app at <https://developers.facebook.com/apps> (type *Business*) and add **Instagram API with Facebook Login**.
3. In Graph API Explorer, pick the app, add the permissions above and generate a User token, then exchange it for a **long-lived token** (~60 days).
4. Find your IG account id: `GET /me/accounts?fields=instagram_business_account{id,username}`.
5. Put both in `.env` (local) and in the Worker secrets (production).

For other people to use your deployed app with *your* token, the app generally needs to be in Live mode with permissions approved through Meta App Review. In Development mode only app roles (admins/testers) can use it.

## Local Development

```bash
npm run dev:api    # API on http://localhost:8787 (reads .env)
npm run dev        # site on http://localhost:5173 (VITE_API_BASE_URL in .env.local)
npm test           # unit tests (parser, scoring, selection, importers, API error mapping)
```

The home page shows whether the API is reachable and has credentials (`/api/health` reports booleans only).

## Build

```bash
npm run build      # typecheck (app + server) → dist/
npm run preview
```

The Vite `base` is `/instagram-account-analyzer/` for builds (override with `BASE_PATH`). Routing uses the URL hash (`#/a/meta/nike/viral?period=3m`), so refreshes and deep links never 404 on GitHub Pages.

## GitHub Pages Deployment

Push to `main` → `.github/workflows/deploy.yml` runs tests, builds and deploys.

One-time setup:
1. Repository → Settings → Pages → Source: **GitHub Actions**.
2. (After the API is deployed) Settings → Secrets and variables → Actions → **Variables** → `VITE_API_BASE_URL = https://<your-worker>.workers.dev`. It's a *variable*, not a secret, because it's public anyway.

URL: `https://bberry0648-dotcom.github.io/instagram-account-analyzer/`

## Serverless Backend Deployment (Cloudflare Workers)

```bash
npx wrangler login
npx wrangler kv namespace create CACHE      # paste the id into wrangler.toml
npx wrangler secret put EXTERNAL_PROVIDER_KEY   # Apify token
npx wrangler secret put ACCESS_CODE             # optional but recommended
# (Meta instead/also) npx wrangler secret put META_ACCESS_TOKEN / META_IG_USER_ID
npm run deploy:api            # → https://instagram-account-analyzer-api.<you>.workers.dev
```

`wrangler.toml` holds only non-secret vars. Responses are cached in Workers KV (Meta 15 min, external 12 h). `server/handler.ts` uses only the standard `Request`/`Response` API, so a Vercel or Netlify function is a thin wrapper around `handleRequest()`.

## Security Notes

- Tokens live only in server env / Worker secrets; `.env` is git-ignored and only `.env.example` is committed.
- The token is sent to Meta in the `Authorization` header, never in a URL, so it doesn't end up in logs.
- API errors return a code plus a safe message; raw Meta error text stays in server logs.
- CORS allow-list restricts which sites can call the API.
- Browser storage holds only the recent-search list and imported datasets (public post data), never credentials.
- Imported files are parsed locally and not uploaded.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "데이터 수집 서버가 아직 연결되지 않았습니다" | `VITE_API_BASE_URL` not set at build time, or the API lacks `META_*` secrets. Check `/api/health`. |
| "계정이 없거나 … 비공개·개인 계정" | Business Discovery only sees public Business/Creator accounts. Use import. |
| "인증이 만료되었습니다" | Long-lived tokens last ~60 days. Generate a new one and `wrangler secret put META_ACCESS_TOKEN`. |
| "호출 한도에 도달" | Business Use Case rate limit. Wait (usually < 1 h). Lower `META_MAX_PAGES`. |
| CORS error in console | Add the site origin to `ALLOWED_ORIGINS`. |
| Blank page on GitHub Pages | `BASE_PATH` must match the repo name (the workflow sets it automatically). |
| Thumbnails show a placeholder | Instagram CDN URLs expire. Re-run the analysis (cache is 15 min). |
| Few or no viral posts | Expected for steady accounts or short periods. The threshold is relative to the account, not absolute. |
