<script lang="ts">
	import { ArrowDown, ArrowUp, Flame, Sparkles } from '@lucide/svelte/icons';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		accuracyPct: string;
		sessionDelta: number | null;
		nickname: string;
		streak: number;
		daysToMarathon: number;
		streakBarPct: number;
	}

	let { accuracyPct, sessionDelta, nickname, streak, daysToMarathon, streakBarPct }: Props =
		$props();
</script>

<div class="dash-hero">
	<span class="dash-ey">{t({ locale: $localeStore, key: 'dash.accuracy.eyebrow' })}</span>
	<div class="dash-big">
		{accuracyPct}<span class="dash-unit">%</span>
	</div>
	<div class="dash-meta-row">
		{#if sessionDelta != null}
			{@const isPos = sessionDelta >= 0}
			<span class="dash-delta" class:dash-delta-neg={!isPos} class:dash-delta-pos={isPos}>
				{#if isPos}
					<ArrowUp aria-hidden="true" size={10} strokeWidth={2.5} />
				{:else}
					<ArrowDown aria-hidden="true" size={10} strokeWidth={2.5} />
				{/if}
				{t({
					locale: $localeStore,
					key: isPos ? 'dash.accuracy.session_delta_pos' : 'dash.accuracy.session_delta_neg',
					params: { value: isPos ? sessionDelta : Math.abs(sessionDelta) }
				})}
			</span>
		{:else}
			<span class="dash-delta dash-delta-neutral">
				<Sparkles aria-hidden="true" size={10} strokeWidth={2} />
				{nickname
					? t({
							locale: $localeStore,
							key: 'dash.accuracy.signed_in_short',
							params: { handle: nickname }
						})
					: t({ locale: $localeStore, key: 'dash.accuracy.first_session' })}
			</span>
		{/if}
		<span class="dash-anchor">
			{t({ locale: $localeStore, key: 'dash.accuracy.global_anchor' })}
		</span>
	</div>
	<div class="dash-streak-row">
		<div class="dash-streak-pair">
			<span class="dash-flame" aria-hidden="true">
				<Flame size={20} strokeWidth={2} />
			</span>
			<div>
				<span class="dash-streak-big">
					{t({
						locale: $localeStore,
						key: 'dash.streak.days',
						params: { count: streak }
					})}
				</span>
				<span class="dash-streak-sub">
					{t({
						locale: $localeStore,
						key: 'dash.streak.longest_to_marathon_em',
						params: { count: daysToMarathon }
					})}
				</span>
			</div>
		</div>
		<div class="dash-streak-bar">
			<span style:width="{streakBarPct}%" class="fill"></span>
		</div>
	</div>
</div>
