<script lang="ts">
	import { isNullish, nonNullish } from '@dfinity/utils';
	import { onMount } from 'svelte';
	import ProfileStats from '$lib/components/social/ProfileStats.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CopyableAddress from '$lib/components/ui/CopyableAddress.svelte';
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

	let pending = $state(false);

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

		pending = true;

		try {
			const params = { sender: viewerPrincipal, target: profile.owner };

			if (isFollowing) {
				await unfollowUser(params);
			} else {
				await followUser(params);
			}

			await loadSocialGraph();
		} finally {
			pending = false;
		}
	};
</script>

<Card padding="lg" variant="glass">
	<div class="flex w-full flex-col items-center gap-4 text-center">
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
			<p class="text-muted-foreground text-xs opacity-50">
				<CopyableAddress address={profile.owner} label="Principal ID" />
			</p>
		</div>

		<ProfileStats
			followersCount={followers.length}
			followingCount={following.length}
			{loading}
			{profile}
		/>

		{#if nonNullish(viewerPrincipal) && viewerPrincipal !== profile.owner}
			<Button
				onclick={handleFollowToggle}
				status={loading ? 'loading' : pending ? 'pending' : 'enabled'}
			>
				{isFollowing ? 'Unfollow' : 'Follow'}
			</Button>
		{/if}
	</div>
</Card>
