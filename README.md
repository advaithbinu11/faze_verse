# FaZe Verse

FaZe Verse is an unofficial FaZe Clan fan platform for watching, earning, connecting, and keeping track of your place in the community.

The project combines a React web experience with an Express API backed by MongoDB Atlas. Members can sign in, follow players and teams, earn FaZe Points, watch Twitch and YouTube content, discover similar players, make friends, join parties, browse merch, and personalize their profile.

> This is a community-built fan project and is not affiliated with or endorsed by FaZe Clan.

## Highlights

- Steam OAuth and email/password authentication
- Personalized welcome page with player matches and FaZe history facts
- Twitch live streams, replay fallback, and watch-time points
- YouTube watch sessions and Shorts recommendations
- Community feed with posts, likes, comments, and point rewards
- Player matching, friends, parties, and  Discord voice channels for group gaming
- Rewards, profile logos, merch orders, coupons, and points ledger
- Responsive React UI with Tailwind CSS, React Three Fiber, custom shaders, and reduced-motion fallbacks

## Stack

| Area | Technology |
| --- | --- |
| Frontend | React 19, Vite, React Router, Tailwind CSS |
| 3D UI | Three.js, React Three Fiber, drei, custom GLSL shaders |
| API | Node.js, Express 5, Zod |
| Database | MongoDB Atlas and the MongoDB Node driver |
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

Optional integrations include Steam, Twitch, Discord, Voyage, and OpenAI. Never commit `.env` files or API keys.

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

The API Production Environment must contain the database, JWT, and integration variables required by the enabled features. `FRONTEND_URL` must match the public frontend domain so CORS and OAuth redirects work correctly.

For MongoDB Atlas, allow the deployment environment to reach the cluster through Atlas Network Access and use a database user with the required permissions.

## Status

FaZe Verse is an active prototype/community platform. Some integrations depend on third-party availability and credentials, including Twitch, Steam, Discord, YouTube, MongoDB Atlas, and optional AI services. Demo mode remains available for frontend development when `VITE_API_URL` is not configured.
