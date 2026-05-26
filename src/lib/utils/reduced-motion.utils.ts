// Reactive `prefers-reduced-motion` flag for Svelte transitions.
//
// CSS `@media (prefers-reduced-motion: reduce)` does not affect Svelte's
// `transition:` / `in:` / `out:` directives, since those run as JS
// animations. Use this helper to short-circuit those params to a
// zero-duration tween when the user has reduced-motion enabled.

import { MediaQuery } from 'svelte/reactivity';

const reduce = new MediaQuery('(prefers-reduced-motion: reduce)');

export const prefersReducedMotion = (): boolean => reduce.current;
