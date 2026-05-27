<script lang="ts">
	import Trickster from '$lib/components/market/Trickster.svelte';
	import type { WelcomeMarketPreview } from '$lib/constants/welcome-markets.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		market: WelcomeMarketPreview;
	}

	const { market }: Props = $props();

	/**
	 * Simplified landing-surface port of the in-product FlowCard front face
	 * (see `src/lib/components/market/FlowCard.svelte`). The header tint is
	 * driven by the category accent token (`--cat-{category}`); the body
	 * mirrors the canonical predictor stack + probability split + payout
	 * roles + size/swipe footer. Surfaces the Trickster contrarian pill
	 * when the minority side is under 25% (prototype parity —
	 * `landing.jsx:520-545`). ConsensusCompass / MarketArtwork stay out
	 * of this card — those depend on Flow-surface primitives that don't
	 * ship on the public landing yet.
	 */
	const STAKE = 50;

	const yes = $derived(market.yesPercent);
	const no = $derived(100 - market.yesPercent);
	const yesIsFav = $derived(yes >= no);
	const winYes = $derived(Math.max(1, Math.round(STAKE / Math.max(0.05, yes / 100)) - STAKE));
	const winNo = $derived(Math.max(1, Math.round(STAKE / Math.max(0.05, no / 100)) - STAKE));
	const categoryLabelKey = $derived(`market.tag.${market.category}` as const);
	const daysUrgency = $derived(market.days <= 1 ? 'urgent' : market.days <= 7 ? 'soon' : 'normal');

	const minority = $derived(Math.min(yes, no));
	const showTrickster = $derived(minority < 25);
</script>

<article
	style="--cat-color: var(--cat-{market.category});"
	class="welcome-flow-card"
	aria-hidden="true"
