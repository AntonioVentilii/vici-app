<script lang="ts">
	/**
	 * Active positions block — the standard dashboard's "in flight" list,
	 * capped to the soonest-expiring calls. Owns the time-left + volume
	 * formatters and the closing-today urgency tally it renders. Class names
	 * live in `app.css`.
	 */
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ZERO } from '$lib/constants/app.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market } from '$lib/types/market';
	import type { Position } from '$lib/types/position';
	import { t } from '$lib/utils/i18n.utils';

	interface PositionEntry {
		position: Position;
		market: Market;
	}

	interface Props {
		entries: PositionEntry[];
		totalActive: number;
	}

	let { entries, totalActive }: Props = $props();

	const marketVolumeCalls = (m: Market): number => Number(m.totalVolume ?? ZERO);

	const fmtTimeLeft = (expiryMs: number): { label: string; urgent: boolean } => {
		const delta = expiryMs - Date.now();

		if (delta <= 0) {
			return { label: t({ locale: $localeStore, key: 'dash.active.closed' }), urgent: false };
		}

		const hours = Math.floor(delta / (1000 * 60 * 60));

		if (hours < 24) {
			return {
				label: t({
					locale: $localeStore,
					key: 'dash.active.hours_left',
					params: { count: Math.max(1, hours) }
				}),
				urgent: true
			};
		}

		const days = Math.floor(hours / 24);

		return {
			label: t({ locale: $localeStore, key: 'dash.active.days_left', params: { count: days } }),
			urgent: false
		};
	};

	const closingTodayCount = $derived(
		entries.filter((entry) => fmtTimeLeft(Number(entry.market.expiryDate)).urgent).length
	);
</script>

<div class="dash-section">
	<div class="dash-section-eyebrow">
		<span>
			{t({ locale: $localeStore, key: 'dash.active.eyebrow' })}
			{#if closingTodayCount > 0}
				<span class="dash-urgency">
					{t({
						locale: $localeStore,
						key: 'dash.active.closing_today',
						params: { count: closingTodayCount }
					})}
				</span>
			{/if}
		</span>
		<a
			class="see-all"
			href={resolve(AppPath.Portfolio)}
			onclick={(e) => {
				e.preventDefault();
				goto(resolve(AppPath.Portfolio));
			}}
		>
			{t({
				locale: $localeStore,
				key: 'dash.active.see_all',
				params: { count: totalActive }
			})}
		</a>
	</div>
	{#if entries.length === 0}
		<div class="dash-empty">
			{t({ locale: $localeStore, key: 'dash.placeholder.positions' })}
		</div>
	{:else}
		{#each entries as entry, i (entry.position.marketId)}
			{@const m = entry.market}
			{@const side = entry.position.outcomeId === 'YES' ? 'YES' : 'NO'}
			{@const prob = side === 'YES' ? m.yesProbability : 1 - m.yesProbability}
			{@const currentPct = Math.round(prob * 100)}
			{@const timer = fmtTimeLeft(Number(m.expiryDate))}
			<button class="dash-pos-row" onclick={() => goto(resolve(`${AppPath.Markets}/${m.id}`))}>
				<div class="left">
					<div class="q">{m.title}</div>
					<div class="ctx">
						<span class="side {side.toLowerCase()}">{side}</span>
						<span>
							{t({
								locale: $localeStore,
								key: 'dash.active.vol_calls',
								params: { count: marketVolumeCalls(m) }
							})}
						</span>
					</div>
				</div>
				<div class="right-col">
					<span class="pct">{currentPct}%</span>
					<span class="timer" class:urgent={i === 0 && timer.urgent}>{timer.label}</span>
				</div>
			</button>
		{/each}
	{/if}
</div>
