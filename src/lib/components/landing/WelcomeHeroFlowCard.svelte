<script lang="ts">
	import type { WelcomeHeroWcMarket } from '$lib/constants/welcome-hero-wc.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		market: WelcomeHeroWcMarket;
	}

	const { market }: Props = $props();

	/**
	 * Faithful landing-surface port of the prototype's `LandingFlowCard`
	 * (landing.jsx:498-637). Composition matches the in-product
	 * `FlowCard` layout — Trickster pill, tinted header, predictor
	 * stack, rich SVG figure band, probability split, payout role row,
	 * size/swipe footer — but uses static hero fixtures and the
	 * `var(--laurel)` accent (the tentpole World Cup colour) for header
	 * + chip tint rather than the live in-product palette.
	 */
	const STAKE = 50;

	const yes = $derived(market.yesPercent);
	const no = $derived(100 - market.yesPercent);
	const yesIsFav = $derived(yes >= no);
	const winYes = $derived(Math.max(1, Math.round(STAKE / Math.max(0.05, yes / 100)) - STAKE));
	const winNo = $derived(Math.max(1, Math.round(STAKE / Math.max(0.05, no / 100)) - STAKE));
	const daysUrgency = $derived(market.days <= 1 ? 'urgent' : market.days <= 7 ? 'soon' : 'normal');

	// Trickster pill — the prototype surfaces a `{minority}% AGREE · 2× XP`
	// badge top-right whenever the minority side is < 25%. The minority
	// is whichever of yes / no is smaller; for Brazil 18% YES the badge
	// reads "18% AGREE · 2× XP".
	const minoritySide = $derived(Math.min(yes, no));
	const showTrickster = $derived(minoritySide < 25);

	// Locale-aware number formatting — predictors `1,240` in en-US,
	// `1.240` in de-DE. Drives both the predictor count and the callers
	// pulse pill.
	const predictorsLabel = $derived(market.predictors.toLocaleString($localeStore));
	const callersLabel = $derived(market.callersLastHour.toLocaleString($localeStore));
</script>

<article
	class="welcome-flow-card welcome-flow-card--{market.category}"
	class:welcome-flow-card--has-figure={market.hasFigure}
	aria-hidden="true"
