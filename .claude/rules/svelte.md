# Svelte 5 Patterns (Claude quick-reference)

> **Authoritative source:** [`docs/ai/frontend/stack-and-patterns.md`](../../docs/ai/frontend/stack-and-patterns.md).
> This card is a Claude-only summary. If it disagrees with the doc above,
> the doc above wins.

- **Idiomatic Code:** always follow Svelte 5 best practices and patterns.
- **Runes:** use for component-local state — `$state`, `$derived`, `$effect`.
  Cross-view shared state still uses Svelte stores in `$lib/stores/`.
- **Props syntax:** named `interface Props` + destructure with types.

  ```svelte
  <script lang="ts">
  	interface Props {
  		title: string;
  		highlight?: boolean;
  		onSelect?: () => void;
  	}

  	let { title, highlight = false, onSelect = () => {} }: Props = $props();
  </script>
  ```

- **Interface declaration:** declare the `Props` interface directly within
  the `.svelte` file for better encapsulation and visibility.
- **Two-way binding:** avoid `$bindable` unless explicitly required —
  prefer a callback prop (`onChange`).

For event handling, snippets, derived stores, and the full anti-pattern
list, read
[`docs/ai/frontend/stack-and-patterns.md`](../../docs/ai/frontend/stack-and-patterns.md).
