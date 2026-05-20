<script lang="ts">
	import { ChevronRight } from 'lucide-svelte/icons';
	import { resolve } from '$app/paths';
	import IconStreakFlame from '$lib/components/icons/IconStreakFlame.svelte';
	import IconXpChevron from '$lib/components/icons/IconXpChevron.svelte';
	import type { AppLocale } from '$lib/constants/locale.constants';
	import { PublicPath } from '$lib/constants/routes.constants';
	import { WELCOME_MARKET_PREVIEWS } from '$lib/constants/welcome-markets.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { categoryColor } from '$lib/utils/category-color.utils';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	const FLOW_ACTIVE_COUNT = 2847;
	const TOP_CARD_INDEX = 2;

	const FLOW_STEPS = [
		{ number: '01', key: 'flow.list_01' },
		{ number: '02', key: 'flow.list_02' },
		{ number: '03', key: 'flow.list_03' },
		{ number: '04', key: 'flow.list_04' }
	] as const satisfies readonly { number: string; key: MessageKey }[];

	const FLOW_DEMO_MARKETS = WELCOME_MARKET_PREVIEWS.slice(0, 3).reverse();

	const flowCardClass = ({ index }: { index: number }): string => {
		if (index === TOP_CARD_INDEX) {
			return 'welcome-flow-demo-card welcome-flow-demo-card--top';
		}

		if (index === TOP_CARD_INDEX - 1) {
			return 'welcome-flow-demo-card welcome-flow-demo-card--middle';
		}

		return 'welcome-flow-demo-card welcome-flow-demo-card--back';
	};

	const formatCount = ({ value, locale }: { value: number; locale: AppLocale }): string =>
		new Intl.NumberFormat(locale).format(value);

	const previewCallers = ({ id, locale }: { id: string; locale: AppLocale }): string => {
		const seed = id.charCodeAt(id.length - 1);

		return formatCount({ value: 2600 + ((seed * 137) % 1700), locale });
	};

	const sharpPercent = ({ yesPercent }: { yesPercent: number }): number =>
		Math.min(95, yesPercent + 10);
</script>

