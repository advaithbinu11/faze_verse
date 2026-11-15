# Build log

| Screen | Date | Status | Missing / notes |
|---|---|---|---|
| Shell (header, nav, theme, toasts, auth) | 2026-11-14 | done | Brand logo is a text wordmark until asset use is approved |
| Home (3D vault hero) | 2026-11-14 | done | Optional `public/models/vault.glb` replaces the procedural core |
| Live (pool 3D, predictions, updates) | 2026-11-14 | done | Round updates are seed data; no backend endpoint yet |
| Watch to earn (YouTube) | 2026-11-14 | partial | Needs `VITE_WATCH_VIDEO_ID` and a registered video; untested against a real player |
| Party up (clusters, board, match) | 2026-11-14 | done | Party chat/Discord link not surfaced |
| Feed | 2026-11-14 | partial | Fake layer only: backend has no posts API |
| Rewards | 2026-11-14 | partial | Fake layer only: backend has no redemption endpoint |
| Profile | 2026-11-14 | done | Steam inventory view not built |
| Create, Arcade | 2026-11-14 | stub | Roadmap placeholders |

Harder than expected: headless Chrome has a 500px minimum window width, so mobile checks need a real 390px iframe.
Not verified: live API integration, Steam login round trip, real YouTube player, keyboard-only pass in a browser, GPU (not software) rendering performance.