>
	{#if showTrickster}
		<!-- Trickster pill — minority side under 25%. Absolute-positioned
		     so it sits over the tinted header on contrarian calls.
		     Prototype source: `landing.jsx:531-545`. -->
		<span class="welcome-flow-trickster">
			<Trickster lightning size={26} />
			<span class="welcome-flow-trickster-text">
				{minority}% {t({ locale: $localeStore, key: 'flow.companion.trickster.short' })}
			</span>
		</span>
	{/if}
	<!-- Tinted header — category-tinted gradient mirrors the in-product
	     FlowCard. -->
	<header class="welcome-flow-head">
		<div class="welcome-flow-head-row">
			<span class="welcome-flow-tag">
				{t({ locale: $localeStore, key: categoryLabelKey })}
			</span>
			<span class="welcome-flow-days num welcome-flow-days--{daysUrgency}">
				{market.days}d
			</span>
		</div>
		<h3 class="welcome-flow-question">{market.question}</h3>
	</header>

	<!-- Body — predictor avatars + probability split + payout actions + footer -->
	<div class="welcome-flow-body">
		<div class="welcome-flow-predictors">
			<span class="welcome-flow-avatars">
				<span class="welcome-flow-avatars-dot"></span>
				<span class="welcome-flow-avatars-dot"></span>
				<span class="welcome-flow-avatars-dot"></span>
				<span class="welcome-flow-avatars-dot"></span>
			</span>
			<span class="welcome-flow-predictors-meta num">
				{t({
					locale: $localeStore,
					key: 'welcome.deck.predictors_count',
					params: { count: market.calls }
				})}
			</span>
		</div>

		<!-- Probability split — single bar with NO/YES percentages either side. -->
		<div class="welcome-flow-probs">
			<div class="welcome-flow-probs-row">
				<div class="welcome-flow-probs-side welcome-flow-probs-side--no">
					<span class="welcome-flow-probs-pct num">{no}%</span>
					<span class="welcome-flow-probs-label">NO</span>
				</div>
				<div class="welcome-flow-probs-track" aria-hidden="true">
					<div
						style="width: {no}%"
						class="welcome-flow-probs-fill welcome-flow-probs-fill--no"
					></div>
					<div
						style="width: {yes}%"
						class="welcome-flow-probs-fill welcome-flow-probs-fill--yes"
					></div>
				</div>
				<div class="welcome-flow-probs-side welcome-flow-probs-side--yes">
					<span class="welcome-flow-probs-label">YES</span>
					<span class="welcome-flow-probs-pct num">{yes}%</span>
				</div>
			</div>
			<div class="welcome-flow-probs-action-row">
				<div class="welcome-flow-probs-action welcome-flow-probs-action--no">
					<span class="welcome-flow-probs-arrow" aria-hidden="true">←</span>
					<span class="welcome-flow-probs-payout num">+{winNo}</span>
					<span class="welcome-flow-probs-role">
						{yesIsFav ? 'LONG SHOT' : 'FAVORITE'}
					</span>
				</div>
				<div class="welcome-flow-probs-action welcome-flow-probs-action--yes">
					<span class="welcome-flow-probs-role">
						{yesIsFav ? 'FAVORITE' : 'LONG SHOT'}
					</span>
					<span class="welcome-flow-probs-payout num">+{winYes}</span>
					<span class="welcome-flow-probs-arrow" aria-hidden="true">→</span>
				</div>
			</div>
		</div>

		<footer class="welcome-flow-foot num">
			<span>
				{t({ locale: $localeStore, key: 'card.size_vxp', params: { stake: String(STAKE) } })}
			</span>
			<span>{t({ locale: $localeStore, key: 'card.swipe_to_call' })}</span>
		</footer>
	</div>
</article>

<style lang="postcss">
	.welcome-flow-card {
		position: relative;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-radius: var(--r-12);
		border: 1px solid var(--border-base);
		background: linear-gradient(180deg, var(--bg-popover), var(--bg-surface));
		box-shadow:
			var(--inset-hi),
			var(--shadow-card),
			0 26px 60px -34px color-mix(in srgb, var(--ink) 55%, transparent);
	}

	/* Trickster pill — landing-card parity with FlowCard. Absolute so it
	   sits over the tinted header on contrarian (minority < 25%) calls.
	   Prototype source: `landing.jsx:531-545`. */
	.welcome-flow-trickster {
		position: absolute;
		top: 14px;
		right: 14px;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px 6px 6px;
		border-radius: 999px;
		background: rgba(255, 138, 122, 0.14);
		border: 1px solid rgba(255, 138, 122, 0.35);
		z-index: 3;
	}
	.welcome-flow-trickster-text {
		font-family: var(--font-mono);
		font-size: 10px;
		color: #ff8a7a;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		font-weight: 600;
	}

	.welcome-flow-head {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		padding: 1.1rem 1.1rem 1rem;
		border-bottom: 1px solid color-mix(in srgb, var(--cat-color) 18%, transparent);
		background: linear-gradient(
			160deg,
			color-mix(in srgb, var(--cat-color) 14%, transparent),
			transparent 68%
		);
	}

	.welcome-flow-head-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.welcome-flow-tag {
		font-family: var(--font-display);
		font-size: var(--t-12);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		padding: 0.25rem 0.5rem;
		border-radius: var(--r-4);
		color: var(--cat-color);
		background: color-mix(in srgb, var(--cat-color) 14%, transparent);
	}

	.welcome-flow-days {
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--text-muted);
	}

	.welcome-flow-days--soon {
		color: var(--color-warning);
	}

	.welcome-flow-days--urgent {
		color: var(--no);
	}

	.welcome-flow-question {
		margin: 0;
		font-size: clamp(1.25rem, 2.5vw, 1.5rem);
		font-weight: 700;
		line-height: 1.18;
		letter-spacing: -0.02em;
		color: var(--foreground);
		text-wrap: balance;
	}

	.welcome-flow-body {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 1.1rem;
	}

	.welcome-flow-predictors {
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}

	.welcome-flow-avatars {
		display: inline-flex;
	}

	.welcome-flow-avatars-dot {
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 999px;
		background: var(--ink);
		border: 2px solid var(--bg-popover);
		margin-left: -0.4rem;
	}

	.welcome-flow-avatars-dot:first-child {
		margin-left: 0;
	}

	.welcome-flow-predictors-meta {
		font-size: var(--t-12);
		color: var(--text-muted);
	}

	.welcome-flow-probs {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.welcome-flow-probs-row {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.6rem;
	}

	.welcome-flow-probs-side {
		display: inline-flex;
		align-items: baseline;
		gap: 0.35rem;
		font-family: var(--font-display);
	}

	.welcome-flow-probs-side--no {
		color: var(--no);
	}

	.welcome-flow-probs-side--yes {
		color: var(--yes);
	}

	.welcome-flow-probs-pct {
		font-size: var(--t-20);
		font-weight: 700;
	}

	.welcome-flow-probs-label {
		font-size: var(--t-12);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
	}

	.welcome-flow-probs-track {
		position: relative;
		height: 6px;
		border-radius: 999px;
		background: var(--no-wash);
		overflow: hidden;
	}

	.welcome-flow-probs-fill {
		position: absolute;
		top: 0;
		bottom: 0;
		border-radius: 999px;
	}

	.welcome-flow-probs-fill--no {
		left: 0;
		background: linear-gradient(90deg, var(--no), color-mix(in srgb, var(--no) 65%, transparent));
	}

	.welcome-flow-probs-fill--yes {
		right: 0;
		background: linear-gradient(90deg, color-mix(in srgb, var(--yes) 65%, transparent), var(--yes));
	}

	.welcome-flow-probs-action-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.55rem;
	}

	.welcome-flow-probs-action {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		padding: 0.75rem 0.6rem;
		border-radius: var(--r-8);
		font-family: var(--font-display);
		font-weight: 700;
	}

	.welcome-flow-probs-action--no {
		color: var(--color-destructive);
		background: var(--no-wash);
		border: 1px solid color-mix(in srgb, var(--color-destructive) 22%, transparent);
	}

	.welcome-flow-probs-action--yes {
		color: var(--color-success);
		background: var(--yes-wash);
		border: 1px solid color-mix(in srgb, var(--color-success) 22%, transparent);
	}

	.welcome-flow-probs-arrow {
		font-size: 1.05rem;
		opacity: 0.7;
	}

	.welcome-flow-probs-payout {
		font-size: var(--t-15);
	}

	.welcome-flow-probs-role {
		font-size: 10px;
		letter-spacing: var(--tracking-allcaps);
		opacity: 0.85;
	}

	.welcome-flow-foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin: 0;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border-base);
		font-size: var(--t-12);
		color: var(--text-muted);
		letter-spacing: 0.04em;
	}
</style>
