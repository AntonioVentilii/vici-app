<script lang="ts">
	interface Props {
		eyebrow: string;
		title: string;
		titleAccent?: string;
		sub: string;
	}

	const { eyebrow, title, titleAccent, sub }: Props = $props();
</script>

<header class="landing-section-header">
	<p class="eyebrow acc">{eyebrow}</p>
	<h2 class="landing-section-title display">
		{title}
		{#if titleAccent}
			<span class="serif-italic acc">{titleAccent}</span>
		{/if}
	</h2>
	<p class="landing-section-sub lede">{sub}</p>
</header>

<style lang="postcss">
	.landing-section-header {
		max-width: 42rem;
	}

	.landing-section-title {
		margin: 0.5rem 0 0;
		font-size: clamp(1.75rem, 4vw, 2.5rem);
		line-height: 1.05;
		color: var(--foreground);
	}

	.landing-section-sub {
		margin: 1rem 0 0;
		color: var(--muted-foreground);
	}
</style>
