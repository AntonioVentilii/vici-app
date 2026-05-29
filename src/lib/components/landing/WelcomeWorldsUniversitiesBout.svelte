<script lang="ts">
	/**
	 * Featured tentpole panel — eyebrow + live FIFA tag + h3 + sub +
	 * podium (silver / gold / bronze, gold centred and taller).
	 */
	import WelcomeShowcaseCard from '$lib/components/landing/WelcomeShowcaseCard.svelte';
	import {
		LANDING_WORLDS_UNIVERSITIES,
		LANDING_WORLDS_UNIVERSITIES_COUNT
	} from '$lib/constants/landing-data.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { formatLocalePercent } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';

	const schools = LANDING_WORLDS_UNIVERSITIES;
	const total = LANDING_WORLDS_UNIVERSITIES_COUNT;
	const top3 = [...schools].sort((a, b) => b.accWC - a.accWC).slice(0, 3);

	// silver, gold, bronze ordering — gold center, taller.
	const podium = [
		{ s: top3[1], rank: 2, height: 84 },
		{ s: top3[0], rank: 1, height: 110 },
		{ s: top3[2], rank: 3, height: 70 }
	].filter((p): p is { s: (typeof top3)[number]; rank: number; height: number } => Boolean(p.s));

	const fmtAcc = (acc: number): string =>
		formatLocalePercent({ value: acc, locale: $localeStore, maximumFractionDigits: 1 });
</script>

<WelcomeShowcaseCard
	ctaHref="#bouts"
	ctaKey="social.wcbout_cta"
	eyebrowColor="#B49CFF"
	eyebrowKey="social.w_eyebrow"
	rootGradient="linear-gradient(180deg, rgba(180,156,255,0.10), rgba(180,156,255,0.02) 70%, transparent)"
	subKey="social.wcbout_sub"
	subParams={{ count: total }}
	titleAKey="social.wcbout_title_a"
	titleBKey="social.wcbout_title_b"
>
	{#snippet badge()}
		<span
			style="
				background:rgba(180,156,255,0.14);
				color:#B49CFF;
				border-color:rgba(180,156,255,0.30);
			"
			class="tag live"
		>
			{t({ locale: $localeStore, key: 'welcome.universities.fifa_tag' })}
		</span>
	{/snippet}

	<div
		style="
			display:grid; grid-template-columns:1fr 1fr 1fr;
			gap:8px; align-items:end; margin-top:18px; margin-bottom:6px;
		"
	>
		{#each podium as p (p.s.id)}
			<div
				style="display:flex; flex-direction:column; align-items:center; gap:8px;"
				title={p.s.name}
			>
				<div
					style="
						width:40px; height:40px; border-radius:var(--r-pill);
						display:inline-flex; align-items:center; justify-content:center;
						background:{p.s.color}; color:{p.s.text};
						font-family:var(--font-serif); font-style:italic;
						font-weight:400; font-size:20px; line-height:1;
						border:2px solid {p.rank === 1 ? 'var(--accent)' : 'var(--border)'};
						box-shadow:{p.rank === 1 ? '0 4px 16px -4px rgba(226,184,66,0.5)' : 'none'};
					"
				>
					{p.s.short.charAt(0)}
				</div>
				<div
					style="
						width:100%; height:{p.height}px;
						background:{p.rank === 1
						? 'linear-gradient(180deg, rgba(226,184,66,0.18), rgba(226,184,66,0.05))'
						: 'rgba(242,236,220,0.05)'};
						border:1px solid {p.rank === 1 ? 'rgba(226,184,66,0.30)' : 'var(--border)'};
						border-radius:var(--r-8);
						display:flex; flex-direction:column; align-items:center; justify-content:flex-start;
						padding:10px 6px; text-align:center;
					"
				>
					<span
						style="
							color:{p.rank === 1 ? 'var(--accent)' : 'var(--fg-mute)'};
							letter-spacing:0.10em;
						"
						class="num t-eyebrow"
					>
						#{p.rank}
					</span>
					<span
						style="
							margin-top:4px; color:var(--fg);
							font-size:11px; letter-spacing:0.06em;
							overflow:hidden; text-overflow:ellipsis;
							white-space:nowrap; max-width:100%;
						"
						class="num fw-600"
					>
						{p.s.short}
					</span>
					<span
						style="
							margin-top:auto;
							color:{p.rank === 1 ? 'var(--accent)' : 'var(--fg)'};
							font-weight:700; font-size:13px;
						"
						class="num"
					>
						{fmtAcc(p.s.accWC)}
					</span>
				</div>
			</div>
		{/each}
	</div>
</WelcomeShowcaseCard>
