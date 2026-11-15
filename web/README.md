# FaZe Vault web

React 19 + Vite + Tailwind 3, with React Three Fiber scenes and custom GLSL (`src/three/shaders.js`).

```bash
npm install
npm run dev          # demo mode on the fake data layer
cp .env.example .env # set VITE_API_URL to use the Express API in ../src
npm run tokens       # re-sync design tokens + regenerate the noise texture
npm run build
```

- `src/data/`: `fake.js` and `real.js` share signatures; `index.js` picks per-endpoint, so screens never change.
- `src/three/`: lazy-loaded; `SceneFrame` handles WebGL detection, reduced motion, off-screen pausing and adaptive DPR.
- Tokens come from `../replica/design`; components use role classes (`bg-surface`, `text-muted`), never raw hex.
