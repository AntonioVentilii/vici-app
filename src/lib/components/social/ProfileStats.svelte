<script lang="ts">
	import { localeStore } from '$lib/stores/locale.store';
	import type { UserProfile } from '$lib/types/profile';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		profile: UserProfile;
		loading?: boolean;
		followersCount?: number;
		followingCount?: number;
	}

	const { profile, loading = false, followersCount = 0, followingCount = 0 }: Props = $props();
</script>

{#if loading}
	<div class="py-6 text-xs opacity-60">
		{t({ locale: $localeStore, key: 'social.profile_stats.loading' })}
	</div>
{:else}
	<div class="grid w-full grid-cols-3 gap-2 border-y border-white/5 py-4">
		<div>
			<p class="font-mono text-lg font-bold tabular-nums">{followersCount}</p>
			<p class="text-muted-foreground text-[10px] uppercase">
				{t({ locale: $localeStore, key: 'social.profile_stats.followers' })}
			</p>
		</div>
		<div>
			<p class="font-mono text-lg font-bold tabular-nums">{followingCount}</p>
			<p class="text-muted-foreground text-[10px] uppercase">
				{t({ locale: $localeStore, key: 'social.profile_stats.following' })}
			</p>
		</div>
		<div>
			<p class="font-mono text-lg font-bold tabular-nums">{profile.totalTrades ?? 0}</p>
			<p class="text-muted-foreground text-[10px] uppercase">
				{t({ locale: $localeStore, key: 'social.profile_stats.trades' })}
			</p>
		</div>
	</div>
{/if}

<div class="flex w-full gap-4">
	<div class="bg-foreground/5 flex-1 rounded-xl p-3">
		<p class="text-primary font-mono text-xl font-black tabular-nums">
			{profile.pnl?.toFixed(2) ?? '0.00'}
		</p>
		<p class="text-muted-foreground text-[10px] uppercase">
			{t({ locale: $localeStore, key: 'social.profile_stats.total_pnl' })}
		</p>
	</div>
	<div class="bg-foreground/5 flex-1 rounded-xl p-3">
		<p class="text-yes font-mono text-xl font-black tabular-nums">
			{profile.winRate?.toFixed(1) ?? '0'}%
		</p>
		<p class="text-muted-foreground text-[10px] uppercase">
			{t({ locale: $localeStore, key: 'social.profile_stats.win_rate' })}
		</p>
	</div>
</div>
