<script lang="ts">
	import type { UserProfile } from '$lib/types/profile';

	interface Props {
		profile: UserProfile;
		loading?: boolean;
		followersCount?: number;
		followingCount?: number;
	}

	const { profile, loading = false, followersCount = 0, followingCount = 0 }: Props = $props();
</script>

{#if loading}
	<div class="py-6 text-xs opacity-60">Loading social graph...</div>
{:else}
	<div class="grid w-full grid-cols-3 gap-2 border-y border-white/5 py-4">
		<div>
			<p class="text-lg font-bold">{followersCount}</p>
			<p class="text-muted-foreground text-[10px] uppercase">Followers</p>
		</div>
		<div>
			<p class="text-lg font-bold">{followingCount}</p>
			<p class="text-muted-foreground text-[10px] uppercase">Following</p>
		</div>
		<div>
			<p class="text-lg font-bold">{profile.totalTrades ?? 0}</p>
			<p class="text-muted-foreground text-[10px] uppercase">Trades</p>
		</div>
	</div>
{/if}

<div class="flex w-full gap-4">
	<div class="flex-1 rounded-xl bg-white/5 p-3">
		<p class="text-primary text-xl font-black">{profile.pnl?.toFixed(2) ?? '0.00'}</p>
		<p class="text-muted-foreground text-[10px] uppercase">Total P&L</p>
	</div>
	<div class="flex-1 rounded-xl bg-white/5 p-3">
		<p class="text-xl font-black text-emerald-500">{profile.winRate?.toFixed(1) ?? '0'}%</p>
		<p class="text-muted-foreground text-[10px] uppercase">Win Rate</p>
	</div>
</div>
