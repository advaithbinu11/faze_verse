// Copies the generated token CSS from the design system so the app has no cross-folder CSS imports.
import { copyFileSync } from 'node:fs';
copyFileSync(new URL('../../replica/design/tokens.css', import.meta.url), new URL('../src/styles/tokens.css', import.meta.url));
console.log('tokens.css synced');
