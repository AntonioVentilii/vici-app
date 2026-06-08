<script lang="ts">
	/**
	 * Proof band: a 3-step "How it works" micro-strip, a real count of
	 * people calling the World Cup, and a marquee ticker of @handles making
	 * calls. The count is the live aggregate of executed predictions on the
	 * World-Cup markets, read anonymously after first paint. Until that real
	 * figure resolves — and on any failure / no-WC-markets / 0 — the big
	 * number stays a pulsing dash placeholder; we never render a fake number.
	 * The ticker is decorative (aria-hidden) and scrolls via CSS (paused
	 * under reduced-motion).
	 */
	import { onMount } from 'svelte';
	import { LANDING_PROOF_CHIPS } from '$lib/constants/landing-data.constants';
	import { getWorldCupCallerCount } from '$lib/services/landing-proof.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
	import { prefersReducedMotion } from '$lib/utils/reduced-motion.utils';

	const tt = (key: MessageKey) => t({ locale: $localeStore, key });

	const steps: readonly { n: string; key: MessageKey }[] = [
		{ n: '01', key: 'welcome.how.s1' },
		{ n: '02', key: 'welcome.how.s2' },
		{ n: '03', key: 'welcome.how.s3' }
	];

	// Doubled so the CSS marquee loops seamlessly.
	const track = [...LANDING_PROOF_CHIPS, ...LANDING_PROOF_CHIPS];

	// `undefined` until the first successful real fetch. We never seed a
	// synthetic figure — a fake number that diverged from the real one would
	// be misleading. On any failure / no-WC-markets / 0 it stays `undefined`
	// and the big number keeps its pulsing dash placeholder.
	let count = $state<number | undefined>(undefined);

	onMount(() => {
		void getWorldCupCallerCount().then((real) => {
			if (real !== undefined && real > 0) {
				count = real;
			}
		});
	});

	// Locale-aware grouped figure once resolved; `undefined` while loading.
	const countLabel = $derived(count?.toLocaleString($localeStore));

	// Standalone caption rendered under the big number — carries no count.
	const liveLabel = $derived(tt('welcome.proof.live'));
</script>

<section class="lpc-proof">
	<div class="lpc-wrap lpc-how">
		{#each steps as s (s.n)}
			<div class="lpc-how-step">
				<span class="lpc-how-n">{s.n}</span>
				<span class="lpc-how-t">{tt(s.key)}</span>
			</div>
		{/each}
	</div>

	<div class="lpc-wrap lpc-proof-inner">
		<div class="lpc-proof-num" class:is-loading={countLabel === undefined}>
			{#if countLabel === undefined}
				<span class="acc" aria-hidden="true">—</span>
			{:else}
				<span class="acc">{countLabel}</span>
			{/if}
		</div>
		<div class="lpc-proof-label" aria-live="off">
			{liveLabel}
			{tt('welcome.proof.label')}
		</div>
	</div>

	<div class="lpc-ticker" aria-hidden="true">
		<div class="lpc-ticker-track" class:paused={prefersReducedMotion()}>
			{#each track as chip, i (i)}
				<span class="lpc-chip">
					<span class="who">@{chip.who}</span>
					<span class="side {chip.side === 'YES' ? 'yes' : 'no'}">{chip.side}</span>
					{chip.q}
				</span>
			{/each}
		</div>
	</div>
</section>
