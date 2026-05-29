<script lang="ts">
	/**
	 * Shared frame for the three landing "social proof" showcase cards
	 * (Leagues, Bout, Worlds Universities). Reproduces the common shell
	 * 1-to-1: elevated card with an accent gradient wash, an eyebrow row
	 * with an optional trailing badge, an `lp-h3` title with a
	 * serif-italic accent tail, a muted sub-line, the caller-supplied
	 * body, and a trailing accent CTA link with a chevron.
	 *
	 * Per-card variation is expressed through props/snippets — the
	 * gradient, eyebrow colour, optional badge and CTA target all differ
	 * between the three call sites.
	 */
	import { ChevronRight } from 'lucide-svelte/icons';
	import type { Snippet } from 'svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	interface Props {
		/** Full `linear-gradient(...)` value for the card background wash. */
		rootGradient: string;
		eyebrowKey: MessageKey;
		titleAKey: MessageKey;
		titleBKey: MessageKey;
		subKey: MessageKey;
		ctaKey: MessageKey;
		ctaHref: string;
		/** Extra class on the eyebrow span (e.g. `acc` for the laurel ramp). */
		eyebrowClass?: string;
		/** Inline colour for the eyebrow when not using a class-driven ramp. */
		eyebrowColor?: string;
		/** Params for the sub-line i18n string (e.g. `{ count }`). */
		subParams?: Record<string, string | number>;
		/** Optional trailing badge in the eyebrow row. */
		badge?: Snippet;
		/** Card body between the sub-line and the CTA. */
		children: Snippet;
	}

	let {
		rootGradient,
		eyebrowKey,
		titleAKey,
		titleBKey,
		subKey,
		ctaKey,
		ctaHref,
		eyebrowClass = '',
		eyebrowColor,
		subParams,
		badge,
		children
	}: Props = $props();
</script>

<div
	style="
		padding:20px; position:relative; overflow:hidden;
		display:flex; flex-direction:column;
		background:{rootGradient};
	"
	class="card-elevated lp-root"
>
	<div
		style="margin-bottom:8px; align-items:baseline; flex-wrap:wrap; gap:8px;"
		class="row between"
	>
		<span
			style="{eyebrowColor ? `color:${eyebrowColor}; ` : ''}letter-spacing:var(--tracking-allcaps);"
			class="eyebrow {eyebrowClass}"
		>
			{t({ locale: $localeStore, key: eyebrowKey })}
		</span>
		{@render badge?.()}
	</div>
	<h3 style="margin-top:4px;" class="lp-h3">
		{t({ locale: $localeStore, key: titleAKey })}
		<span class="serif-italic acc">{t({ locale: $localeStore, key: titleBKey })}</span>
	</h3>
	<p style="margin-top:10px; line-height:1.5;" class="dim t-body-sm">
		{t({ locale: $localeStore, key: subKey, params: subParams })}
	</p>

	{@render children()}

	<a
		style="
			display:inline-flex; align-items:center; gap:6px; margin-top:auto; padding-top:16px;
			color:var(--accent); text-decoration:none; font-weight:600; font-size:14px;
		"
		class="lp-social-cta"
		href={ctaHref}
	>
		{t({ locale: $localeStore, key: ctaKey })}
		<ChevronRight aria-hidden="true" size={14} />
	</a>
</div>
