<script lang="ts">
	import { Sparkles } from 'lucide-svelte/icons';
	import { fly } from 'svelte/transition';
	import FlameChar from '$lib/components/characters/FlameChar.svelte';
	import OracleChar from '$lib/components/characters/OracleChar.svelte';
	import FlowInviteCard from '$lib/components/market/FlowInviteCard.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import type { FlowArtCategory } from '$lib/utils/flow-art.utils';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
	import { prefersReducedMotion } from '$lib/utils/reduced-motion.utils';
	import type { FlameStage } from '$lib/utils/streak.utils';

	// `market.tag.{category}` keys exist across all 7 locales —
	// reused here for the Oracle line ("You were early on {category}").
	// Falls back to `macro` when no category dominated this session.
	const CATEGORY_LABEL_KEYS: Record<FlowArtCategory, MessageKey> = {
		macro: 'market.tag.macro',
		crypto: 'market.tag.crypto',
		sports: 'market.tag.sports',
		politics: 'market.tag.politics',
		tech: 'market.tag.tech',
		culture: 'market.tag.culture',
		wc: 'market.tag.wc'
	};

	interface Props {
		betsCount: number;
		xp: number;
		dailyStreak: number;
		flameStage: FlameStage;
		flameLabel: string;
		accuracyUnlocked: boolean;
		lifetimeAccuracy: number;
		lifetimeTotalTrades: number;
		// Session metrics — driven by FlowMode (`sessionStartMs`,
		// `correctCallsThisSession`, `betsCount`).
		sessionAccuracy: number;
		sessionDurationLabel: string;
		// Daily-goal heuristic — `betsCount / DAILY_GOAL_TARGET`,
		// capped at 1 in FlowMode.
		dailyGoalDone: number;
		dailyGoalTarget: number;
		dailyGoalFraction: number;
		// Profile archetype id — used by the SMART NUDGE card. When
		// undefined the card falls back to a generic line.
		archetype: string | undefined;
		// Category the user leaned hardest into this session. Drives
		// the Oracle line ("You were early on {category}"). Undefined
		// when the user closed the session without placing any calls.
		topSessionCategory?: FlowArtCategory;
		// CTA wiring.
		onBackToMarkets: () => void;
		onContinueSession: () => void;
		onSeePortfolio: () => void;
	}

	const {
		betsCount,
		xp,
		dailyStreak,
		flameStage,
		flameLabel,
		accuracyUnlocked,
		lifetimeAccuracy,
		lifetimeTotalTrades,
		sessionAccuracy,
		sessionDurationLabel,
		dailyGoalDone,
		dailyGoalTarget,
		dailyGoalFraction,
		archetype,
		topSessionCategory,
		onBackToMarkets,
		onContinueSession,
		onSeePortfolio
	}: Props = $props();

	const sessionAccPct = $derived(Math.round(sessionAccuracy * 100));
	const dailyGoalPct = $derived(Math.round(dailyGoalFraction * 100));

	// Oracle accent — name the category the user leaned hardest into
	// this session. Falls back to "macro" when no calls were placed
	// (zero-bet sessions still see FlowEnd via the "0 of 10" copy).
	const oracleCategoryLabel = $derived(
		t({
			locale: $localeStore,
			key: CATEGORY_LABEL_KEYS[topSessionCategory ?? 'macro']
		})
	);

	// Smart-nudge percentile is a placeholder until the satellite
	// surfaces a live leaderboard delta. Hardcoded as "72%" in the
	// proto; we keep the same number until real data lands so the
	// surface still has the editorial hook.
	const SMART_NUDGE_PCT = 72;

	// Archetype label — falls back to "Strategist" when the user
	// hasn't been assigned one yet, matching the proto copy.
	const archetypeLabel = $derived(archetype ?? 'Strategist');

	const reducedMotion = prefersReducedMotion();
</script>

