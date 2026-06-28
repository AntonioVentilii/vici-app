<script lang="ts">
	// The app's single pulsating data-placeholder. Renders a muted block that
	// breathes while data loads — use it instead of hand-rolling an
	// `animate-pulse` div so every skeleton shares one rhythm, one colour, and
	// the reduced-motion guard. The pulse itself lives once in `app.css`
	// (`.skeleton`, alongside the `char-*` idle loops); this primitive is the
	// ergonomic wrapper. Decorative by default (`aria-hidden`): the semantic
	// wrapper (`role="status"` / `aria-busy` / a labelled "Loading…") stays on
	// the consumer that knows what is loading.
	interface Props {
		/** Sizing/shape utilities the consumer owns (`h-5 w-28`, `rounded-full`). */
		class?: string;
		/** Inline overrides for size/radius driven by a CSS var (e.g. a badge frame). */
		style?: string;
		/** `soft` is a lighter fill for secondary blocks (body lines under a title). */
		tone?: 'default' | 'soft';
	}

	const { class: className = 'rounded-md', style, tone = 'default' }: Props = $props();
</script>

<span {style} class="skeleton {tone === 'soft' ? 'soft ' : ''}{className}" aria-hidden="true"
></span>
