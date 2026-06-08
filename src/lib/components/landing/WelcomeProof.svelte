<script lang="ts">
	/**
	 * Proof band: a 3-step "How it works" micro-strip, a real count of
	 * people calling the World Cup, and a marquee ticker of @handles making
	 * calls. The count is the live aggregate of executed predictions on the
	 * World-Cup markets, read anonymously after first paint (with a synthetic
	 * seed as a silent fallback); the ticker is decorative (aria-hidden) and
	 * scrolls via CSS (paused under reduced-motion).
	 */
	import { onMount } from 'svelte';
	import {
		LANDING_PROOF_CHIPS,
		LANDING_PROOF_COUNT_SEED
	} from '$lib/constants/landing-data.constants';
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

	// Seeded with the synthetic figure so the band renders immediately and
	// never flashes 0/blank. After first paint we swap in the real aggregate
	// (executed predictions across the World-Cup markets, read anonymously).
	// Any failure / no-WC-markets / 0 leaves the seed in place — silent
	// fallback, never a spinner, blank, or thrown error.
	let count = $state(LANDING_PROOF_COUNT_SEED);

	onMount(() => {
		void getWorldCupCallerCount().then((real) => {
			if (real !== undefined && real > 0) {
				count = real;
			}
		});
	});

	// Locale-aware grouped count, shared by the big number and the label.
	const countLabel = $derived(count.toLocaleString($localeStore));

	// The live count is interpolated into the label sentence; render the
	// sentence with the formatted count substituted in.
	const liveLabel = $derived(
		t({
			locale: $localeStore,
			key: 'welcome.proof.live',
			params: { count: countLabel }
		})
	);
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
		<div class="lpc-proof-num"><span class="acc">{countLabel}</span></div>
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