<div class="welcome-section-inner">
	<div class="welcome-flow-feature">
		<div class="welcome-flow-copy">
			<p class="eyebrow acc">{t({ locale: $localeStore, key: 'flow.eyebrow' })}</p>

			<h2 class="welcome-flow-title display">
				{t({ locale: $localeStore, key: 'flow.title_a' })}
				<span class="serif-italic acc">{t({ locale: $localeStore, key: 'flow.title_b' })}</span>
			</h2>

			<p class="welcome-flow-lede lede">{t({ locale: $localeStore, key: 'flow.lede' })}</p>

			<div class="welcome-flow-live">
				<span class="welcome-flow-pulse-dot" aria-hidden="true"></span>
				<span class="welcome-flow-live-label">
					{t({
						locale: $localeStore,
						key: 'flow.live_active',
						params: { count: formatCount({ value: FLOW_ACTIVE_COUNT, locale: $localeStore }) }
					})}
				</span>
			</div>

			<ul class="welcome-flow-list">
				{#each FLOW_STEPS as step (step.number)}
					<li>
						<span class="num acc">{step.number}</span>
						{t({ locale: $localeStore, key: step.key })}
					</li>
				{/each}
			</ul>

			<a class="welcome-flow-cta" href={resolve(PublicPath.SignUp)}>
				{t({ locale: $localeStore, key: 'cta.start_session' })}
				<ChevronRight aria-hidden="true" size={16} strokeWidth={2.4} />
			</a>
		</div>

		<figure class="welcome-flow-demo">
			<div class="welcome-flow-streak-chip">
				<IconStreakFlame size="14px" />
				<span class="num welcome-flow-streak-count">12</span>
				<span class="eyebrow">{t({ locale: $localeStore, key: 'chip.day_streak' })}</span>
			</div>

			<div class="welcome-flow-frame">
				{#each FLOW_DEMO_MARKETS as market, index (market.id)}
					{@const { yesPercent } = market}
					{@const noPercent = 100 - yesPercent}
					{@const sharpPct = sharpPercent({ yesPercent })}
					{@const callers = previewCallers({ id: market.id, locale: $localeStore })}
					{@const yesLabel = t({ locale: $localeStore, key: 'outcome.yes' })}
					{@const noLabel = t({ locale: $localeStore, key: 'outcome.no' })}
					{@const sharpSide = sharpPct >= 50 ? yesLabel : noLabel}
					<article
						style:--market-accent={categoryColor(market.category)}
						style:--yes-percent={`${yesPercent}%`}
						class={flowCardClass({ index })}
					>
						<div class="welcome-flow-card-head">
							<div class="welcome-flow-card-meta">
								<span class="welcome-flow-market-tag">{market.category.toUpperCase()}</span>
								<span class="num welcome-flow-market-date">{market.closesLabel}</span>
							</div>

							<h3 class="welcome-flow-question">{market.question}</h3>
						</div>

						<div class="welcome-flow-card-body">
							<div class="welcome-flow-card-activity">
								<span class="welcome-flow-avatar-stack" aria-hidden="true">
									<span></span>
									<span></span>
									<span></span>
								</span>
								<span class="num">
									{t({
										locale: $localeStore,
										key: 'card.predicting_count',
										params: { count: callers }
									})}
								</span>
							</div>

							<div class="welcome-flow-art" aria-hidden="true">
								<span class="welcome-flow-orbit welcome-flow-orbit--one"></span>
								<span class="welcome-flow-orbit welcome-flow-orbit--two"></span>
								<span class="welcome-flow-orbit welcome-flow-orbit--three"></span>
							</div>

							<div class="welcome-flow-sharp">
								<span class="welcome-flow-sharp-dot" aria-hidden="true"></span>
								<span>
									{t({
										locale: $localeStore,
										key: 'card.sharp_signal',
										params: { percent: sharpPct, side: sharpSide }
									})}
								</span>
							</div>

							<div class="welcome-flow-probs">
								<div class="welcome-flow-prob welcome-flow-prob--no">
									<span class="eyebrow">{noLabel}</span>
									<span class="num">{noPercent}%</span>
								</div>
								<div class="welcome-flow-prob welcome-flow-prob--yes">
									<span class="eyebrow">{yesLabel}</span>
									<span class="num">{yesPercent}%</span>
								</div>
							</div>

							<div class="welcome-flow-meter" aria-hidden="true">
								<span class="welcome-flow-meter-no"></span>
								<span class="welcome-flow-meter-yes"></span>
							</div>

							<div class="welcome-flow-card-foot">
								<span class="num">
									{t({
										locale: $localeStore,
										key: 'card.call_count',
										params: { count: callers }
									})}
								</span>
								<span class="num">{t({ locale: $localeStore, key: 'card.tap_depth' })}</span>
							</div>
						</div>

						{#if index === TOP_CARD_INDEX}
							<div class="welcome-flow-yes-overlay" aria-hidden="true">{yesLabel}</div>
						{/if}
					</article>
				{/each}

				<div class="welcome-flow-xp-burst" aria-hidden="true">
					<IconXpChevron size="14px" />
					<span class="num">+180 XP</span>
				</div>
			</div>

			<figcaption class="num welcome-flow-caption">
				{t({ locale: $localeStore, key: 'flow.caption' })}
			</figcaption>
		</figure>
	</div>
</div>

<style lang="postcss">
	.welcome-section-inner {
		max-width: 80rem;
		margin: 0 auto;
	}

	.welcome-flow-feature {
		display: grid;
		gap: 3rem;
		align-items: center;
		padding: clamp(1.25rem, 4vw, 2rem);
		border: 1px solid var(--border);
		border-radius: 24px;
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--foreground) 4%, transparent),
				color-mix(in srgb, var(--foreground) 1%, transparent)
			),
			var(--card);
		box-shadow: var(--shadow-card);
	}

	@media (min-width: 60rem) {
		.welcome-flow-feature {
			grid-template-columns: minmax(0, 0.95fr) minmax(22rem, 1fr);
			gap: clamp(3rem, 6vw, 4rem);
			padding: clamp(2rem, 4vw, 3rem);
		}
	}

	.welcome-flow-title {
		margin: 0.5rem 0 0;
		font-size: clamp(1.9rem, 4vw, 3.5rem);
		line-height: 1.05;
		color: var(--foreground);
	}

	.welcome-flow-lede {
		margin: 1.125rem 0 0;
		max-width: 34rem;
		color: var(--muted-foreground);
	}

	.welcome-flow-live {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1.375rem;
		padding: 0.375rem 0.75rem 0.375rem 0.625rem;
		border: 1px solid color-mix(in srgb, var(--yes) 28%, transparent);
		border-radius: 999px;
		background: color-mix(in srgb, var(--yes) 8%, transparent);
	}

	.welcome-flow-pulse-dot {
		width: 0.375rem;
		height: 0.375rem;
		border-radius: 999px;
		background: var(--yes);
		box-shadow: 0 0 12px color-mix(in srgb, var(--yes) 70%, transparent);
		animation: welcome-flow-pulse 1.8s ease-in-out infinite;
	}

	.welcome-flow-live-label {
		font-size: var(--t-13);
		color: var(--muted-foreground);
	}

	.welcome-flow-list {
		display: grid;
		gap: 0;
		margin: 1.5rem 0 0;
		padding: 0;
		list-style: none;
	}

	.welcome-flow-list li {
		display: flex;
		gap: 0.875rem;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--border);
		font-size: var(--t-15);
		line-height: 1.5;
		color: var(--muted-foreground);
	}

	.welcome-flow-list .num {
		font-weight: 700;
	}

	.welcome-flow-cta {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1.75rem;
		padding: 1rem 1.5rem;
		border-radius: 14px;
		background: var(--primary);
		color: var(--primary-foreground);
		font-size: var(--t-16);
		font-weight: 600;
		text-decoration: none;
		box-shadow: inset 0 1px 0 color-mix(in srgb, white 25%, transparent);
		transition:
			transform var(--d-hover) var(--ease-vici),
			background var(--d-hover) var(--ease-vici);
	}

	.welcome-flow-cta:hover {
		background: var(--laurel-deep);
		transform: translateY(-1px);
	}

	.welcome-flow-demo {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		margin: 0;
		min-width: 0;
	}

	.welcome-flow-streak-chip {
		align-self: flex-end;
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		border: 1px solid color-mix(in srgb, var(--laurel) 35%, transparent);
		border-radius: 999px;
		background: color-mix(in srgb, var(--laurel) 8%, transparent);
		color: var(--laurel);
		font-size: var(--t-12);
	}

	.welcome-flow-streak-count {
		font-weight: 700;
		color: var(--foreground);
	}

	.welcome-flow-streak-chip .eyebrow {
		font-size: 10px;
		color: var(--muted-foreground);
	}

	.welcome-flow-frame {
		position: relative;
		width: min(100%, 24rem);
		height: 32rem;
		isolation: isolate;
	}

	.welcome-flow-demo-card {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border: 1px solid var(--border-strong);
		border-radius: 22px;
		background: var(--card);
		box-shadow:
			0 18px 60px -20px color-mix(in srgb, var(--foreground) 45%, transparent),
			inset 0 1px 0 color-mix(in srgb, var(--background) 75%, transparent);
		user-select: none;
	}

	.welcome-flow-demo-card--back {
		z-index: 1;
		opacity: 0.44;
		transform: translate(-1.75rem, -1.25rem) scale(0.9) rotate(-4deg);
	}

	.welcome-flow-demo-card--middle {
		z-index: 2;
		opacity: 0.68;
		transform: translate(-0.875rem, -0.625rem) scale(0.95) rotate(-2deg);
	}

	.welcome-flow-demo-card--top {
		z-index: 3;
		animation: welcome-flow-swipe 5.2s var(--ease-vici) infinite;
	}

	.welcome-flow-card-head {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.125rem 1.25rem 1rem;
		border-bottom: 1px solid color-mix(in srgb, var(--market-accent) 18%, transparent);
		background: linear-gradient(
			160deg,
			color-mix(in srgb, var(--market-accent) 15%, transparent),
			color-mix(in srgb, var(--market-accent) 5%, transparent) 58%,
			transparent
		);
	}

	.welcome-flow-card-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.welcome-flow-market-tag {
		padding: 0.25rem 0.5rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--foreground) 6%, transparent);
		color: var(--market-accent);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.welcome-flow-market-date {
		font-size: var(--t-11);
		color: var(--muted-foreground);
	}

	.welcome-flow-question {
		margin: 0;
		color: var(--foreground);
		font-size: clamp(1rem, 3vw, 1.25rem);
		font-weight: 700;
		line-height: 1.22;
		letter-spacing: -0.01em;
		text-wrap: balance;
	}

	.welcome-flow-card-body {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.875rem 1.25rem 1rem;
	}

	.welcome-flow-card-activity {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: var(--t-11);
		color: var(--muted-foreground);
	}

	.welcome-flow-avatar-stack {
		display: inline-flex;
		align-items: center;
	}

	.welcome-flow-avatar-stack span {
		width: 1.25rem;
		height: 1.25rem;
		margin-left: -0.375rem;
		border: 2px solid var(--card);
		border-radius: 999px;
		background: var(--laurel);
	}

	.welcome-flow-avatar-stack span:first-child {
		margin-left: 0;
		background: var(--yes);
	}

	.welcome-flow-avatar-stack span:last-child {
		background: var(--primary);
	}

	.welcome-flow-art {
		position: relative;
		min-height: 7rem;
		overflow: hidden;
		border: 1px solid color-mix(in srgb, var(--market-accent) 18%, transparent);
		border-radius: 16px;
		background:
			radial-gradient(
				circle at 50% 48%,
				color-mix(in srgb, var(--market-accent) 18%, transparent),
				transparent 32%
			),
			color-mix(in srgb, var(--foreground) 3%, transparent);
	}

	.welcome-flow-orbit {
		position: absolute;
		inset: 50% auto auto 50%;
		border: 1px solid color-mix(in srgb, var(--market-accent) 40%, transparent);
		border-radius: 999px;
		transform: translate(-50%, -50%) rotate(-12deg);
	}

	.welcome-flow-orbit--one {
		width: 5rem;
		height: 5rem;
	}

	.welcome-flow-orbit--two {
		width: 8rem;
		height: 3.5rem;
		transform: translate(-50%, -50%) rotate(18deg);
	}

	.welcome-flow-orbit--three {
		width: 11rem;
		height: 5rem;
		transform: translate(-50%, -50%) rotate(-24deg);
	}

	.welcome-flow-sharp {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.625rem;
		border: 1px solid color-mix(in srgb, var(--yes) 18%, transparent);
		border-radius: 10px;
		background: color-mix(in srgb, var(--yes) 5%, transparent);
		font-size: var(--t-12);
		color: var(--muted-foreground);
	}

	.welcome-flow-sharp-dot {
		width: 0.375rem;
		height: 0.375rem;
		border-radius: 999px;
		background: var(--yes);
		box-shadow: 0 0 8px color-mix(in srgb, var(--yes) 60%, transparent);
	}

	.welcome-flow-probs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.625rem;
		margin-top: auto;
	}

	.welcome-flow-prob {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: color-mix(in srgb, var(--foreground) 3%, transparent);
	}

	.welcome-flow-prob .num {
		font-size: clamp(1.25rem, 4vw, 1.625rem);
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.welcome-flow-prob--no {
		color: var(--no);
	}

	.welcome-flow-prob--yes {
		border-color: color-mix(in srgb, var(--yes) 30%, transparent);
		color: var(--yes);
		background: color-mix(in srgb, var(--yes) 5%, transparent);
	}

	.welcome-flow-meter {
		display: flex;
		height: 0.25rem;
		overflow: hidden;
		border-radius: 999px;
		background: color-mix(in srgb, var(--foreground) 8%, transparent);
	}

	.welcome-flow-meter-no {
		width: calc(100% - var(--yes-percent));
		background: var(--no);
	}

	.welcome-flow-meter-yes {
		width: var(--yes-percent);
		background: var(--yes);
	}

	.welcome-flow-card-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding-top: 0.25rem;
		font-size: var(--t-11);
		color: var(--muted-foreground);
	}

	.welcome-flow-card-foot span:last-child {
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.welcome-flow-yes-overlay {
		position: absolute;
		top: 1.375rem;
		right: 1.375rem;
		z-index: 5;
		padding: 0.5rem 0.75rem;
		border: 2px solid currentColor;
		border-radius: 6px;
		color: var(--yes);
		font-size: 1.125rem;
		font-weight: 900;
		letter-spacing: 0.18em;
		pointer-events: none;
		transform: rotate(8deg);
		opacity: 0;
		animation: welcome-flow-yes 5.2s var(--ease-vici) infinite;
	}

	.welcome-flow-xp-burst {
		position: absolute;
		top: 1.125rem;
		right: -0.5rem;
		z-index: 6;
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.375rem 0.75rem;
		border-radius: 999px;
		background: var(--laurel);
		color: var(--ink);
		font-size: var(--t-13);
		font-weight: 800;
		box-shadow:
			0 0 0 6px color-mix(in srgb, var(--laurel) 18%, transparent),
			0 8px 24px -8px color-mix(in srgb, var(--laurel) 55%, transparent);
		pointer-events: none;
		opacity: 0;
		animation: welcome-flow-xp 5.2s var(--ease-vici) infinite;
	}

	.welcome-flow-caption {
		max-width: 22rem;
		margin: 0;
		color: var(--muted-foreground);
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.16em;
		text-align: center;
		text-transform: uppercase;
		opacity: 0.7;
	}

	@keyframes welcome-flow-pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.45;
			transform: scale(0.85);
		}
	}

	@keyframes welcome-flow-swipe {
		0%,
		22% {
			opacity: 1;
			transform: translate(0, 0) rotate(0);
		}
		34% {
			opacity: 1;
			transform: translate(4.5rem, 0) rotate(10deg);
		}
		48% {
			opacity: 0;
			transform: translate(28rem, 0) rotate(26deg);
		}
		55% {
			opacity: 0;
			transform: translate(-1.75rem, 1rem) scale(0.96) rotate(-2deg);
		}
		70%,
		100% {
			opacity: 1;
			transform: translate(0, 0) rotate(0);
		}
	}

	@keyframes welcome-flow-yes {
		0%,
		24% {
			opacity: 0;
		}
		34%,
		48% {
			opacity: 0.92;
		}
		56%,
		100% {
			opacity: 0;
		}
	}

	@keyframes welcome-flow-xp {
		0%,
		32% {
			opacity: 0;
			transform: translate(0, 0);
		}
		48% {
			opacity: 1;
			transform: translate(2.75rem, -1.875rem);
		}
		62%,
		100% {
			opacity: 0;
			transform: translate(3.25rem, -2.25rem);
		}
	}

	@media (max-width: 34rem) {
		.welcome-flow-frame {
			height: 30rem;
		}

		.welcome-flow-demo-card--back {
			transform: translate(-0.75rem, -1rem) scale(0.9) rotate(-3deg);
		}

		.welcome-flow-demo-card--middle {
			transform: translate(-0.375rem, -0.5rem) scale(0.95) rotate(-1.5deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.welcome-flow-pulse-dot,
		.welcome-flow-demo-card--top,
		.welcome-flow-yes-overlay,
		.welcome-flow-xp-burst {
			animation: none;
		}

		.welcome-flow-yes-overlay {
			opacity: 0.9;
		}

		.welcome-flow-xp-burst {
			opacity: 1;
			transform: translate(0, -0.5rem);
		}
	}
</style>
