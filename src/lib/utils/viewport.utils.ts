// Reactive viewport flags for Svelte components.
//
// The app switches from the floating pill nav to the top nav at the 56rem
// breakpoint (see `@media (min-width: 56rem)` in `app.css`); anything below
// that is treated as the mobile layout. Mirrors `reduced-motion.utils.ts`:
// a single module-level `MediaQuery` shared across all callers.

import { MediaQuery } from 'svelte/reactivity';

const mobile = new MediaQuery('(max-width: 55.999rem)');

export const isMobileViewport = (): boolean => mobile.current;
