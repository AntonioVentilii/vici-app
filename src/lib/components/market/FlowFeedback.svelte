<script lang="ts">
	import { Zap } from 'lucide-svelte/icons';
	import { onDestroy, onMount } from 'svelte';
	import FlameChar from '$lib/components/characters/FlameChar.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import type { FlowAction } from '$lib/types/market';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * FlowFeedback — post-swipe Oracle pop layered over the deck. Skip
	 * shows a quick "SKIPPED" chip (~520 ms); YES / NO show the full
	 * laurel-glow burst with a serif-italic phrase + VXP delta + the
	 * predicted side and, on streak milestones, the Flame character
	 * pill. Self-dismissing — the parent only needs to mount it and
	 * react to `onDone`.
	 *
	 * Prototype source: `VICI WebApp Beta V1.2/flow.jsx:1297-1353`.
	 */
	interface Props {
		result: FlowAction;
		xp: number;
		correct?: boolean;
		streakHit?: boolean;
		onDone: () => void;
	}

	const { result, xp, correct = true, streakHit = false, onDone }: Props = $props();

	const isSkip = $derived(result === 'SKIP');

	let timer: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {
		timer = setTimeout(onDone, isSkip ? 520 : 1300);
	});

	onDestroy(() => {
		if (timer !== null) {
			clearTimeout(timer);
		}
	});

	// Random index picked once per mount so consecutive commits don't
	// always echo the same line; the right/wrong list is selected
	// reactively from `correct` so a late prop flip (rare but possible)
	// updates the rendered phrase.
	const phraseIdx = Math.floor(Math.random() * 3);
	const phraseKey = $derived(
		(correct
			? (['flow.feedback.right_1', 'flow.feedback.right_2', 'flow.feedback.right_3'] as const)
			: (['flow.feedback.wrong_1', 'flow.feedback.wrong_2', 'flow.feedback.wrong_3'] as const))[
			phraseIdx
		]
	);

	const sideLabelKey: 'outcome.yes' | 'outcome.no' = $derived(
		result === 'YES' ? 'outcome.yes' : 'outcome.no'
	);

	const sideClass = $derived(result === 'YES' ? 'yes' : 'no');
</script>

{#if isSkip}
	<div class="flow-feedback flow-feedback-skip">
		<div class="flow-feedback-skip-chip t-eyebrow">
			{t({ locale: $localeStore, key: 'flow.feedback.skipped' })}
		</div>
	</div>
{:else}
	<div class="flow-feedback">
		<div class="bolt-burst">
			<Zap aria-hidden="true" size={32} strokeWidth={2.4} />
		</div>
		<div class="flow-feedback-phrase">
			{t({ locale: $localeStore, key: phraseKey })}
		</div>
		<div class="num t-h2 fw-600 flow-feedback-amount">
			+{xp}
			{t({ locale: $localeStore, key: 'flow.feedback.vxp' })}
		</div>
		<div class="row flow-feedback-row">
			<span class="eyebrow mute">
				{t({ locale: $localeStore, key: 'flow.feedback.you_predicted' })}
			</span>
			<span class="eyebrow is-{sideClass}">
				{t({ locale: $localeStore, key: sideLabelKey })}
			</span>
		</div>
		{#if streakHit}
			<div class="row flow-feedback-streak">
				<FlameChar animate size={26} stage="flame" />
				<span class="t-sub flow-feedback-streak-label">
					{t({ locale: $localeStore, key: 'flow.feedback.streak_milestone' })}
				</span>
			</div>
		{/if}
	</div>
{/if}

<style lang="postcss">
	/* Layer rules — sized + animated inline-fashion via the shared
	   `.flow-feedback` block in `app.css`. We add only the local rules
	   the prototype declared inline-style: the bolt-burst envelope, the
	   serif phrase, the side-chip colours, the streak pill. */

	.flow-feedback-amount {
		color: var(--fg);
		animation: fade-up 320ms var(--ease) 140ms both;
	}
	.flow-feedback-row {
		gap: 6px;
		animation: fade-up 320ms var(--ease) 200ms both;
	}
	.flow-feedback-row .eyebrow.is-yes {
		color: var(--yes);
		font-weight: 700;
	}
	.flow-feedback-row .eyebrow.is-no {
		color: var(--no);
		font-weight: 700;
	}
	.flow-feedback-streak {
		gap: 8px;
		margin-top: 8px;
		padding: 6px 12px 6px 6px;
		border-radius: 999px;
		background: rgba(240, 138, 60, 0.08);
		border: 1px solid rgba(240, 138, 60, 0.28);
		animation: fade-up 320ms var(--ease) 280ms both;
	}
	.flow-feedback-streak-label {
		color: var(--char-flame, #f08a3c);
		font-weight: 600;
	}
</style>
