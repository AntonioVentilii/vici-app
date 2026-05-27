<script lang="ts">
	import { ArrowLeft } from 'lucide-svelte/icons';
	import { resolve } from '$app/paths';
	import { PublicPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import type { InfoDoc } from '$lib/types/info-doc';
	import { t } from '$lib/utils/i18n.utils';
	import { goBack } from '$lib/utils/nav.utils';

	/**
	 * Info / legal doc page — port of the design source's
	 * `InfoScreen` (`screens.jsx:1677-1735`).
	 *
	 * Layout is a single-column reading view with:
	 *  - top back arrow (borderless ghost)
	 *  - laurel-accented eyebrow at 0.16em letter-spacing
	 *  - serif-italic lede paragraph
	 *  - sans-serif body paragraphs at 1.65 line-height
	 *  - custom accent-dot bulleted lists
	 *  - mono-font mailto links underlined in faint laurel
	 *  - bottom "Back to settings" affordance below a 1px divider
	 *
	 * Lists carry a 4px accent dot positioned absolutely at the left
	 * of each item — not the default `list-disc`. Mail links use the
	 * mono font + accent underline + 3px text-underline-offset for the
	 * "Tweet-style" reference look the design system favours.
	 *
	 * Legal docs surface a pending-review banner so users know the
	 * copy is still awaiting sign-off.
	 */

	interface Props {
		doc: InfoDoc;
	}

	let { doc }: Props = $props();

	const isLegalDoc = $derived(doc.eyebrow.toLowerCase().startsWith('legal'));

	const handleBack = () => goBack(resolve(PublicPath.Welcome));
</script>

<svelte:head>
	<title>{doc.title} · VICI</title>
</svelte:head>

<div class="info-page">
	<header class="info-appbar">
		<button class="appbar-icon-btn" onclick={handleBack} type="button">
			<ArrowLeft aria-hidden="true" size={18} strokeWidth={1.8} />
			<span class="sr-only">{t({ locale: $localeStore, key: 'info.back' })}</span>
		</button>
		<span class="info-appbar-spacer" aria-hidden="true"></span>
	</header>

	<div class="info-body">
		<div class="info-eyebrow allcaps">{doc.eyebrow}</div>
		<!-- Massive display h1 — title at hero scale (~44-56 px
		     serif/italic, multi-line wraps) rather than a cramped
		     appbar treatment. -->
		<h1 class="info-hero-title display">{doc.title}</h1>

		{#if isLegalDoc}
			<aside class="info-legal-banner" role="note">
				<span class="info-legal-banner-dot" aria-hidden="true"></span>
				<span>{t({ locale: $localeStore, key: 'info.placeholder_legal_banner' })}</span>
			</aside>
		{/if}

		<article class="info-article">
			{#each doc.blocks as block, i (i)}
				{#if block.kind === 'lede'}
					<p class="info-lede serif-italic">{block.text}</p>
				{:else if block.kind === 'h'}
					<h2 class="info-heading">{block.text}</h2>
				{:else if block.kind === 'p'}
					<p class="info-paragraph">{block.text}</p>
				{:else if block.kind === 'list'}
					<ul class="info-list">
						{#each block.items as item, j (j)}
							<li class="info-list-item">{item}</li>
						{/each}
					</ul>
				{:else if block.kind === 'mail'}
					<a class="info-mail num" href="mailto:{block.text}">{block.text}</a>
				{/if}
			{/each}
		</article>

		<!--
			Bottom back-to-settings affordance — divider + ghost button.
			Lands at the Welcome route in our app; the `settings` page
			lives behind the auth wall and the public info routes can't
			assume the user is signed in.
		-->
		<div class="info-foot">
			<button class="info-foot-back" onclick={handleBack} type="button">
				<ArrowLeft aria-hidden="true" size={14} strokeWidth={1.8} />
				<span>{t({ locale: $localeStore, key: 'info.back' })}</span>
			</button>
		</div>
	</div>
</div>

<style lang="postcss">
	.info-page {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.5rem 0 2rem;
	}

	.info-appbar {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 1rem;
	}

	/* Hero h1 — replaces the appbar's tight title. Display-font scale,
	   serif italic, generous line-height for multi-line wraps. */
	.info-hero-title {
		margin: 0.5rem 0 1.25rem;
		font-family: var(--font-serif, var(--font-display, serif));
		font-style: italic;
		font-weight: 400;
		font-size: clamp(2.25rem, 8.5vw, 3.5rem);
		line-height: 1.05;
		letter-spacing: -0.015em;
		color: var(--text-base);
		text-wrap: balance;
	}

	.info-appbar-spacer {
		width: 2.5rem;
	}

	.info-body {
		display: flex;
		flex-direction: column;
		gap: 0;
		padding: 0.25rem 1.5rem 2rem;
		max-width: 40rem;
		margin: 0 auto;
		width: 100%;
	}

	/* Eyebrow uses the primary accent + 0.16em letter-spacing for the
	   editorial eyebrow look. */
	.info-eyebrow {
		margin-bottom: 0.875rem;
		font-size: var(--t-11, 0.7rem);
		font-weight: 700;
		letter-spacing: 0.16em;
		color: var(--color-primary);
	}

	.info-legal-banner {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.55rem 0.75rem;
		margin-bottom: 1rem;
		font-size: var(--t-13);
		color: color-mix(in srgb, var(--text-base) 85%, transparent);
		background: color-mix(in srgb, var(--color-primary) 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-primary) 25%, var(--border-base));
		border-radius: var(--r-8);
	}

	.info-legal-banner-dot {
		display: inline-block;
		width: 0.4rem;
		height: 0.4rem;
		margin-top: 0.45rem;
		border-radius: 999px;
		background: var(--color-primary);
		flex-shrink: 0;
	}

	.info-article {
		display: flex;
		flex-direction: column;
	}

	/* Serif-italic lede paragraph — sets the editorial tone before
	   the body copy. Gold-tinted accent reads as the pull-quote that
	   frames the doc. */
	.info-lede {
		margin: 0 0 1.5rem;
		font-size: clamp(1.15rem, 4.2vw, 1.5rem);
		line-height: 1.45;
		color: var(--color-primary);
		text-wrap: balance;
	}

	.info-heading {
		margin: 1.4rem 0 0.5rem;
		font-size: var(--t-15, 0.95rem);
		font-weight: 600;
		letter-spacing: -0.005em;
		color: var(--text-base);
	}

	.info-paragraph {
		margin: 0 0 0.75rem;
		font-size: var(--t-14);
		line-height: 1.65;
		color: var(--text-muted);
	}

	/* Custom accent-dot list — matches `screens.jsx:1710-1716`:
	   absolutely-positioned 4px primary-coloured dot at the left of
	   each item, no default `list-disc` bullet. */
	.info-list {
		margin: 0 0 0.875rem;
		padding-left: 1.125rem;
		list-style: none;
	}

	.info-list-item {
		position: relative;
		padding-left: 0.875rem;
		margin: 0 0 0.25rem;
		font-size: var(--t-14);
		line-height: 1.65;
		color: var(--text-muted);
	}

	.info-list-item::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0.6rem;
		width: 4px;
		height: 4px;
		border-radius: 999px;
		background: var(--color-primary);
	}

	/* Mono-font mailto with faint primary-coloured underline. */
	.info-mail {
		display: inline-block;
		margin-bottom: 0.75rem;
		font-family: var(--font-mono);
		font-weight: 600;
		font-size: var(--t-14);
		color: var(--color-primary);
		text-decoration: underline;
		text-decoration-color: color-mix(in srgb, var(--color-primary) 40%, transparent);
		text-underline-offset: 3px;
	}

	.info-mail:hover {
		text-decoration-color: var(--color-primary);
	}

	.info-foot {
		margin-top: 2rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-base);
	}

	.info-foot-back {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.5rem 0.875rem;
		font-size: var(--t-13);
		color: var(--text-muted);
		text-decoration: none;
		border: 0;
		background: transparent;
		border-radius: var(--r-8);
		cursor: pointer;
	}

	.info-foot-back:hover {
		color: var(--text-base);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
