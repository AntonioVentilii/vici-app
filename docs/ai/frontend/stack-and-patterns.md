# Stack & Patterns

Idiomatic patterns for the **SvelteKit 2 + Svelte 5 + TypeScript +
Tailwind v4** stack as it lives in this repo. If a pattern here disagrees
with code in `src/`, the code wins (truth hierarchy in
[governance.md](../governance.md)). Update this page in the same PR —
that's the [meta-update rule](../governance.md#meta-update-rule).

## Svelte 5 — runes everywhere

This project is **Svelte 5** and uses runes for new code:

| Use (new code)                                                                                     | Don't use (Svelte 4 style)                    |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Separate `interface Props { … }` + `let { … }: Props = $props()` (see [Props shape](#props-shape)) | `export let foo`                              |
| `let count = $state(0)`                                                                            | plain `let` for component-local reactive vars |
| `let total = $derived(price * qty)`                                                                | `$: total = price * qty`                      |
| `$effect(() => { /* I/O */ })`                                                                     | side-effect via `$:`                          |
| `<button onclick={fn}>`                                                                            | `on:click`                                    |
| `{#snippet}` + `{@render}`                                                                         | named `<slot>` for new code                   |

### Props shape

Always declare props as a **named `interface Props`** above the
destructuring, declared **inside** the component file. This keeps the
shape easy to read and easy to extend in tests / sibling components:

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Market } from '$lib/types/market';

	interface Props {
		market: Market;
		highlight?: boolean;
		onSelect?: (id: Market['id']) => void;
		footer?: Snippet;
	}

	let { market, highlight = false, onSelect = () => {}, footer }: Props = $props();