<!-- FlowEnd — session summary surface. -->
<div class="flow-end">
	<div class="flow-end-scroll" in:fly={reducedMotion ? { duration: 0 } : { y: 20, duration: 500 }}>
		<!-- 1 · Header: SESSION COMPLETE eyebrow + Vici. + duration line. -->
		<header class="flow-end-head anim-in">
			<p class="eyebrow flow-end-eyebrow">
				{t({ locale: $localeStore, key: 'flow.end.session_complete' })}
			</p>
			<h2 class="flow-end-title display serif-italic">Vici.</h2>
			<p class="flow-end-sub">
				{#if betsCount === 0}
					{t({ locale: $localeStore, key: 'flow.end.no_calls' })}
				{:else}
					{t({
						locale: $localeStore,
						key: 'flow.end.duration_line',
						params: { count: betsCount, duration: sessionDurationLabel }
					})}
				{/if}
			</p>
		</header>

		<!-- 2 · Oracle weekly read pill. Always renders — accuracy is the
		     anchor even at 0 %. The italic mid-sentence accent comes from a
		     dedicated `*_accent` key per locale so translators can move it. -->
		<section class="flow-end-oracle anim-in-2">
			<span class="flow-end-oracle-char" aria-hidden="true">
				<OracleChar animate size={48} />
			</span>
			<div class="flow-end-oracle-body">
				<p class="eyebrow flow-end-oracle-eyebrow">
					{t({ locale: $localeStore, key: 'flow.end.oracle_eyebrow' })}
				</p>
				<p class="flow-end-oracle-copy">
					{t({
						locale: $localeStore,
						key: 'flow.end.oracle_line_pre',
						params: { pct: sessionAccPct }
					})}
					<span class="serif-italic">
						{t({
							locale: $localeStore,
							key: 'flow.end.oracle_line_accent',
							params: { category: oracleCategoryLabel }
						})}
					</span>
					{t({ locale: $localeStore, key: 'flow.end.oracle_line_post' })}
				</p>
			</div>
		</section>

		<!-- 3 · 4-tile stat grid. RANK Δ is em-dashed until a historical
		     rank snapshot is wired backend-side. -->
		<section class="flow-end-grid anim-in-2">
			<div class="flow-end-tile">
				<p class="eyebrow flow-end-tile-label">
					{t({ locale: $localeStore, key: 'flow.end.tile_xp_earned' })}
				</p>
				<p class="num flow-end-tile-value flow-end-tile-value-accent">+{xp}</p>
			</div>
			<div class="flow-end-tile flow-end-tile-streak">
				<p class="eyebrow flow-end-tile-label">
					{t({ locale: $localeStore, key: 'flow.end.tile_streak' })}
				</p>
				<div class="flow-end-tile-streak-row">
					<FlameChar animate={dailyStreak >= 1} size={22} stage={flameStage} />
					<span class="num flow-end-tile-value">{dailyStreak}</span>
				</div>
				<p class="flow-end-tile-foot">{flameLabel}</p>
			</div>
			<div class="flow-end-tile">
				<p class="eyebrow flow-end-tile-label">
					{t({ locale: $localeStore, key: 'flow.end.tile_session_acc' })}
				</p>
				<p class="num flow-end-tile-value flow-end-tile-value-md">{sessionAccPct}%</p>
			</div>
			<div class="flow-end-tile">
				<p class="eyebrow flow-end-tile-label">
					{t({ locale: $localeStore, key: 'flow.end.tile_rank_delta' })}
				</p>
				<p class="num flow-end-tile-value flow-end-tile-value-md flow-end-tile-value-dim">—</p>
			</div>
		</section>

		<!-- 4 · Smart Nudge — archetype-driven editorial copy. -->
		<section class="flow-end-card flow-end-nudge anim-in-3">
			<div class="flow-end-nudge-head">
				<Sparkles aria-hidden="true" size={16} strokeWidth={2} />
				<p class="eyebrow">
					{t({ locale: $localeStore, key: 'flow.end.smart_nudge_eyebrow' })}
				</p>
			</div>
			<p class="flow-end-nudge-copy">
				{t({
					locale: $localeStore,
					key: 'flow.end.smart_nudge_copy',
					params: { pct: SMART_NUDGE_PCT, archetype: archetypeLabel }
				})}
			</p>
		</section>

		<!-- 5 · Daily Goal card with progress bar. -->
		<section class="flow-end-card flow-end-goal anim-in-3">
			<div class="flow-end-goal-row">
				<div>
					<p class="eyebrow flow-end-goal-eyebrow">
						{t({ locale: $localeStore, key: 'flow.end.daily_goal_eyebrow' })}
					</p>
					<p class="flow-end-goal-count">
						{t({
							locale: $localeStore,
							key: 'flow.end.daily_goal_count',
							params: { done: dailyGoalDone, target: dailyGoalTarget }
						})}
					</p>
				</div>
				<p class="num flow-end-goal-pct">{dailyGoalPct}%</p>
			</div>
			<div class="flow-end-goal-bar" role="presentation">
				<span style:width="{Math.min(100, dailyGoalPct)}%"></span>
			</div>
		</section>

		<!-- 6 · Invite friend card. -->
		<FlowInviteCard sessionXp={xp} />

		<!-- 7 · Twin CTAs: primary "Predict 10 more" + secondary "See portfolio".
		     "Back to markets" stays as a tertiary affordance — keeping the
		     original entry point reachable while matching the proto's stack. -->
		<div class="flow-end-actions">
			<Button onclick={onContinueSession}>
				{t({
					locale: $localeStore,
					key: 'flow.end.predict_more',
					params: { count: dailyGoalTarget }
				})}
			</Button>
			<Button onclick={onSeePortfolio} variant="ghost">
				{t({ locale: $localeStore, key: 'flow.end.see_portfolio' })}
			</Button>
			{#if accuracyUnlocked || lifetimeTotalTrades > 0 || lifetimeAccuracy > 0}
				<!-- Tertiary "back to markets" — kept under the primary
				     stack so it never competes with the two main CTAs. -->
				<Button onclick={onBackToMarkets} variant="ghost">
					{t({ locale: $localeStore, key: 'flow.back_to_markets' })}
				</Button>
			{/if}
		</div>
	</div>
</div>

<style lang="postcss">
	/* FlowEnd — session summary surface. Brand voice: serif-italic
	   `Vici.` headline, terse numeric stat grid, editorial accent on
	   the Oracle / Smart Nudge / Daily Goal cards. */
	.flow-end {
		position: relative;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		min-height: 100dvh;
		padding: 1.5rem 1.25rem 2rem;
		background:
			radial-gradient(circle at 20% 10%, var(--laurel-glow), transparent 45%), var(--bg-base);
		overflow-y: auto;
	}
	.flow-end-scroll {
		width: 100%;
		max-width: 26rem;
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	/* 1 · Header */
	.flow-end-head {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.flow-end-eyebrow {
		margin: 0;
		color: var(--text-muted);
		letter-spacing: var(--tracking-allcaps);
	}
	.flow-end-title {
		margin: 0;
		font-size: clamp(2.5rem, 12vw, 3.5rem);
		letter-spacing: -0.025em;
		color: var(--laurel);
		line-height: 1;
	}
	.flow-end-sub {
		margin: 0.25rem 0 0;
		font-size: var(--t-14);
		color: var(--text-muted);
	}

	/* 2 · Oracle pill */
	.flow-end-oracle {
		display: flex;
		gap: 0.875rem;
		align-items: center;
		padding: 0.75rem 0.875rem 0.75rem 0.5rem;
		border-radius: var(--r-12);
		background: rgba(226, 184, 66, 0.05);
		border: 1px solid rgba(226, 184, 66, 0.2);
	}
	.flow-end-oracle-char {
		flex-shrink: 0;
		display: inline-flex;
	}
	.flow-end-oracle-body {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.flow-end-oracle-eyebrow {
		margin: 0;
		color: var(--laurel);
	}
	.flow-end-oracle-copy {
		margin: 0;
		font-size: var(--t-13);
		color: var(--text-base);
		line-height: 1.45;
	}

	/* 3 · 4-tile grid */
	.flow-end-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.75rem;
		padding: 1rem;
		border-radius: var(--r-12);
		border: 1px solid var(--border-base);
		background: color-mix(in srgb, var(--bg-surface) 85%, transparent);
		box-shadow: var(--inset-hi);
	}
	.flow-end-tile {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.flow-end-tile-label {
		margin: 0;
		color: var(--text-muted);
		letter-spacing: var(--tracking-allcaps);
	}
	.flow-end-tile-value {
		margin: 0;
		font-size: clamp(1.75rem, 7vw, 2.25rem);
		font-weight: 600;
		letter-spacing: -0.02em;
		line-height: 1.05;
		color: var(--text-base);
	}
	.flow-end-tile-value-md {
		font-size: clamp(1.25rem, 5vw, 1.5rem);
	}
	.flow-end-tile-value-accent {
		color: var(--laurel);
	}
	.flow-end-tile-value-dim {
		color: var(--text-muted);
	}
	.flow-end-tile-streak-row {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.flow-end-tile-foot {
		margin: 0;
		font-size: 9.5px;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		color: var(--text-muted);
	}

	/* 4 · Smart Nudge */
	.flow-end-card {
		padding: 0.875rem 1rem;
		border-radius: var(--r-12);
		border: 1px solid var(--border-base);
		background: color-mix(in srgb, var(--bg-surface) 85%, transparent);
	}
	.flow-end-nudge-head {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--laurel);
	}
	.flow-end-nudge-head .eyebrow {
		margin: 0;
	}
	.flow-end-nudge-copy {
		margin: 0.5rem 0 0;
		font-size: var(--t-14);
		line-height: 1.5;
		color: var(--text-base);
	}

	/* 5 · Daily Goal */
	.flow-end-goal {
		background: rgba(226, 184, 66, 0.05);
		border-color: rgba(226, 184, 66, 0.18);
	}
	.flow-end-goal-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.flow-end-goal-eyebrow {
		margin: 0;
		color: var(--laurel);
	}
	.flow-end-goal-count {
		margin: 4px 0 0;
		font-size: var(--t-14);
		color: var(--text-muted);
	}
	.flow-end-goal-pct {
		margin: 0;
		font-size: 1.375rem;
		font-weight: 600;
		color: var(--text-base);
	}
	.flow-end-goal-bar {
		margin-top: 0.625rem;
		height: 4px;
		border-radius: 999px;
		background: rgba(226, 184, 66, 0.18);
		overflow: hidden;
	}
	.flow-end-goal-bar > span {
		display: block;
		height: 100%;
		background: var(--laurel);
		transition: width 320ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	/* 7 · CTA stack */
	.flow-end-actions {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		margin-top: 0.5rem;
	}

	/* Entrance staggers — `anim-in` / `anim-in-2` / `anim-in-3` are
	   defined in `app.css` (top-to-bottom 0 / 90 / 180 ms delays
	   against the shared `fade-up` keyframe). Reduced-motion guard
	   lives there too. */
</style>
