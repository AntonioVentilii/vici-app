<script lang="ts">
	/**
	 * Mock head-to-head battle between two leagues (`office-hex` vs
	 * `lupercal`) — two accuracy bars facing each other across a
	 * `VS` / day-counter divider.
	 */
	import WelcomeShowcaseCard from '$lib/components/landing/WelcomeShowcaseCard.svelte';
	import { LANDING_LEAGUES, type LandingLeague } from '$lib/constants/landing-data.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { formatLocalePercent } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';

	const leftLeague = LANDING_LEAGUES.find((l) => l.id === 'office-hex') ?? LANDING_LEAGUES[0];
	const rightLeague =
		LANDING_LEAGUES.find((l) => l.id === 'lupercal') ?? LANDING_LEAGUES[1] ?? LANDING_LEAGUES[0];

	const leftAcc = 0.742;
	const rightAcc = 0.718;
	const leftPct = leftAcc * 100;
	const rightPct = rightAcc * 100;
	const day = 4;
	const totalDays = 7;
	const leading: 'left' | 'right' = leftAcc >= rightAcc ? 'left' : 'right';

	const fmtAcc = (acc: number): string =>
		formatLocalePercent({ value: acc, locale: $localeStore, maximumFractionDigits: 1 });
</script>

{#snippet leagueRow(league: LandingLeague, acc: number, isLeading: boolean)}
	<div style="gap:12px; align-items:center;" class="row between">
		<div style="gap:10px; align-items:center; min-width:0; flex:1;" class="row">
			<span
				style="
					width:30px; height:30px; border-radius:var(--r-8); flex:none;
					background:{league.color}; color:#0E0D0B;
					display:inline-flex; align-items:center; justify-content:center;
					font-family:var(--font-serif); font-style:italic;
					font-size:16px; line-height:1; font-weight:400;
				"
				aria-hidden="true"
			>
				{league.emblem}
			</span>
			<div style="gap:2px; min-width:0;" class="col">
				<span
					style="color:var(--fg); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"
					class="t-body-sm fw-600"
				>
					{league.name}
				</span>
				<span style="letter-spacing:0.08em;" class="num mute t-micro">
					{league.memberCount}
					{t({ locale: $localeStore, key: 'welcome.battle.members' })}
				</span>
			</div>
		</div>
		<span
			style="
				font-size:20px; font-weight:700; letter-spacing:var(--tracking-tight);
				color:{isLeading ? 'var(--accent)' : 'var(--fg)'}; flex-shrink:0;
			"
			class="num"
		>
			{fmtAcc(acc)}
		</span>
	</div>
{/snippet}

<WelcomeShowcaseCard
	ctaHref="#battles"
	ctaKey="arena.b_cta"
	eyebrowColor="var(--terracotta, #B5462C)"
	eyebrowKey="arena.b_eyebrow"
	rootGradient="linear-gradient(180deg, rgba(181,70,44,0.08), rgba(181,70,44,0.02) 60%, transparent)"
	subKey="arena.b_sub"
	titleAKey="arena.b_title_a"
	titleBKey="arena.b_title_b"
>
	{#snippet badge()}
		<span
			style="
				background:rgba(181,70,44,0.14);
				color:var(--terracotta, #B5462C);
				border-color:rgba(181,70,44,0.30);
			"
			class="tag live"
		>
			{t({
				locale: $localeStore,
				key: 'arena.b_day',
				params: { n: day, total: totalDays }
			})}
		</span>
	{/snippet}

	<div
		style="
			margin-top:22px; padding:18px 18px 22px; border-radius:12px;
			background:rgba(14,13,11,0.20); border:1px solid var(--border);
			display:flex; flex-direction:column; gap:14px;
		"
	>
		{@render leagueRow(leftLeague, leftAcc, leading === 'left')}

		<div style="align-items:center; gap:12px;" class="row">
			<span style="flex:1; height:1px; background:var(--border);" aria-hidden="true"></span>
			<span
				style="
					font-size:16px; color:var(--fg-mute);
					letter-spacing:var(--tracking-wide); font-weight:400;
					line-height:1; padding:0 2px;
				"
				class="serif-italic"
			>
				{t({ locale: $localeStore, key: 'arena.b_vs' })}
			</span>
			<span style="flex:1; height:1px; background:var(--border);" aria-hidden="true"></span>
		</div>

		{@render leagueRow(rightLeague, rightAcc, leading === 'right')}

		<div
			style="
				margin-top:6px; height:6px; border-radius:var(--r-pill);
				background:var(--border-strong); overflow:hidden;
				position:relative; display:flex;
			"
		>
			<div
				style="
					width:{(leftPct / (leftPct + rightPct)) * 100}%;
					background:linear-gradient(90deg, var(--accent), rgba(226,184,66,0.45));
					height:100%;
				"
			></div>
			<div
				style="
					width:{(rightPct / (leftPct + rightPct)) * 100}%;
					background:linear-gradient(90deg, rgba(181,70,44,0.45), var(--terracotta, #B5462C));
					height:100%;
				"
			></div>
		</div>
	</div>
</WelcomeShowcaseCard>
