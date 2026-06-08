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
		{ n: '01', key: 'welcome.v2.how.s1' },
		{ n: '02', key: 'welcome.v2.how.s2' },
		{ n: '03', key: 'welcome.v2.how.s3' }
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

	// The live count is interpolated into the label sentence; render the
	// sentence with the formatted count substituted in.
	const liveLabel = $derived(
		t({
			locale: $localeStore,
			key: 'welcome.v2.proof.live',
			params: { count: count.toLocaleString() }
		})
	);
</script>

<section class="v2-proof">
	<div class="v2-wrap v2-how">
		{#each steps as s (s.n)}
			<div class="v2-how-step">
				<span class="v2-how-n">{s.n}</span>
				<span class="v2-how-t">{tt(s.key)}</span>
			</div>
		{/each}
	</div>

	<div class="v2-wrap v2-proof-inner">
		<div class="v2-proof-num"><span class="acc">{count.toLocaleString()}</span></div>
		<div class="v2-proof-label" aria-live="off">
			{liveLabel}
			{tt('welcome.v2.proof.label')}
		</div>
	</div>

	<div class="v2-ticker" aria-hidden="true">
		<div class="v2-ticker-track" class:paused={prefersReducedMotion()}>
			{#each track as chip, i (i)}
				<span class="v2-chip">
					<span class="who">@{chip.who}</span>
					<span class="side {chip.side === 'YES' ? 'yes' : 'no'}">{chip.side}</span>
					{chip.q}
				</span>
			{/each}
		</div>
	</div>
</section>
