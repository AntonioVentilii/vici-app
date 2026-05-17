<script lang="ts">
	import type { Doc } from '@junobuild/core';
	import { onMount } from 'svelte';
	import Avatar from '$lib/components/profile/Avatar.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import PrincipalText from '$lib/components/ui/PrincipalText.svelte';
	import { getProfile } from '$lib/services/profile.services';
	import {
		acceptFriendRequest,
		getFriendRequests,
		getFriends,
		getRejectedFriendships,
		rejectFriendRequest,
		sendFriendRequest,
		unfriendUser
	} from '$lib/services/relation.services';
	import type { UserProfile } from '$lib/types/profile';
	import type { Relation } from '$lib/types/relation';

	interface Props {
		userPrincipal: string;
	}

	const { userPrincipal }: Props = $props();

	type TabType = 'active' | 'requests' | 'rejected';
	let activeTab = $state<TabType>('active');

	let activeFriends = $state<Relation[]>([]);
	let pendingRequests = $state<Doc<Relation>[]>([]);
	let rejectedRelations = $state<Doc<Relation>[]>([]);

	const friendProfiles = $state<Map<string, UserProfile>>(new Map());

	let loading = $state(true);
	let newFriendPrincipal = $state('');
	let adding = $state(false);
	let processingKey = $state<string | null>(null);
	let unfriendingId = $state<string | null>(null);

	onMount(async () => {
		await loadData();
	});

	const loadData = async () => {
		loading = true;

		try {
			[activeFriends, pendingRequests, rejectedRelations] = await Promise.all([
				getFriends(),
				getFriendRequests(),
				getRejectedFriendships()
			]);

			const allRelations = [
				...activeFriends,
				...pendingRequests.map((p) => p.data),
				...rejectedRelations.map((p) => p.data)
			];

			for (const relation of allRelations) {
				const friendId = relation.participants.find((p) => p !== userPrincipal);

				if (friendId && !friendProfiles.has(friendId)) {
					const profileDoc = await getProfile(friendId);

					if (profileDoc) {
						friendProfiles.set(friendId, profileDoc.data);
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
			await loadData();
		} catch (err: unknown) {
			console.error(err);
			alert(err instanceof Error && err.message ? err.message : 'Failed to send request');
		} finally {
			adding = false;
		}
	};

	const handleAccept = async (doc: Doc<Relation>) => {
		processingKey = doc.key;

		try {
			await acceptFriendRequest({ currentRelation: doc });
			await loadData();
		} finally {
			processingKey = null;
		}
	};

	const handleReject = async (doc: Doc<Relation>) => {
		processingKey = doc.key;

		try {
			await rejectFriendRequest({ currentRelation: doc });
			await loadData();
		} finally {
			processingKey = null;
		}
	};

	const handleUnfriend = async (friendId: string) => {
		if (!confirm('Are you sure you want to unfriend this user?')) {
			return;
		}

		unfriendingId = friendId;

		try {
			await unfriendUser({ target: friendId, sender: userPrincipal });
			await loadData();
		} catch (err) {
			console.error(err);
			alert('Failed to unfriend');
		} finally {
			unfriendingId = null;
		}
	};
</script>

<Card padding="lg" variant="glass">
	<div class="flex w-full flex-col gap-4">
		<div class="flex items-center justify-between">
			<h3 class="text-primary text-xl font-bold">Friends</h3>
		</div>

		<div class="border-border flex gap-4 border-b text-sm font-medium">
			<button
				class="pb-2 {activeTab === 'active'
					? 'border-primary text-primary border-b-2'
					: 'text-muted-foreground'}"
				onclick={() => (activeTab = 'active')}
			>
				Active ({activeFriends.length})
			</button>
			<button
				class="pb-2 {activeTab === 'requests'
					? 'border-primary text-primary border-b-2'
					: 'text-muted-foreground'}"
				onclick={() => (activeTab = 'requests')}
			>
				Requests ({pendingRequests.length})
			</button>
			<button
				class="pb-2 {activeTab === 'rejected'
					? 'border-primary text-primary border-b-2'
					: 'text-muted-foreground'}"
				onclick={() => (activeTab = 'rejected')}
			>
				Rejected ({rejectedRelations.length})
			</button>
		</div>

		{#if activeTab === 'active'}
			<div class="flex gap-2">
				<input
					class="border-border bg-background/50 focus:ring-primary/50 flex-1 rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
					placeholder="User Principal ID..."
					type="text"
					bind:value={newFriendPrincipal}
				/>
				<Button
					onclick={handleAddFriend}
					status={adding ? 'pending' : !newFriendPrincipal ? 'disabled' : 'enabled'}
				>
					{#snippet busyLabel()}Sending...{/snippet}
					Add Friend
				</Button>
			</div>
		{/if}

		<div class="custom-scrollbar flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
			{#if loading}
				<div class="flex justify-center py-4">
					<LoadingSpinner />
				</div>
			{:else}
				{#if activeTab === 'active'}
					{#if activeFriends.length === 0}
						<p class="text-muted-foreground py-8 text-center text-sm opacity-50">
							No active friends. Send a request!
						</p>
					{:else}
						{#each activeFriends as relation (relation.participants.toSorted().join('#'))}
							{@const friendId = relation.participants.find((p) => p !== userPrincipal)}
							{@const profile = friendId ? friendProfiles.get(friendId) : null}

							<div
								class="bg-accent/20 hover:bg-accent/40 group flex flex-col items-start justify-between gap-3 rounded-xl p-3 transition-all sm:flex-row sm:items-center"
							>
								<div class="flex items-center gap-3">
									<div class="relative">
										<Avatar
											class="bg-muted h-10 w-10 shadow-inner transition-transform group-hover:scale-110"
											avatar={profile?.avatar}
											nickname={profile?.nickname ?? 'Friend'}
											owner={profile?.owner ?? friendId ?? ''}
										/>
										<div
											class="border-background absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 bg-green-500 shadow-sm"
										></div>
									</div>
									<div class="flex-1 overflow-hidden">
										<p class="truncate text-sm font-semibold">{profile?.nickname ?? 'Unknown'}</p>
										<p class="text-muted-foreground truncate text-xs opacity-70">
											{#if friendId}
												<PrincipalText principal={friendId} />
											{/if}
										</p>
									</div>
								</div>

								<Button
									onclick={() => friendId && handleUnfriend(friendId)}
									size="sm"
									status={unfriendingId === friendId ? 'pending' : 'enabled'}
									variant="ghost"
								>
									Unfriend
								</Button>
							</div>
						{/each}
					{/if}
				{/if}

				{#if activeTab === 'requests'}
					{#if pendingRequests.length === 0}
						<p class="text-muted-foreground py-8 text-center text-sm opacity-50">
							No pending incoming requests.
						</p>
					{:else}
						{#each pendingRequests as doc (doc.key)}
							{@const relation = doc.data}
							{@const friendId = relation.participants.find((p) => p !== userPrincipal)}
							{@const profile = friendId ? friendProfiles.get(friendId) : null}

							<div
								class="bg-accent/20 hover:bg-accent/40 group flex flex-col items-start justify-between gap-3 rounded-xl p-3 transition-all sm:flex-row sm:items-center"
							>
								<div class="flex items-center gap-3">
									<div class="relative">
										<Avatar
											class="bg-muted h-10 w-10 shadow-inner"
											avatar={profile?.avatar}
											nickname={profile?.nickname ?? 'Friend'}
											owner={profile?.owner ?? friendId ?? ''}
										/>
									</div>
									<div class="flex-1 overflow-hidden">
										<p class="truncate text-sm font-semibold">{profile?.nickname ?? 'Unknown'}</p>
										<p class="text-muted-foreground truncate text-xs opacity-70">
											{#if friendId}
												<PrincipalText principal={friendId} />
											{/if}
										</p>
									</div>
								</div>
								<div class="flex gap-2">
									<Button
										onclick={() => handleReject(doc)}
										size="sm"
										status={processingKey === doc.key ? 'pending' : 'enabled'}
										variant="outline"
									>
										Reject
									</Button>
									<Button
										onclick={() => handleAccept(doc)}
										size="sm"
										status={processingKey === doc.key ? 'pending' : 'enabled'}
									>
										Accept
									</Button>
								</div>
							</div>
						{/each}
					{/if}
				{/if}

				{#if activeTab === 'rejected'}
					{#if rejectedRelations.length === 0}
						<p class="text-muted-foreground py-8 text-center text-sm opacity-50">
							No rejected friendships. You're keeping it clean!
						</p>
					{:else}
						{#each rejectedRelations as doc (doc.key)}
							{@const relation = doc.data}
							{@const friendId = relation.participants.find((p) => p !== userPrincipal)}
							{@const profile = friendId ? friendProfiles.get(friendId) : null}

							<div
								class="bg-destructive/10 group flex items-center gap-3 rounded-xl p-3 opacity-70"
							>
								<Avatar
									class="bg-muted h-10 w-10 grayscale"
									avatar={profile?.avatar}
									nickname={profile?.nickname ?? 'Friend'}
									owner={profile?.owner ?? friendId ?? ''}
								/>
								<div class="flex-1 overflow-hidden">
									<p class="truncate text-sm font-semibold line-through">
										{profile?.nickname ?? 'Unknown'}
									</p>
									<p class="text-muted-foreground truncate text-xs">
										{#if friendId}
											<PrincipalText principal={friendId} />
										{/if}
									</p>
								</div>
								<span class="bg-destructive/20 text-destructive rounded px-2 py-1 text-xs"
									>Rejected</span
								>
							</div>
						{/each}
					{/if}
				{/if}
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
