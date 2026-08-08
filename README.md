# Mistfall Hunter — Build Calculator

A **fully static** web app (React + Vite) that runs the whole build optimizer **in
the browser** — no backend, no database, no server to pay for. It also embeds a
**Twitch livestream** (counts toward your live viewer count while you're live) and a
**Ko-fi** donation button, so you can host this for **$0/month** on any static host.

> Originally this was an Express/Node backend (`backend/`) serving a REST API. We
> refactored the optimizer (`javascript-lp-solver` is pure JS) to run client-side and
> bundled the game data JSON directly into the frontend. The `backend/` folder is
> kept only as a reference/scraper and is **not** needed to run the site.

---

## Local development

```bash
npm install
npm run build        # outputs the static site to frontend/dist
npx vite             # or: npm install -g vite && vite   -> serves frontend/ for dev
```

The production site is just the `frontend/dist/` folder — a single `index.html` plus
one JS asset. Open it with any static server (e.g. `npx serve frontend/dist`).

---

## Configure your Twitch & Ko-fi

Open **`frontend/src/App.jsx`** and set these two values in the `SITE` config:

```js
const SITE = {
  twitchChannel: 'YOUR_TWITCH_CHANNEL', // e.g. 'yourname' (lowercase channel name)
  kofi: 'YOUR_KOFI_USERNAME'            // e.g. 'yourname'  -> ko-fi.com/yourname
};
```

> ⚠️ **Important:** Vite strips any unconfigured block at build time. If you leave the
> placeholder values as-is, the Twitch embed / Ko-fi button will simply not be
> included in the bundle. Set the real values, then **`npm run build`** again.

**How the embed counts viewers (read this):**
- The embed is set to `autoplay=true&muted=false`, which is what makes Twitch count an
  embedded viewer — **but only while you are actually live** and the player is visible
  and playing.
- The `parent` query parameter is filled automatically from `window.location.hostname`,
  so it works no matter where you host it (including `localhost` in dev).
- If you're offline, the embed just shows the channel's offline page.

**Ko-fi:** the widget iframe is the official Ko-fi embed (`kofiframe`). It links to
`ko-fi.com/<your-username>`.

---

## Deploying (free, always-on)

Your chosen path: **fully static** hosting. Pick one:

### Option A — Cloudflare Pages (recommended, simplest)
1. Push this repo to GitHub.
2. In Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to GitHub**.
3. Pick the repo. Build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `frontend/dist`
4. Deploy. You get a free `*.pages.dev` URL (HTTPS) and can add a free custom domain.
   No sub-path issues because it's served at root.

### Option B — GitHub Pages
1. Push this repo to GitHub.
2. Repo **Settings → Pages → Source**: GitHub Actions (or deploy the `frontend/dist`
   folder via a branch).
3. The build already uses relative paths (`base: './'`) and a `.nojekyll` file, so it
   works from a `username.github.io/repo/` sub-path without extra config.
4. GitHub Pages is HTTPS by default. Update the Twitch `parent` to
   `username.github.io` automatically (handled by `location.hostname`).

### Option C — Netlify / Vercel
- Point the site at the repo, build command `npm run build`, output `frontend/dist`.
- Both serve over HTTPS at the root.

No env vars, no port, no process manager — a static CDN does all the work.

---

## Project layout

```
frontend/
  dist/                 <- built static site (deploy this)
  src/
    App.jsx             <- UI + Twitch/Ko-fi sidebar + SITE config
    lib/engine.js       <- full build optimizer, runs in the browser
    lib/codec.js        <- runtime decoder for the obfuscated data blob
    lib/data.enc.js     <- generated, obfuscated data (run build to regenerate)
backend/                <- original Node scraper/server (reference only; not deployed)
backend/data/*.json     <- plain game data (source of truth) — encoded at build time
scripts/encode-data.mjs <- obfuscates backend/data/*.json into data.enc.js
```

## Re-scraping / updating data (and how obfuscation fits in)

The plain, human-readable data lives in `backend/data/*.json` (produced from your
spreadsheet via the scraper scripts in `backend/`, e.g. `npm run scrape`, 
`npm run scrape:prices`). **You always edit the plain JSON / spreadsheet.** At build
time `scripts/encode-data.mjs` obfuscates it into `data.enc.js`, which is what ships.

So updating data later costs the same effort as today — just edit → import → `npm run build`
→ redeploy. You never hand-edit obfuscated content.

## Class availability ("Coming Soon")

A class is **automatically enabled** only when its **own** armor + weapon gear actually
contains a built-in affix or a socket. Empty/incomplete classes show **⏳ Coming Soon**
and are disabled in the UI. Fill in a class's gear data and rebuild, and it flips on by
itself — no code edits needed. (Shared Ring/Necklace accessories do **not** enable a
class.)

## A note on "light" obfuscation

This hides the raw JSON so it isn't copy-paste readable from the source or DevTools.
It is **not** unhackable: because the app runs fully in the browser, a determined person
can still reverse the decode and read the data. It's a deterrent, not DRM.

Unofficial fan tool. Not affiliated with Bellring Games.
