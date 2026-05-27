<script lang="ts">
	/**
	 * Renders the canonical Flow-front face for landing surfaces:
	 * header tint, days chip, optional Trickster pill on minority<25%,
	 * ConsensusCompass, editorial italic context line, predictor stack
	 * + delta-today, probability split bar with payouts + roles, and
	 * the size / swipe footer. Class names align with `src/landing.css`.
	 */

	import LandingAvatarStack from '$lib/components/landing/LandingAvatarStack.svelte';
	import LandingConsensusCompass from '$lib/components/landing/LandingConsensusCompass.svelte';
	import LandingTrickster from '$lib/components/landing/LandingTrickster.svelte';
	import {
		LANDING_CAT_COLORS,
		LANDING_CAT_LABELS,
		type LandingMarket
	} from '$lib/constants/landing-data.constants';

	interface Props {
		market: LandingMarket;
	}

	const { market }: Props = $props();

	const STAKE = 50;
	const yes = $derived(market.yes);
	const no = $derived(100 - market.yes);
	const yesIsFav = $derived(yes >= no);
	const winYes = $derived(Math.max(1, Math.round(STAKE / Math.max(0.05, yes / 100)) - STAKE));
	const winNo = $derived(Math.max(1, Math.round(STAKE / Math.max(0.05, no / 100)) - STAKE));
	const minority = $derived(Math.min(yes, no));
	const showTrickster = $derived(minority < 25);
	const accent = $derived(LANDING_CAT_COLORS[market.cat]);
	const catLabel = $derived(LANDING_CAT_LABELS[market.cat]);
	const daysLeft = $derived(market.days);
	const daysClass = $derived(daysLeft <= 1 ? 'urgent' : daysLeft <= 7 ? 'soon' : '');
	const predictors = $derived(market.predictors ?? 1240);
	// Deterministic synthetic delta from market id —
	// `seedFromId(market.id) % 90 + 10` produces a stable ~10..99 value.
	const seed = $derived([...market.id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0));
	const delta = $derived((seed % 90) + 10);
</script>

<div style="position:absolute; inset:0;" class="flow-face flow-front">
	{#if showTrickster}
		<div
			style="position:absolute; top:14px; right:14px; display:inline-flex; align-items:center; gap:8px; padding:6px 10px 6px 6px; border-radius:999px; background:rgba(255,138,122,0.14); border:1px solid rgba(255,138,122,0.35); z-index:3;"
		>
			<LandingTrickster lightning size={26} />
			<span
				style="font-family:var(--font-mono); font-size:10px; color:#FF8A7A; text-transform:uppercase; letter-spacing:0.12em; font-weight:600;"
			>
				{minority}% agree · 2× XP
			</span>
		</div>
	{/if}

	<div
		style="background:linear-gradient(160deg, {accent}26 0%, {accent}10 60%, transparent 100%); border-bottom:1px solid {accent}1F;"
		class="flow-head"
	>
		<div class="row between">
			<div style="gap:8px;" class="row">
				<span style="color:{accent}; background:rgba(242,236,220,0.06);" class="tag">
					{catLabel}
				</span>
				{#if daysLeft != null}
					<span class="flow-days num {daysClass}">{daysLeft}d</span>
				{/if}
			</div>
			{#if !showTrickster}
				<LandingConsensusCompass {yes} />
			{/if}
		</div>
		<h2 class="flow-q">{market.q}</h2>
		<p class="flow-ctx-editorial">{market.ctx}</p>
	</div>

	<div class="flow-body">
		<div class="row between">
			<div style="gap:8px;" class="row">
				<LandingAvatarStack />
				<span class="num mute t-eyebrow">
					{predictors.toLocaleString()} predicting
					<span style="margin:0 5px; color:var(--fg-faint);">·</span>
					<span style="color:var(--yes); font-weight:700;">+{delta} today</span>
				</span>
			</div>
		</div>

		<div class="flow-probs">
			<div class="flow-probs-row">
				<div class="flow-probs-side no" data-side="no">
					<span class="flow-probs-pct">{no}%</span>
					<span class="flow-probs-label no">NO</span>
				</div>
				<div class="flow-probs-track" aria-hidden="true">
					<div style="width:{no}%;" class="flow-probs-fill-no"></div>
					<div style="width:{yes}%;" class="flow-probs-fill-yes"></div>
				</div>
				<div class="flow-probs-side yes" data-side="yes">
					<span class="flow-probs-label yes">YES</span>
					<span class="flow-probs-pct">{yes}%</span>
				</div>
			</div>
			<div class="flow-probs-action-row">
				<div class="flow-probs-action no">
					<span class="flow-probs-arrow">←</span>
					<span class="flow-probs-payout">+{winNo}</span>
					<span class="flow-probs-role">{yesIsFav ? 'LONG SHOT' : 'FAVORITE'}</span>
				</div>
				<div class="flow-probs-action yes">
					<span class="flow-probs-role">{yesIsFav ? 'FAVORITE' : 'LONG SHOT'}</span>
					<span class="flow-probs-payout">+{winYes}</span>
					<span class="flow-probs-arrow">→</span>
				</div>
			</div>
		</div>

		<div class="row between flow-foot">
			<span style="letter-spacing:0.10em;" class="num mute t-eyebrow">
				SIZE · {STAKE} VXP
			</span>
			<span style="letter-spacing:0.14em;" class="num mute t-eyebrow"> SWIPE TO CALL </span>
		</div>
	</div>
</div>
