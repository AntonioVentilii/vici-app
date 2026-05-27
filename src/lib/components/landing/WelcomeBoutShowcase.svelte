<script lang="ts">
	/**
	 * Verbatim port of the prototype's `BoutShowcase`
	 * (`landing.jsx:981-1094`). Mock head-to-head between two leagues
	 * (`office-hex` vs `lupercal`) with two accuracy bars facing each
	 * other across a `VS` / day-counter divider.
	 */
	import { ChevronRight } from 'lucide-svelte/icons';
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
					width:30px; height:30px; border-radius:8px; flex:none;
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
					{league.memberCount} MEMBERS
				</span>
			</div>
		</div>
		<span
			style="
				font-size:20px; font-weight:700; letter-spacing:-0.02em;
				color:{isLeading ? 'var(--accent)' : 'var(--fg)'}; flex-shrink:0;
			"
			class="num"
		>
			{fmtAcc(acc)}
		</span>
	</div>
{/snippet}

<div
	style="
		padding:20px; position:relative; overflow:hidden;
		display:flex; flex-direction:column;
		background:linear-gradient(180deg, rgba(181,70,44,0.08), rgba(181,70,44,0.02) 60%, transparent);
	"
	class="card-elevated lp-root"
>
	<div
		style="margin-bottom:8px; align-items:baseline; flex-wrap:wrap; gap:8px;"
		class="row between"
	>
		<span style="color:var(--terracotta, #B5462C); letter-spacing:0.12em;" class="eyebrow">
			{t({ locale: $localeStore, key: 'social.b_eyebrow' })}
		</span>
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
				key: 'social.b_day',
				params: { n: day, total: totalDays }
			})}
		</span>
	</div>
	<h3 style="margin-top:4px;" class="lp-h3">
		{t({ locale: $localeStore, key: 'social.b_title_a' })}
		<span class="serif-italic acc">{t({ locale: $localeStore, key: 'social.b_title_b' })}</span>
	</h3>
	<p style="margin-top:10px; line-height:1.5;" class="dim t-body-sm">
		{t({ locale: $localeStore, key: 'social.b_sub' })}
	</p>

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
					letter-spacing:0.04em; font-weight:400;
					line-height:1; padding:0 2px;
				"
				class="serif-italic"
			>
				{t({ locale: $localeStore, key: 'social.b_vs' })}
			</span>
			<span style="flex:1; height:1px; background:var(--border);" aria-hidden="true"></span>
		</div>

		{@render leagueRow(rightLeague, rightAcc, leading === 'right')}

		<div
			style="
				margin-top:6px; height:6px; border-radius:999px;
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

	<a
		style="
			display:inline-flex; align-items:center; gap:6px; margin-top:auto; padding-top:16px;
			color:var(--accent); text-decoration:none; font-weight:600; font-size:14px;
		"
		class="lp-social-cta"
		href="#bouts"
	>
		{t({ locale: $localeStore, key: 'social.b_cta' })}
		<ChevronRight size={14} />
	</a>
</div>
