<script lang="ts">
	/**
	 * Proof band: a 3-step "How it works" micro-strip, a live count of
	 * people calling right now, and a marquee ticker of @handles making
	 * calls. The count ticks up gently; the ticker is decorative
	 * (aria-hidden) and scrolls via CSS (paused under reduced-motion).
	 */
	import { onDestroy } from 'svelte';
	import {
		LANDING_PROOF_CHIPS,
		LANDING_PROOF_COUNT_SEED
	} from '$lib/constants/landing-data.constants';
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

	let count = $state(LANDING_PROOF_COUNT_SEED);

	let timer: ReturnType<typeof setInterval> | null = null;

	$effect(() => {
		if (prefersReducedMotion()) {
			return;
		}

		timer = setInterval(() => {
			count += Math.floor(Math.random() * 3);
		}, 2600);

		return () => {
			if (timer !== null) {
				clearInterval(timer);
				timer = null;
			}
		};
	});

	onDestroy(() => {
		if (timer !== null) {
			clearInterval(timer);
		}
	});

	// Locale-aware grouped count, shared by the big number and the label.
	const countLabel = $derived(count.toLocaleString($localeStore));

	// The figure lives only in the big `.lpc-proof-num`; the sentence
	// substitutes an empty `{count}` so it reads as plain prose under the
	// number. Trim the leading space the empty placeholder leaves behind.
	const liveLabel = $derived(
		t({
			locale: $localeStore,
			key: 'welcome.proof.live',
			params: { count: '' }
		}).trim()
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
