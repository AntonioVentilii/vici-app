<script lang="ts">
	/**
	 * Verbatim port of the prototype's `WCFeature`
	 * (`landing.jsx:434-488`). Wedge surface mirroring onboarding-v2:
	 * editorial left column (eyebrow + countdown + h2 + sub + CTA),
	 * 2×2 favourite-flag grid on the right.
	 */
	import { ChevronRight, Clock } from 'lucide-svelte/icons';
	import { goto } from '$app/navigation';
	import { LANDING_WC_FAVORITES } from '$lib/constants/landing-data.constants';
	import { PublicPath } from '$lib/constants/routes.constants';
	import { WORLD_CUP_KICKOFF } from '$lib/constants/world-cup-kickoff.constants';
	import { featuredEventActive } from '$lib/derived/featured-event.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	const wcDays = WORLD_CUP_KICKOFF.daysToKickoff;
	// Hours-to-kickoff isn't tracked in the constant; the prototype shows
	// "{days}d {hours}h" so we leave hours at 0 until the constant grows.
	const wcHours = 0;
	const favorites = LANDING_WC_FAVORITES;
</script>

{#if $featuredEventActive}
	<section id="worldcup" class="lp-section lp-root">
		<div class="lp-section-inner">
			<div class="lp-feature-grid">
				<div>
					<div style="gap:8px; margin-bottom:14px; align-items:center; flex-wrap:wrap;" class="row">
						<span class="eyebrow acc">{t({ locale: $localeStore, key: 'wc.eyebrow' })}</span>
						<span style="letter-spacing:0.10em;" class="num mute t-eyebrow">
							<Clock style="vertical-align: middle; margin-right: 3px;" size={11} strokeWidth={2} />
							{wcDays ?? 0}d {wcHours}h
						</span>
					</div>
					<h2 class="lp-h2">
						{t({ locale: $localeStore, key: 'wc.title_a' })}
						<span class="serif-italic acc">
							{t({ locale: $localeStore, key: 'wc.title_b' })}
						</span>
					</h2>
					<p style="margin-top:18px;" class="lp-lede">
						{t({ locale: $localeStore, key: 'wc.sub' })}
					</p>
					<button
						style="margin-top:28px;"
						class="btn btn-primary btn-lg"
						onclick={() => goto(PublicPath.SignUp)}
						type="button"
					>
						{t({ locale: $localeStore, key: 'wc.cta' })}
						<ChevronRight size={16} />
					</button>
				</div>

				<div
					style="display:grid; grid-template-columns:1fr 1fr; gap:12px; align-content:start;"
					class="lp-wc-grid"
				>
					{#each favorites as f (f.code)}
						<a
							style="
								padding:20px 18px; text-decoration:none;
								display:flex; flex-direction:column; gap:6px;
								background:linear-gradient(160deg, {f.color}1A, transparent 70%);
								border:1px solid {f.color}33;
							"
							class="card"
							href="#wc-{f.code}"
						>
							<span style="font-size:32px; line-height:1;" aria-hidden="true">{f.flag}</span>
							<span style="color:var(--fg);" class="t-body fw-600">{f.team}</span>
							<span style="color:{f.color}; letter-spacing:0.04em;" class="num t-eyebrow">
								{f.odds.toFixed(1)}% TO WIN
							</span>
						</a>
					{/each}
				</div>
			</div>
		</div>
	</section>
{/if}
