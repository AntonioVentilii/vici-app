<script lang="ts">
	import { isNullish, nonNullish } from '@dfinity/utils';
	import { onMount } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import {
		followUser,
		unfollowUser,
		getFollowing,
		getFollowers
	} from '$lib/services/relation.services';
	import type { UserProfile } from '$lib/types/profile';

	interface Props {
		profile: UserProfile;
		viewerPrincipal?: string;
	}

	const { profile, viewerPrincipal }: Props = $props();

	let following = $state<string[]>([]);

	let followers = $state<string[]>([]);

	const isFollowing = $derived(
		nonNullish(viewerPrincipal) ? followers.includes(viewerPrincipal) : false
	);

	let loading = $state(true);

	onMount(async () => {
		await loadSocialGraph();
	});

	const loadSocialGraph = async () => {
		loading = true;

		try {
			[following, followers] = await Promise.all([
				getFollowing(profile.owner),
				getFollowers(profile.owner)
			]);
		} finally {
			loading = false;
		}
	};

	const handleFollowToggle = async () => {
		if (isNullish(viewerPrincipal)) {
			return;
		}

		loading = true;

		try {
			const params = { sender: viewerPrincipal, target: profile.owner };

			if (isFollowing) {
				await unfollowUser(params);
			} else {
				await followUser(params);
			}

			await loadSocialGraph();
		} finally {
			loading = false;
		}
	};
</script>

<Card padding="lg" variant="glass">
	<div class="flex flex-col items-center gap-4 text-center">
		<div class="relative">
			<div class="border-primary/20 h-24 w-24 rounded-full border-4 p-1">
				<div class="bg-muted h-full w-full overflow-hidden rounded-full">
					{#if profile.avatar}
						<img class="h-full w-full object-cover" alt={profile.nickname} src={profile.avatar} />
					{:else}
						<div class="flex h-full w-full items-center justify-center text-3xl font-bold">
							{profile.nickname[0]}
						</div>
					{/if}
				</div>
			</div>
			{#if profile.role}
				<div
					class="bg-primary absolute -right-2 bottom-0 rounded-lg px-2 py-0.5 text-[10px] font-bold text-white uppercase"
				>
					{profile.role}
				</div>
			{/if}
		</div>

		<div>
			<h2 class="text-xl font-black">{profile.nickname}</h2>
			<p class="text-muted-foreground w-48 truncate text-xs opacity-50">{profile.owner}</p>
		</div>

		{#if loading}
			<div class="py-6 text-xs opacity-60">Loading social graph...</div>
		{:else}
			<div class="grid w-full grid-cols-3 gap-2 border-y border-white/5 py-4">
				<div>
					<p class="text-lg font-bold">{followers.length}</p>
					<p class="text-muted-foreground text-[10px] uppercase">Followers</p>
				</div>
				<div>
					<p class="text-lg font-bold">{following.length}</p>
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

		{#if nonNullish(viewerPrincipal) && viewerPrincipal !== profile.owner}
			<Button disabled={loading} onclick={handleFollowToggle}>
				{isFollowing ? 'Unfollow' : 'Follow'}
			</Button>
		{/if}
	</div>
</Card>
