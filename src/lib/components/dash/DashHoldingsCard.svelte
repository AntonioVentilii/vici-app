<script lang="ts">
	import { Gift } from 'lucide-svelte/icons';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { AppPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		balanceDisplay: string;
		backedDisplay: string;
		lifetimeDisplay: string;
		recentSettlementsCount: number;
	}

	let { balanceDisplay, backedDisplay, lifetimeDisplay, recentSettlementsCount }: Props = $props();
</script>

<div class="dash-section">
	<div class="dash-holdings">
		<div class="dash-holdings-top">
			<span class="dash-ey">{t({ locale: $localeStore, key: 'dash.holdings.eyebrow' })}</span>
			<span class="dash-purpose">
				{t({ locale: $localeStore, key: 'dash.holdings.purpose' })}
			</span>
			<div class="dash-balance">
				{balanceDisplay}<span class="unit">VXP</span>
			</div>
			<div class="dash-sub-stats">
				<div class="dash-sub-stat">
					<span class="lbl">
						{t({ locale: $localeStore, key: 'dash.holdings.backed' })}
					</span>
					<span class="val">{backedDisplay}</span>
				</div>
				<div class="dash-sub-stat">
					<span class="lbl">
						{t({ locale: $localeStore, key: 'dash.holdings.lifetime' })}
					</span>
					<span class="val">{lifetimeDisplay}</span>
				</div>
				<div class="dash-sub-stat">
					<span class="lbl">
						{t({ locale: $localeStore, key: 'dash.holdings.session' })}
					</span>
					<span class="val">
						{t({
							locale: $localeStore,
							key:
								recentSettlementsCount === 1
									? 'dash.holdings.session_one'
									: 'dash.holdings.session_many',
							params: { count: recentSettlementsCount }
						})}
					</span>
				</div>
			</div>
		</div>
		<a
			class="dash-referral"
			href={resolve(AppPath.Social)}
			onclick={(e) => {
				e.preventDefault();
				goto(resolve(AppPath.Social));
			}}
		>
			<div class="left">
				<span class="gift" aria-hidden="true">
					<Gift size={12} strokeWidth={1.8} />
				</span>
				<div class="text">
					<span class="h">
						{t({ locale: $localeStore, key: 'dash.holdings.invite_title' })}
					</span>
					<span class="s">
						{t({ locale: $localeStore, key: 'dash.holdings.invite_sub' })}
					</span>
				</div>
			</div>
			<span class="arrow">
				{t({ locale: $localeStore, key: 'dash.holdings.invite_cta' })}
			</span>
		</a>
	</div>
</div>
