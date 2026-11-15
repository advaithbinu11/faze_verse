import { fake } from './fake.js';
import { real, loginUrl, tokenStore } from './real.js';

export const LIVE = Boolean(import.meta.env.VITE_API_URL);
// Real endpoints win where they exist; everything else keeps working on the fake layer.
export const api = LIVE ? { ...fake, ...real, mode: 'live' } : fake;
export { loginUrl, tokenStore };
