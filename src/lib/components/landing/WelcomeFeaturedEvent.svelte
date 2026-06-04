<script lang="ts">
	/**
	 * World Cup featured-event landing section. Editorial left column
	 * (eyebrow + countdown + h2 + sub + CTA) paired with a 2×2
	 * favourite-flag grid on the right.
	 */
	import { ChevronRight, Clock } from '@lucide/svelte/icons';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import CountryFlag from '$lib/components/ui/CountryFlag.svelte';
	import { LANDING_WC_FAVORITES } from '$lib/constants/landing-data.constants';
	import { PublicPath } from '$lib/constants/routes.constants';
	import {
		daysToKickoff,
		featuredEventActive,
		hoursToKickoff
	} from '$lib/derived/featured-event.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	const favorites = LANDING_WC_FAVORITES;

	// Tapping a favourite deep-links into onboarding with that team
	// pre-selected (`?team=<ISO-2 code>`). The landing favourite `code`
	// IS the featured-event participant id, so `/signup` can map it
	// straight to a participant; an unknown code degrades to the normal
	// no-preselect flow.
	const signUpBase = resolve(PublicPath.SignUp);
	const teamHref = (code: string): string => `${signUpBase}?team=${code}`;
</script>

{#if $featuredEventActive}
	<section id="worldcup" class="lp-section lp-root">
		<div class="lp-section-inner">
			<div class="lp-feature-grid">
				<div>
					<div style="gap:8px; margin-bottom:14px; align-items:center; flex-wrap:wrap;" class="row">
						<span class="eyebrow acc">{t({ locale: $localeStore, key: 'wc.eyebrow' })}</span>
						{#if $daysToKickoff !== null}
							<span style="letter-spacing:0.10em;" class="num mute t-eyebrow">
								<Clock
									style="vertical-align: middle; margin-right: 3px;"
									size={11}
									strokeWidth={2}
								/>
								{$daysToKickoff}d {$hoursToKickoff ?? 0}h
							</span>
						{/if}
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
							aria-label={t({
								locale: $localeStore,
								key: 'wc.tile_aria',
								params: { team: f.team }
							})}
							href={teamHref(f.code)}
						>
							<CountryFlag class="h-6 w-8 rounded-sm object-cover" countryCode={f.code} />
							<span style="color:var(--fg);" class="t-body fw-600">{f.team}</span>
							<span
								style="color:{f.color}; letter-spacing:var(--tracking-wide);"
								class="num t-eyebrow"
							>
								{f.odds.toFixed(1)}% TO WIN
							</span>
						</a>
					{/each}
				</div>
			</div>
		</div>
	</section>
{/if}
