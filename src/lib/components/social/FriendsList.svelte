<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import { getProfile } from '$lib/services/profile.services';
	import { getFriends, sendFriendRequest } from '$lib/services/relation.services';
	import type { UserProfile } from '$lib/types/profile';
	import type { Relation } from '$lib/types/relation';

	interface Props {
		userPrincipal: string;
	}

	const { userPrincipal }: Props = $props();

	let friends = $state<Relation[]>([]);

	const friendProfiles = $state<Map<string, UserProfile>>(new Map());

	let loading = $state(true);

	let newFriendPrincipal = $state('');

	let adding = $state(false);

	onMount(async () => {
		await loadFriends();
	});

	const loadFriends = async () => {
		loading = true;
		try {
			const activeFriends = await getFriends(userPrincipal);

			friends = activeFriends;

			for (const relation of activeFriends) {
				const friendId = relation.participants.find((p) => p !== userPrincipal);
				if (friendId && !friendProfiles.has(friendId)) {
					const profile = await getProfile(friendId);
					if (profile) {
						friendProfiles.set(friendId, profile);
					}
				}
			}
		} finally {
			loading = false;
		}
	};

	const handleAddFriend = async () => {
		if (!newFriendPrincipal) {
			return;
		}
		adding = true;
		try {
			await sendFriendRequest({ target: newFriendPrincipal, sender: userPrincipal });
			newFriendPrincipal = '';
			// Show success toast or similar (omitted for brevity)
		} finally {
			adding = false;
		}
	};
</script>

<Card padding="lg" variant="glass">
	<div class="flex flex-col gap-4">
		<div class="flex items-center justify-between">
			<h3
				class="from-primary to-secondary bg-linear-to-r bg-clip-text text-xl font-bold text-transparent"
			>
				Friends
			</h3>
			<span class="text-muted-foreground text-sm">{friends.length} active</span>
		</div>

		<div class="flex gap-2">
			<input
				class="border-border bg-background/50 focus:ring-primary/50 flex-1 rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
				placeholder="Principal ID..."
				type="text"
				bind:value={newFriendPrincipal}
			/>
			<Button
				onclick={handleAddFriend}
				state={adding || !newFriendPrincipal ? 'disabled' : 'enabled'}
			>
				{adding ? 'Adding...' : 'Add'}
			</Button>
		</div>

		<div class="custom-scrollbar flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
			{#if loading}
				<div class="flex justify-center py-4">
					<LoadingSpinner />
				</div>
			{:else if friends.length === 0}
				<p class="text-muted-foreground py-8 text-center text-sm opacity-50">
					No friends yet. Add some!
				</p>
			{:else}
				{#each friends as relation (relation.createdAt)}
					{@const friendId = relation.participants.find((p) => p !== userPrincipal)}
					{@const profile = friendId ? friendProfiles.get(friendId) : null}

					<div
						class="bg-accent/20 hover:bg-accent/40 group flex items-center gap-3 rounded-xl p-3 transition-all"
					>
						<div class="relative">
							<div
								class="bg-muted h-10 w-10 overflow-hidden rounded-full shadow-inner transition-transform group-hover:scale-110"
							>
								{#if profile?.avatar}
									<img
										class="h-full w-full object-cover"
										alt={profile.nickname}
										src={profile.avatar}
									/>
								{:else}
									<div class="flex h-full w-full items-center justify-center text-lg font-bold">
										{profile?.nickname?.[0] ?? '?'}
									</div>
								{/if}
							</div>
							<div
								class="border-background absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 bg-green-500 shadow-sm"
							></div>
						</div>
						<div class="flex-1 overflow-hidden">
							<p class="truncate text-sm font-semibold">{profile?.nickname ?? 'Unknown'}</p>
							<p class="text-muted-foreground truncate text-xs opacity-70">
								{friendId?.slice(0, 10)}...
							</p>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</div>
</Card>

<style lang="postcss">
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(var(--primary-rgb), 0.2);
		border-radius: 10px;
	}
</style>
