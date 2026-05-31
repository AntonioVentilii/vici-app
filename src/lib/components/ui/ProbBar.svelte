<script lang="ts">
	/**
	 * Compact YES/NO probability split bar. A single track whose filled
	 * width is the YES percentage; the fill is tinted YES when the side
	 * leads (≥ 50%) and flips to a NO gradient otherwise. Styling lives in
	 * the global `.probbar` rule (`app.css`); this primitive owns only the
	 * markup + the side-tint logic so the markets list row and the featured
	 * rail card render an identical bar.
	 */
	interface Props {
		/** YES percentage, 0–100. */
		yes: number;
	}

	const { yes }: Props = $props();
</script>

<div class="probbar">
	<i
		style:width="{yes}%"
		style:background={yes >= 50 ? undefined : 'linear-gradient(90deg, var(--no-deep), var(--no))'}
	></i>
</div>
