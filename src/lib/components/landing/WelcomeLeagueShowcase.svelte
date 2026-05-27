<script lang="ts">
	/**
	 * Verbatim port of the prototype's `LeagueShowcase`
	 * (`landing.jsx:871-974`). Mini league leaderboard mock (Office
	 * Hex) — top 3 members + the user's row highlighted, demonstrating
	 * the private cohort competition layer.
	 */
	import { ChevronRight } from 'lucide-svelte/icons';
	import { LANDING_LEAGUES } from '$lib/constants/landing-data.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { formatLocalePercent } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';

	const league = LANDING_LEAGUES.find((l) => l.id === 'office-hex') ?? LANDING_LEAGUES[0];
	const ranked = [...league.members].sort((a, b) => a.rank - b.rank);
	const top3 = ranked.slice(0, 3);
	const youRow = ranked.find((m) => m.kls === 'you');
	const youInTop = youRow ? top3.some((m) => m.handle === youRow.handle) : false;
	const rows = youInTop ? top3 : youRow ? [...top3, youRow] : top3;

	const fmtAcc = (acc: number): string =>
		formatLocalePercent({ value: acc, locale: $localeStore, maximumFractionDigits: 1 });
</script>

<div
	style="
		padding:20px; position:relative; overflow:hidden;
		display:flex; flex-direction:column;
		background:linear-gradient(180deg, rgba(226,184,66,0.08), rgba(226,184,66,0.02) 60%, transparent);
	"
	class="card-elevated lp-root"
>
	<div
		style="margin-bottom:8px; align-items:baseline; flex-wrap:wrap; gap:8px;"
		class="row between"
	>
		<span style="letter-spacing:0.12em;" class="eyebrow acc">
			{t({ locale: $localeStore, key: 'social.l_eyebrow' })}
		</span>
	</div>
	<h3 style="margin-top:4px;" class="lp-h3">
		{t({ locale: $localeStore, key: 'social.l_title_a' })}
		<span class="serif-italic acc">{t({ locale: $localeStore, key: 'social.l_title_b' })}</span>
	</h3>
	<p style="margin-top:10px; line-height:1.5;" class="dim t-body-sm">
		{t({ locale: $localeStore, key: 'social.l_sub' })}
	</p>

	<div
		style="
			margin-top:18px; border-radius:10px; overflow:hidden;
			background:rgba(14,13,11,0.20); border:1px solid var(--border);
		"
	>
		<div
			style="
				padding:10px 14px;
				display:flex; align-items:center; justify-content:space-between;
				border-bottom:1px solid var(--border);
				background:linear-gradient(180deg, {league.color}26, transparent);
			"
		>
			<div style="gap:8px; align-items:center; min-width:0;" class="row">
				<span
					style="
						width:24px; height:24px; border-radius:6px;
						display:inline-flex; align-items:center; justify-content:center;
						background:{league.color}; color:#0E0D0B; flex:none;
						font-family:var(--font-serif); font-style:italic;
						font-size:14px; line-height:1; font-weight:400;
					"
				>
					{league.emblem}
				</span>
				<span
					style="color:var(--fg); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"
					class="t-body-sm fw-600"
				>
					{league.name}
				</span>
			</div>
			<span style="letter-spacing:0.10em; flex-shrink:0;" class="num mute t-micro">
				{t({
					locale: $localeStore,
					key: 'social.l_members',
					params: { count: league.memberCount }
				})}
			</span>
		</div>
		{#each rows as m, i (m.handle)}
			{@const isYou = m.kls === 'you'}
			{@const skipDivider = i === 3 && !youInTop}
			<div
				style="
					padding:8px 14px;
					display:grid; grid-template-columns:26px 1fr auto; gap:10px;
					align-items:center;
					border-top:{skipDivider
					? '1px dashed var(--border-strong)'
					: i === 0
						? 'none'
						: '1px solid var(--border)'};
					background:{isYou ? 'rgba(226,184,66,0.06)' : 'transparent'};
				"
			>
				<span
					style="
						color:{isYou ? 'var(--accent)' : m.rank <= 3 ? 'var(--fg)' : 'var(--fg-mute)'};
						font-weight:{m.rank <= 3 || isYou ? 700 : 500}; font-size:12px;
					"
					class="num"
				>
					#{m.rank}
				</span>
				<div style="gap:8px; align-items:center; min-width:0;" class="row">
					<span
						style="
							width:20px; height:20px; border-radius:999px; flex:none;
							background:{m.shirt}; display:inline-flex;
							align-items:center; justify-content:center;
							font-size:9px; font-weight:700;
							color:#0E0D0B; text-transform:uppercase;
							border:1.5px solid var(--bg-raised);
						"
						aria-hidden="true"
					>
						{m.handle.charAt(0)}
					</span>
					<span
						style="
							color:{isYou ? 'var(--accent)' : 'var(--fg)'};
							overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
							min-width:0;
						"
						class="t-body-sm fw-600"
					>
						@{m.handle}{#if isYou}
							<span style="margin-left:4px; letter-spacing:0.08em;" class="t-eyebrow mute">
								· {t({ locale: $localeStore, key: 'social.l_you' })}
							</span>
						{/if}
					</span>
				</div>
				<span
					style="
						color:{isYou ? 'var(--accent)' : m.kls === 'gold' ? 'var(--accent)' : 'var(--fg)'};
						font-weight:700; font-size:12px;
					"
					class="num"
				>
					{fmtAcc(m.acc)}
				</span>
			</div>
		{/each}
	</div>

	<a
		style="
			display:inline-flex; align-items:center; gap:6px; margin-top:auto; padding-top:16px;
			color:var(--accent); text-decoration:none; font-weight:600; font-size:14px;
		"
		class="lp-social-cta"
		href="#leagues"
	>
		{t({ locale: $localeStore, key: 'social.l_cta' })}
		<ChevronRight size={14} />
	</a>
</div>
