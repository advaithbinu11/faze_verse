# FaZe Verse

FaZe Verse is an unofficial FaZe Clan fan platform for watching, earning, connecting, and keeping track of your place in the community.

The project combines a React web experience with an Express API backed by MongoDB Atlas. Members can sign in, follow players and teams, earn FaZe Points, watch Twitch and YouTube content, discover similar players, make friends, join parties, browse merch, and personalize their profile.

> This is a community-built project created during the HackUTA hackathon in 2026. It is not affiliated with or endorsed by FaZe Clan.

## Highlights

- Steam OAuth and email/password authentication
- Personalized welcome page with player matches and FaZe history facts
- Twitch live streams, automatic latest-broadcast replay fallback, and watch-time points
- YouTube watch sessions and Shorts recommendations
- Community feed with posts, likes, comments, and point rewards
- Player matching, friends, parties, and Discord voice channels for group gaming
- RAG-powered, interest-aware FaZe history facts grounded in the project history PDF
- Rewards, profile logos, merch orders, coupons, and points ledger
- Responsive React UI with Tailwind CSS, React Three Fiber, custom shaders, and reduced-motion fallbacks

## Stack

| Area | Technology |
| --- | --- |
| Frontend | React 19, Vite, React Router, Tailwind CSS |
| 3D UI | Three.js, React Three Fiber, drei, custom GLSL shaders |
| API | Node.js, Express 5, Zod |
| Database/RAG | MongoDB Atlas and the MongoDB Node driver |
| Auth | JWT bearer tokens, Steam OpenID |
| Deployment | Vercel frontend and Vercel Node function API |

## Repository layout

```text
.
├── api/                  # Vercel serverless entry point for the Express API
├── src/                  # Express routes, services, models, workers, and config
├── web/                  # React/Vite frontend
├── test/                 # Node test runner tests
├── Faker/                # Optional Discord party/voice-channel service
├── find_similiar_users/  # Optional standalone similar-users service
└── replica/              # Design tokens and visual reference material
```

## Run locally

### 1. Install dependencies

From the repository root:

```bash
npm install
cd web && npm install
cd ..
```

### 2. Configure the API

Copy the example environment file and fill in the required values:

```bash
cp .env.example .env
```

At minimum, the API needs:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/
MONGODB_DB=faze_platform
JWT_SECRET=use-a-long-random-secret
```

Never commit `.env` files or API keys.

## Integrated services

### RAG fun facts

The welcome page uses retrieval-augmented generation to create personalized FaZe history facts. The pipeline chunks `Fazeclanhistory.pdf`, embeds the chunks with Voyage AI, retrieves the most relevant passages for a member's interests, and uses OpenAI to produce a short fact constrained to that retrieved context. Embeddings are stored in the `faze_history_chunks` MongoDB collection.

Configure the RAG integration with:

```env
VOYAGE_API_KEY=...
VOYAGE_API_URL=https://ai.mongodb.com/v1/embeddings
VOYAGE_MODEL=voyage-4
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
```

After configuring the embedding service, ingest the history corpus:

```bash
npm run db:ingest-history
```

### Discord

Discord is integrated in three places:

- OAuth account linking from the member profile
- Match reminders and match-start announcements from the API worker
- Optional party voice-channel creation through the `Faker/` service

Relevant variables are:

```env
DISCORD_BOT_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_ANNOUNCE_CHANNEL_ID=...
DISCORD_PING_ROLE_ID=...
DISCORD_PARTY_SERVICE_URL=http://localhost:3100
DISCORD_PARTY_SERVICE_KEY=...
```

Register the production callback as:

```text
https://fazevault-api.vercel.app/auth/discord/callback
```

The party service is optional. If it is unavailable, party membership still works and only the voice-channel action is skipped.

### Twitch

Twitch is integrated through the official Twitch embed player and Twitch Helix API. The Watch page supports live channels, custom channel additions, offline detection, latest archived broadcast fallback, and server-verified watch-time points.

Configure replay lookup with:

```env
TWITCH_CLIENT_ID=...
TWITCH_CLIENT_SECRET=...
TWITCH_DAILY_POINT_CAP=1000
```

The API queries the newest archived broadcast with Twitch Helix when a channel is offline. Watch-time points are measured server-side and do not require Twitch API credentials.

### 3. Start the API

```bash
npm run dev
```

The API runs at `http://localhost:3000`.

### 4. Start the web app

In another terminal:

```bash
cd web
cp .env.example .env
npm run dev
```

The Vite app runs at `http://localhost:5173`. Set `VITE_API_URL=http://localhost:3000` in `web/.env` for live API mode. If it is omitted, the frontend uses its demo data layer.

## Useful commands

From the repository root:

```bash
npm test                 # run all backend and shared logic tests
npm run db:setup         # create validators and indexes
npm run db:seed-feed     # seed development feed data
npm run db:seed-shorts   # seed Shorts data
npm run twitch           # run the standalone Twitch service
```

From `web/`:

```bash
npm run dev              # local Vite development server
npm run build            # production build
npm run preview          # preview the production build
npm run tokens           # sync design tokens and regenerate texture assets
npm run roster           # regenerate roster data
npm run events           # regenerate event data
```

## Deployment

FaZe Verse is deployed as two Vercel projects:

1. `web` — the Vite frontend
2. `fazevault-api` — the Express API exposed through `api/index.js`

Deploy the frontend from `web/`:

```bash
cd web
vercel --prod
```

Deploy the API from the repository root:

```bash
vercel --prod
```

The frontend Production Environment must contain:

```env
VITE_API_URL=https://fazevault-api.vercel.app
```

The API Production Environment must contain the database, JWT, and integration variables required by the enabled features. For the integrated RAG, Discord, and Twitch features, add the variables shown above. `FRONTEND_URL` must match the public frontend domain so CORS and OAuth redirects work correctly.

For MongoDB Atlas, allow the deployment environment to reach the cluster through Atlas Network Access and use a database user with the required permissions.

## Status

FaZe Verse is an active prototype/community platform with RAG, Discord, and Twitch integrations. These features depend on valid third-party credentials and service availability. Demo mode remains available for frontend development when `VITE_API_URL` is not configured.
