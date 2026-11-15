# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

FaZe Vault is an unofficial FaZe Clan fan platform: an Express + MongoDB Atlas API (`src/`) and a React web app (`web/`), plus two small sibling services. Fans earn "FaZe Points" (watching, posting, merch, shorts), spend them (rewards, profile logos), and party up with matched players.

## Commands

Backend (repo root, ESM, Node 20+):

```bash
npm run dev                      # API with --watch on :3000 (needs .env; see .env.example)
npm start                        # API without watch
npm run twitch                   # standalone Twitch service on :3500 (replays + watch points)
npm test                         # node --test over test/
node --test test/merch.test.js   # one file
node --test --test-name-pattern="pairing" test/logos.test.js   # one test by name
```

One-off DB scripts (all idempotent, all connect to the real Atlas database): `npm run db:setup` (validators and indexes), `db:seed-credentials`, `db:seed-shorts`, `db:seed-feed`, `db:ingest-history`. The last embeds `Fazeclanhistory.pdf` and takes about 1.5 minutes because of Voyage's no-billing rate limit.

Web (`cd web`): `npm run dev`, `npm run build`, `npm run tokens` (re-sync design tokens and the noise texture), `npm run roster`, `npm run events`. There is no linter and no web test runner. `web/.env` sets `VITE_API_URL`, so the app runs live by default; force demo mode with `VITE_API_URL= npx vite`.

Sibling services, each with its own `package.json` and `node_modules`: `Faker/` (CommonJS Discord bot that creates a voice channel per party) and `find_similiar_users/` (standalone similar-users API on :3001, `npm start`).

## Backend architecture

- `src/app.js` builds the Express app (`createApp`) and the Twitch-only app (`createTwitchApp`); `src/server.js` connects the database, starts it and the background workers (`DISABLE_WORKERS=1` skips them). Routes in `src/routes/`, logic in `src/services/`. Most routes use `requireAuth` (admin ones add `requireAdmin`); the public ones are `/auth`, the perk catalogue, event list and detail, and the Twitch latest-video lookup.
- `src/config.js` has quirks: the Mongo URI comes from the gitignored `src/mongo-uri.local.js`, else `MONGODB_URI`, else `MONGO_DB_URL`. The database name is literally `faze_platform;`, including the semicolon.
- The `users`, `user_games` and `parties` collections predate this API, so their field names win. `userModel.js` maps them (`user_name` to `name`, `faze_teams_followed` to `teams_followed`). `src/schemas.js` runs `ensureSchema` on every connect: collections it creates get JSON-schema validators and indexes, and pre-existing ones get indexes only.
- **Adding a points source:** every balance change goes through `applyPoints(session, …)` inside `withTxn` (`services/ledger.js`; transactions need the Atlas replica set), and the `source_type` must be in the enum in `schemas.js` or the ledger insert is rejected.
- Several rules exist twice, as the server's authoritative copy and a web copy, and tests keep them in step: merch pricing and points (`services/merch.js` and `web/src/data/merch.js`, see `test/merch.test.js`), the shorts catalogue (`src/data/shorts.json` and `web/src/data/shorts.json`, built from `faze_videos.txt`), and the profile-logo pool (`services/logos.js` and `web/src/data/logos.js`). Change both sides.
- The fun-fact RAG (`services/rag.js`) chunks `Fazeclanhistory.pdf` into the `faze_history_chunks` collection, embeds with Voyage, retrieves in memory by cosine similarity, and generates with OpenAI, rejecting facts whose numbers are not in the retrieved text. `VOYAGE_API_KEY` is an Atlas-issued key, so it only works against `ai.mongodb.com` (not `api.voyageai.com`). Optional overrides: `VOYAGE_MODEL`, `VOYAGE_API_URL`, `OPENAI_MODEL`.
- Background workers (`src/workers/index.js`) handle event payouts and Discord reminders. They claim work atomically (`findOneAndUpdate` on a flag) so multiple instances never double-send.
- Parties: anyone can join any game's party. `GET /parties/clusters` lists every catalogue game, with the games the user owns first. Voice channels come from the Faker service (`DISCORD_PARTY_SERVICE_URL`), and parties work without it.

## Web architecture (`web/`, React 19, Vite, Tailwind 3, React Three Fiber)

- **Data layer:** `src/data/index.js` exports `api`. With `VITE_API_URL` set it is `{ ...fake, ...real }`, so any endpoint missing from `real.js` silently falls back to the in-memory `fake.js`. Every new endpoint needs a `real.js` call, and a `fake.js` twin returning the same response shape so demo mode keeps working.
- Auth is a JWT in `localStorage` (`fv_token`), delivered after login in the URL fragment (`/auth/callback`).
- Design tokens are generated from `../replica/design` (`npm run tokens`). Components use role classes (`bg-surface`, `text-muted`, `text-accent-text`), never raw hex.
- `layout/Shell.jsx` wraps pages in a `group/shell` grid with a `data-sidebar` flag. Full-bleed children (the home hero, the marquee, the merch strip) use negative gutter margins and a `lg:group-data-[sidebar=true]/shell:ml-0` override so they do not cover the games sidebar.
- `src/three/` is lazy-loaded into its own chunk. `SceneFrame` handles WebGL detection, reduced motion, off-screen pausing and an SVG fallback.
- Tests are Node's test runner and import pure web modules (`web/src/data/*.js`) directly, so keep logic that needs a test out of `.jsx` files.

## Repo notes

- `.env` is gitignored and holds live keys. `.env.example` is incomplete for the RAG keys above.
- `drive-download-*/` (brand kit), `Fazeclanhistory.pdf` and `seed-credentials.local.txt` are gitignored local files, not part of the app. The PDF is required by `db:ingest-history`.
- `replica/build-log.md` is a stale record of an early build (it still calls the feed and rewards "fake layer only" and lists Create and Arcade pages that were deleted). Trust the code over it.
- `.impeccable/` holds design-review artifacts and a hook cache from the Impeccable design tool.
