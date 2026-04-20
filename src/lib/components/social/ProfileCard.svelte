<script lang="ts">
	import { isNullish, nonNullish } from '@dfinity/utils';
	import { onMount } from 'svelte';
	import Avatar from '$lib/components/profile/Avatar.svelte';
	import ProfileStats from '$lib/components/social/ProfileStats.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CopyableAddress from '$lib/components/ui/CopyableAddress.svelte';
	import { getDisplayName, checkFriendship } from '$lib/services/profile.services';
	import {
		followUser,
		unfollowUser,
		getFollowing,
		getFollowers
	} from '$lib/services/relation.services';
	import { userStore } from '$lib/stores/user.store';
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
	let isFriend = $state(false);

	const displayName = $derived(
		getDisplayName({
			profile,
			viewerPrincipal,
			viewerRole: $userStore.profile?.role,
			isFriend
		})
	);

	onMount(async () => {
		await loadSocialGraph();

		if (nonNullish(viewerPrincipal) && viewerPrincipal !== profile.owner) {
			isFriend = await checkFriendship({ userA: viewerPrincipal, userB: profile.owner });
		}
	});

	const loadSocialGraph = async () => {
		loading = true;

		try {
			[following, followers] = await Promise.all([getFollowing(), getFollowers()]);
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
			isFriend = await checkFriendship({ userA: viewerPrincipal, userB: profile.owner });
		} finally {
			pending = false;
		}
	};
</script>

<Card padding="lg" variant="glass">
	<div class="flex w-full flex-col items-center gap-4 text-center">
		<div class="relative">
			<div class="border-primary/20 h-24 w-24 rounded-full border-4 p-1">
				<Avatar
					class="bg-muted h-full w-full"
					avatar={profile.avatar}
					nickname={profile.nickname}
					owner={profile.owner}
				/>
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
			<h2 class="text-xl font-black">{displayName}</h2>

			<p class="text-muted-foreground mt-1 text-xs opacity-50">
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