</script>
```

Rules:

- One `interface Props` per component, declared at the top of the
  `<script>` after imports.
- Required props first, optional / defaulted ones after.
- Callbacks default to a no-op (`() => {}`) so callers can omit them.
- **Avoid `$bindable`** unless explicitly required. The repo prefers
  callback props (`onChange`) over two-way bindings.
- Do **not** inline the type literal into `$props()` for new code — use a
  named `interface Props`.

### Effect hygiene

- Never read state inside an `$effect` and write it back without a guard —
  it loops. Restructure to `$derived` whenever possible.
- Prefer `$derived` over `$effect`. An `$effect` is for I/O (DOM, network,
  storage). Computation belongs in `$derived` / `$derived.by`.

### Stores still exist

Svelte stores (`writable` / `readable` / `derived` from `svelte/store`)
remain the primary cross-route reactive primitive in this repo. The graph
under `$lib/stores/` and `$lib/derived/` is mature — keep adding to it
where it fits an existing shape, rather than splitting the world between
runes and stores.

| Need                                           | Use                                                                    | Where it lives       |
| ---------------------------------------------- | ---------------------------------------------------------------------- | -------------------- |
| Component-local mutable value                  | `$state`                                                               | Inside the component |
| Component-local computed value                 | `$derived` / `$derived.by`                                             | Inside the component |
| Side effect (DOM, network, subscription)       | `$effect` (or `onMount` for true mount work)                           | Inside the component |
| Value shared by 2+ components in the same page | Pass via props / snippets                                              | —                    |
| Value shared across views (markets, wallet, …) | A Svelte `writable` / `readable` store, or a `*.svelte.ts` rune module | `$lib/stores/`       |
| Computed value across stores                   | `derived(...)` Svelte store                                            | `$lib/derived/`      |

Avoid duplicating server / canister state into a local store — fetch via
the service layer and let the service own caching.

## TypeScript

- **No `any`.** Use `unknown` and narrow.
- **No `as unknown as X`** to launder types. Either fix the type, or write
  a narrowing function.
- **No non-null assertion (`!`)** on values that can actually be null —
  use `isNullish` / `nonNullish` from `@dfinity/utils`, optional chaining,
  or an explicit guard with an early return.
- **Generated types are the source of truth at canister boundaries.**
  Always import types from `$declarations/<canister>/<canister>.did` for
  request / response shapes — never re-declare them.
- **Schemas first.** When data crosses a boundary (network, storage, the
  satellite), validate with the matching `zod` schema from
  `$lib/schema/`.
- **Discriminated unions** for `Result<T>` flows. Look at the closest
  neighbour and follow the same shape.
- **Type imports**: prefer `import type { … }` for types-only;
  `prettier-plugin-organize-imports` will sort them.
- **`BigInt` zero**: forbidden literal `0n` (eslint). Use the `ZERO`
  constant from `$lib/constants/app.constants`.

## Service / data flow

```
Component (.svelte)
  ↳ $lib/services/*.services.ts          orchestration, state mutations, error handling
       ↳ $lib/api/*.api.ts               wrappers around generated canister declarations
       ↳ $lib/canisters/*.canister.ts    typed actor factories
       ↳ @junobuild/core                 datastore + auth (used directly inside services)
```

- Components **do not** call `setDoc` / `getDoc` / `listDocs` / `fetch`
  directly. Always go through the matching service module.
- A `*.services.ts` function should:
  - Accept a typed input.
  - Use the identity helpers from
    [`$lib/services/identity.services.ts`](../../../src/lib/services/identity.services.ts)
    (`getIdentityOrAnonymous` for read paths, `safeGetIdentityOnce` for
    authenticated actions).
  - Surface errors via the project's notification / toast pattern (`$lib/stores/notification.store`).
  - Never throw to the caller for expected user errors — return an
    informative result.
- Worker-bound logic (auth workers) lives under `static/workers/` and is
  synced by `npm run postinstall`. Don't hand-edit those files.

Example shape (compressed from
[`$lib/services/market.services.ts`](../../../src/lib/services/market.services.ts)):

```ts
import { registryApi } from '$lib/api/registry.api';
import { VICI_ENGINE_ID } from '$lib/constants/icdc.constants';
import { safeGetIdentityOnce } from '$lib/services/identity.services';
import type { CreateMarketRequest } from '$lib/types/market';

export const createMarket = async (req: CreateMarketRequest): Promise<MarketId> => {
	const identity = await safeGetIdentityOnce();
	const engineId = req.userIsCreator ? VICI_ENGINE_ID : null;
	return registryApi.addSeries({ identity, engineId, ...req });
};
```

## Engine integration (icdc-core)

Vici talks to the on-chain Rust canisters in `../icdc-core/`. The Engine
model — what `engine_id` to pass, who has `Creator` / `OracleAdmin`, how
roles in Juno are mirrored to the Vici engine — is documented in
[`docs/engine-integration.md`](../../engine-integration.md). When writing
a new market / oracle path, **read that doc first**. The single place that
pins `VICI_ENGINE_ID` is
[`src/lib/constants/icdc.constants.ts`](../../../src/lib/constants/icdc.constants.ts).

## Identity & auth

- Principal source of truth:
  [`src/lib/services/identity.services.ts`](../../../src/lib/services/identity.services.ts).
- Use `getIdentityOrAnonymous` for public-read views.
- Use `safeGetIdentityOnce` for authenticated actions (it triggers the
  sign-in flow once if the user is anonymous).
- Auth uses Internet Identity + Google OpenID via Juno. The OpenID client
  IDs and delegation duration live in
  [`juno.config.ts`](../../../juno.config.ts).
- Auth worker assets must be synced via `npm run postinstall` to
  `./static/workers` — otherwise sign-in silently breaks.

## Tailwind v4 + design tokens

- **Use the project's tokens.** [`src/app.css`](../../../src/app.css)
  exposes the standard semantic palette (`primary`, `background`,
  `foreground`, `card`, `popover`, `muted-foreground`, `success`,
  `destructive`, `border`, `input`, …), plus repo-specific design
  tokens: the prediction signals (`yes` / `no` / `hold` and their
  `-deep` / `-wash` variants), the `laurel` brand ramp (`laurel` /
  `laurel-deep` / `laurel-glow`), `ink`, `ink-line` /
  `ink-line-strong` (theme-stable parchment lines for surfaces with
  hard-coded dark backgrounds), `border-strong`, the `ease-vici`
  curve, and the `inset-hi` / `inset-hi-strong` / `modal` shadows. For
  values Tailwind v4 doesn't generate utilities for natively (custom
  transition durations, composed multi-shadow values), the file also
  defines `@utility` wrappers — currently `duration-hover` /
  `duration-state` (bound to `--d-hover` / `--d-state`) and
  `shadow-mobilenav-active`. Use the generated utilities directly —
  `bg-card`, `text-yes`, `bg-no-wash`, `border-border-strong`,
  `border-ink-line`, `shadow-inset-hi`, `ease-vici`, `duration-hover`,
  `bg-laurel/20`.
- **No `[var(--…)]` arbitrary values for design tokens.** Tailwind v4
  generates `bg-foo` / `text-foo` / `border-foo` / `ring-foo` /
  `shadow-foo` / `ease-foo` utilities for every `--color-*`, `--shadow-*`
  and `--ease-*` token in `@theme`. If a token is missing from `@theme`,
  add it there in the same PR rather than reaching for
  `bg-[var(--my-token)]`. For values outside those Tailwind namespaces
  (custom transition durations, composed shadows), add an `@utility`
  wrapper instead of an arbitrary value with an embedded token. Same
  goes for `style="color: var(--foo)"` / `style="box-shadow: var(--foo)"`
  — use the utility.
- **No raw hex** (`bg-[#0f0]`).
- **Class order** is auto-sorted by `prettier-plugin-tailwindcss`. Don't
  bikeshed it.
- **Variants & responsive:** prefer Tailwind variants (`md:`, `dark:`,
  `data-[active=true]:`) over JS branches.
- The repo ships a "premium glassmorphic" design system. Match what the
  closest neighbour uses; don't introduce a competing aesthetic.

## Icons

- Default to `lucide-svelte` (`import { ArrowRight } from 'lucide-svelte';`).
- Bespoke icons live under `$lib/components/icons/`. Re-use them before
  inlining a new SVG.
- Decorative icons → `aria-hidden="true"`.
- Icon-only buttons → must have `aria-label`.

## Routing

- Single-route SvelteKit shell — see
  [`src/routes/(app)/+page.svelte`](<../../../src/routes/(app)/+page.svelte>).
  Top-level views (Markets, Portfolio, Wallet, Profile, Admin, …) are
  components, not separate `+page.svelte` files.
- Navigation state lives in
  [`src/lib/stores/nav.store.ts`](../../../src/lib/stores/nav.store.ts).
  Add a new view by extending the nav config in
  [`src/lib/constants/nav.constants.ts`](../../../src/lib/constants/nav.constants.ts)
  and the matching component in `$lib/components/pages/` (or its feature
  folder).
- Hard-coded URL paths go in
  [`src/lib/constants/routes.constants.ts`](../../../src/lib/constants/routes.constants.ts).

## Performance

- Wrap expensive work in `$derived.by` (cached) or in a `derived(...)`
  Svelte store, not in the render path.
- `{#each items as item (item.id)}` with a stable key.
- Lazy-load heavy modules with dynamic `import()` inside an `$effect` /
  event handler when they aren't needed on first paint.

## Anti-patterns (do not do these)

- `export let foo` in new code.
- Inline type literal in `$props()` (`let { … }: { … } = $props()`).
- Reactive `$:` statements in new code.
- `$bindable` unless explicitly required by the API.
- Reaching into `document.querySelector` to mutate Svelte-managed DOM.
- Catching an error and silently swallowing it; surface via
  `$lib/stores/notification.store` or propagate.
- Hard-coding strings, hex colours, magic numbers in components.
- "Just one more `any`" — there is no "just one more".
- Adding a wrapper component that only re-exports another component.
- `target="_blank"` without `rel="noopener noreferrer"`.
- `{@html …}` without sanitisation.
- `console.log` left in committed code.
- The word "bet" anywhere it could leak to a user (always "prediction").
- Time variables without a `_ms` / `_ns` suffix.
