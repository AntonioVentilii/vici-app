# SEO / crawler surface

> Higher up the chain: [`README.md`](./README.md) → [`docs/ai/`](../README.md).

The app is a static SPA (`adapter-static`, `ssr = false`, `index.html`
fallback), so at runtime every URL serves the same shell. The crawler-facing
layer is generated **at deploy time** instead:

- [`src/app.html`](../../../src/app.html) carries the brand-generic head
  (title, description, canonical, OG/Twitter tags) every page falls back to.
- [`scripts/build/generate-seo-assets.ts`](../../../scripts/build/generate-seo-assets.ts)
  runs as the second `predeploy` step in
  [`juno.config.ts`](../../../juno.config.ts) and emits into `build/`:
  - `sitemap.xml` — public statics + one URL per visible market
    (referenced from [`static/robots.txt`](../../../static/robots.txt));
  - `markets/{id}/index.html` and `m/{id}/index.html` — copies of the built
    shell with that market's title/description swapped into the head tags.
    Both routes share one head; the `/m/{id}` share alias canonicalizes to
    `/markets/{id}`.

## Non-obvious constraints

- **The script must run on every hosting deploy.** `hosting deploy --prune`
  deletes assets missing from `build/` — a deploy without the SEO step wipes
  every previously deployed market page and the sitemap. This is why the
  script _hard-fails_ (failing the deploy) on registry errors, zero visible
  markets, or an `app.html` head tag its patterns no longer match.
- **`app.html` head tags are a contract.** The script rewrites them by
  pattern; rename/restructure them only together with the patterns in the
  script (it fails loudly when they drift, see the comment in `app.html`).
- **The WC reveal gate is replicated, not shared.** Visibility mirrors the
  feed gate (`$lib/utils/wc-schedule.utils`) but derives WC membership from
  the committed deck files (`scripts/data/markets.deck-2026*.json`, matched
  by normalized title) instead of Juno tags, so the script needs no
  satellite access. An unrevealed market's question must never appear in
  the emitted pages or sitemap — that would leak it before its Show Date.
- **Client rendering is unchanged.** The injected pages are byte-identical
  to the shell apart from head tags; the SPA hydrates them like any other
  entry URL. Per-market head content is English (registry `title` /
  `description.text`), matching the detail page's `<svelte:head>` title
  shape (`{title} | Vici Social Markets`).
- The script skips itself under `JUNO_EMULATOR=true` (E2E deploys have no
  mainnet registry to read).