>
	<!-- Top-right Trickster pill — absolute-positioned over the header
	     so it hangs off the card edge per the prototype. Surfaces only
	     when the minority side is < 25%. -->
	{#if showTrickster}
		<div class="welcome-flow-trickster" aria-hidden="true">
			<span class="welcome-flow-trickster-row">
				<span class="welcome-flow-trickster-pct num">{minoritySide}%</span>
				<span class="welcome-flow-trickster-label">
					{t({ locale: $localeStore, key: 'welcome.deck.trickster_label' })}
				</span>
			</span>
			<span class="welcome-flow-callers num">
				{t({
					locale: $localeStore,
					key: 'welcome.deck.callers_last_hour',
					params: { count: callersLabel }
				})}
			</span>
		</div>
	{/if}

	<!-- Tinted header — World Cup laurel-gold gradient mirrors the
	     prototype's `bg: linear-gradient(...var(--laurel)...)` treatment. -->
	<header class="welcome-flow-head">
		<div class="welcome-flow-head-row">
			<span class="welcome-flow-tag">
				{t({ locale: $localeStore, key: 'market.tag.wc' })}
			</span>
			<span class="welcome-flow-days num welcome-flow-days--{daysUrgency}">
				{market.days}d
			</span>
		</div>
		<h2 class="welcome-flow-question">{market.question}</h2>
		<p class="welcome-flow-ctx">{market.accentCtx}</p>
	</header>

	<!-- Body — predictor avatars + delta + rich figure band + probability
	     split + payout actions + footer -->
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
					params: { count: predictorsLabel }
				})}
				<span class="welcome-flow-predictors-sep">·</span>
				<span class="welcome-flow-predictors-delta">
					{t({
						locale: $localeStore,
						key: 'welcome.deck.delta_today',
						params: { count: market.deltaToday }
					})}
				</span>
			</span>
		</div>

		<!-- Rich figure band — Brazil tentpole gets the player SVG
		     character (green/yellow field, smiling player figure, trophy).
		     Back cards render a category-themed abstract band so the
		     visual hierarchy stays Brazil-first. -->
		{#if market.hasFigure}
			<div class="welcome-flow-figure">
				<svg
					aria-hidden="true"
					preserveAspectRatio="xMidYMid slice"
					viewBox="0 0 280 150"
					xmlns="http://www.w3.org/2000/svg"
				>
					<defs>
						<linearGradient id="wc-field" x1="0" x2="0" y1="0" y2="1">
							<stop offset="0%" stop-color="#1F5F38" />
							<stop offset="100%" stop-color="#143A24" />
						</linearGradient>
						<linearGradient id="wc-shirt" x1="0" x2="0" y1="0" y2="1">
							<stop offset="0%" stop-color="#F4D640" />
							<stop offset="100%" stop-color="#D9B521" />
						</linearGradient>
					</defs>
					<!-- Pitch / field backdrop -->
					<rect fill="url(#wc-field)" height="150" width="280" x="0" y="0" />
					<!-- Chalk stripes -->
					<rect fill="#FFFFFF" height="0.6" opacity="0.10" width="280" x="0" y="40" />
					<rect fill="#FFFFFF" height="0.6" opacity="0.10" width="280" x="0" y="80" />
					<rect fill="#FFFFFF" height="0.6" opacity="0.10" width="280" x="0" y="120" />
					<!-- Centre arc highlight -->
					<ellipse cx="140" cy="148" fill="#2A6A42" opacity="0.55" rx="120" ry="40" />
					<!-- Trophy (left) -->
					<g transform="translate(40 60)">
						<rect fill="#E2B842" height="4" rx="1" width="20" x="-3" y="32" />
						<rect fill="#E2B842" height="12" width="10" x="2" y="22" />
						<path d="M -6 0 L 20 0 L 18 18 Q 7 22 -4 18 Z" fill="#E2B842" />
						<path d="M -6 0 L 20 0 L 19 5 Q 7 8 -5 5 Z" fill="#FFD06A" />
						<circle cx="-9" cy="7" fill="none" r="5" stroke="#E2B842" stroke-width="2" />
						<circle cx="23" cy="7" fill="none" r="5" stroke="#E2B842" stroke-width="2" />
					</g>
					<!-- Player figure (centre-right) -->
					<g transform="translate(160 28)">
						<!-- Shadow -->
						<ellipse cx="32" cy="118" fill="#000000" opacity="0.35" rx="34" ry="4" />
						<!-- Legs -->
						<rect fill="#FFFFFF" height="28" rx="3" width="10" x="20" y="86" />
						<rect fill="#FFFFFF" height="28" rx="3" width="10" x="36" y="86" />
						<!-- Boots -->
						<ellipse cx="25" cy="116" fill="#1A1410" rx="7" ry="3" />
						<ellipse cx="41" cy="116" fill="#1A1410" rx="7" ry="3" />
						<!-- Shirt body -->
						<path
							d="M 12 52 Q 8 50 6 56 L 4 80 Q 4 86 12 88 L 54 88 Q 62 86 62 80 L 60 56 Q 58 50 54 52 L 48 48 L 18 48 Z"
							fill="url(#wc-shirt)"
						/>
						<!-- Shirt neckline accent -->
						<path d="M 26 48 Q 33 54 40 48 L 40 50 Q 33 56 26 50 Z" fill="#1F5F38" />
						<!-- Number on chest -->
						<text
							fill="#1F5F38"
							font-family="var(--font-display), sans-serif"
							font-size="14"
							font-weight="800"
							text-anchor="middle"
							x="33"
							y="76">10</text
						>
						<!-- Arms -->
						<rect fill="url(#wc-shirt)" height="22" rx="4" width="10" x="0" y="54" />
						<rect fill="url(#wc-shirt)" height="22" rx="4" width="10" x="56" y="54" />
						<!-- Hands (skin) -->
						<circle cx="5" cy="78" fill="#9C6E45" r="4" />
						<circle cx="61" cy="78" fill="#9C6E45" r="4" />
						<!-- Neck -->
						<rect fill="#9C6E45" height="8" width="8" x="29" y="42" />
						<!-- Head -->
						<circle cx="33" cy="32" fill="#9C6E45" r="14" />
						<!-- Hair -->
						<path
							d="M 19 30 Q 19 16 33 16 Q 47 16 47 30 Q 47 26 33 24 Q 19 26 19 30 Z"
							fill="#1A1410"
						/>
						<!-- Smile -->
						<path
							d="M 27 36 Q 33 41 39 36"
							fill="none"
							stroke="#1A1410"
							stroke-linecap="round"
							stroke-width="1.4"
						/>
						<!-- Eyes -->
						<circle cx="28" cy="30" fill="#1A1410" r="1.4" />
						<circle cx="38" cy="30" fill="#1A1410" r="1.4" />
					</g>
					<!-- Confetti specks -->
					<circle cx="100" cy="24" fill="#FFD06A" opacity="0.8" r="1.4" />
					<circle cx="220" cy="18" fill="#7EB6FF" opacity="0.7" r="1.6" />
					<circle cx="250" cy="46" fill="#F4D640" opacity="0.85" r="1.2" />
					<circle cx="118" cy="46" fill="#FFFFFF" opacity="0.6" r="1.0" />
				</svg>
			</div>
		{:else}
			<div class="welcome-flow-figure welcome-flow-figure--fallback">
				<svg
					aria-hidden="true"
					preserveAspectRatio="xMidYMid slice"
					viewBox="0 0 280 150"
					xmlns="http://www.w3.org/2000/svg"
				>
					<rect fill="#143A24" height="150" width="280" x="0" y="0" />
					<rect fill="#FFFFFF" height="0.5" opacity="0.08" width="280" x="0" y="40" />
					<rect fill="#FFFFFF" height="0.5" opacity="0.08" width="280" x="0" y="80" />
					<rect fill="#FFFFFF" height="0.5" opacity="0.08" width="280" x="0" y="120" />
					<ellipse cx="140" cy="150" fill="#2A6A42" opacity="0.5" rx="120" ry="36" />
					<circle
						cx="140"
						cy="75"
						fill="none"
						opacity="0.45"
						r="28"
						stroke="#E2B842"
						stroke-width="1.2"
					/>
					<circle cx="140" cy="75" fill="#E2B842" opacity="0.18" r="14" />
				</svg>
			</div>
		{/if}

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
					<span class="welcome-flow-probs-payout num">+{winNo} VXP</span>
					<span class="welcome-flow-probs-role">
						{yesIsFav
							? t({ locale: $localeStore, key: 'welcome.deck.long_shot' })
							: t({ locale: $localeStore, key: 'welcome.deck.favorite' })}
					</span>
				</div>
				<div class="welcome-flow-probs-action welcome-flow-probs-action--yes">
					<span class="welcome-flow-probs-role">
						{yesIsFav
							? t({ locale: $localeStore, key: 'welcome.deck.favorite' })
							: t({ locale: $localeStore, key: 'welcome.deck.long_shot' })}
					</span>
					<span class="welcome-flow-probs-payout num">+{winYes} VXP</span>
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

	/* Trickster pill — absolute-positioned top-right per the prototype.
	   `welcome.deck.trickster_label` carries the `AGREE · 2× XP` suffix
	   so the literal `×` stays out of the layout. Below it sits a
	   secondary pulse pill showing callers in the last hour. */
	.welcome-flow-trickster {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.35rem;
	}

	.welcome-flow-trickster-row {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.3rem 0.6rem;
		border-radius: 999px;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: var(--t-12);
		letter-spacing: var(--tracking-allcaps);
		color: #ff8a7a;
		background: rgba(255, 138, 122, 0.14);
		border: 1px solid rgba(255, 138, 122, 0.35);
	}

	.welcome-flow-trickster-pct {
		font-size: var(--t-13);
	}

	.welcome-flow-trickster-label {
		text-transform: uppercase;
	}

	.welcome-flow-callers {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
		font-size: 10px;
		letter-spacing: 0.05em;
		color: var(--text-muted);
		background: color-mix(in srgb, var(--ink) 18%, transparent);
		border: 1px solid var(--border-base);
	}

	.welcome-flow-callers::before {
		content: '';
		display: inline-block;
		width: 5px;
		height: 5px;
		border-radius: 999px;
		background: var(--no);
		animation: welcome-flow-pulse 1.6s infinite;
	}

	@keyframes welcome-flow-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}

	.welcome-flow-head {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1.1rem 1.1rem 0.9rem;
		border-bottom: 1px solid color-mix(in srgb, var(--laurel) 18%, transparent);
		background: linear-gradient(
			160deg,
			color-mix(in srgb, var(--laurel) 14%, transparent),
			transparent 68%
		);
	}

	.welcome-flow-head-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.welcome-flow-tag {
		font-family: var(--font-display);
		font-size: var(--t-12);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		padding: 0.25rem 0.5rem;
		border-radius: var(--r-4);
		color: var(--laurel);
		background: color-mix(in srgb, var(--laurel) 14%, transparent);
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
		font-size: clamp(1.35rem, 2.6vw, 1.6rem);
		font-weight: 700;
		line-height: 1.18;
		letter-spacing: -0.02em;
		color: var(--foreground);
		text-wrap: balance;
	}

	/* Serif-italic accent line — mirrors the prototype's editorial
	   `ctx` treatment beneath the question. */
	.welcome-flow-ctx {
		margin: 0;
		font-family: var(--font-serif, Georgia, 'Times New Roman', serif);
		font-style: italic;
		font-size: var(--t-13);
		color: color-mix(in srgb, var(--foreground) 78%, transparent);
	}

	.welcome-flow-body {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 1rem 1.1rem 1.1rem;
	}

	.welcome-flow-predictors {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		flex-wrap: wrap;
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

	.welcome-flow-predictors-sep {
		margin: 0 0.3rem;
		opacity: 0.6;
	}

	.welcome-flow-predictors-delta {
		color: var(--yes);
		font-weight: 600;
	}

	/* Rich figure band — slot between the predictor stack and the
	   probability split, full-bleed-ish edge-to-edge inside the card
	   body. Fixed height keeps the deck visuals predictable across
	   front + back cards in `WelcomeHeroDeck`. */
	.welcome-flow-figure {
		margin: 0 -1.1rem;
		height: 9.5rem;
		overflow: hidden;
		border-top: 1px solid color-mix(in srgb, var(--laurel) 12%, transparent);
		border-bottom: 1px solid color-mix(in srgb, var(--laurel) 12%, transparent);
	}

	.welcome-flow-figure svg {
		display: block;
		width: 100%;
		height: 100%;
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
		padding: 0.65rem 0.55rem;
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
		font-size: var(--t-14, var(--t-13));
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
		text-transform: uppercase;
	}
</style>
