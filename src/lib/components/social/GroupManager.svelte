<script lang="ts">
	import { onMount } from 'svelte';
	import type { RegistryDid } from '$declarations';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import {
		createGroup,
		listGroups,
		addGroupMembers,
		removeGroupMembers,
		addGroupAdmins,
		removeGroupAdmins
	} from '$lib/services/group.services';
	import { getProfile } from '$lib/services/profile.services';
	import { getFriends } from '$lib/services/relation.services';
	import type { UserProfile } from '$lib/types/profile';
	import type { Relation } from '$lib/types/relation';

	interface Props {
		userPrincipal: string;
	}

	const { userPrincipal }: Props = $props();

	let groups = $state<RegistryDid.Group[]>([]);
	let loading = $state(true);
	let activeFriends = $state<Relation[]>([]);
	let friendProfiles = $state<Map<string, UserProfile>>(new Map());

	// Modals
	let isCreateModalOpen = $state(false);
	let isManageModalOpen = $state(false);

	let newGroupName = $state('');
	let newGroupDesc = $state('');
	let selectedGroup = $state<RegistryDid.Group | null>(null);

	// Action loading
	let processing = $state(false);

	onMount(async () => {
		await loadAll();
	});

	const loadAll = async () => {
		loading = true;

		try {
			// In realistic scenario we'd query all groups we belong to.
			const all = await listGroups();
			groups = all.filter(
				(g) =>
					g.creator.toText() === userPrincipal ||
					g.admins.some((a) => a.toText() === userPrincipal) ||
					g.members.some((m) => m.toText() === userPrincipal)
			);

			// Fetch active friends to show in Add Member list
			activeFriends = await getFriends(userPrincipal);

			for (const relation of activeFriends) {
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

	const handleCreateGroup = async () => {
		if (!newGroupName) {
			return;
		}

		processing = true;

		try {
			await createGroup({ name: newGroupName, description: newGroupDesc });
			isCreateModalOpen = false;
			newGroupName = '';
			newGroupDesc = '';
			await loadAll();
		} catch (e: unknown) {
			alert(e instanceof Error && e.message ? e.message : 'Failed to create group');
		} finally {
			processing = false;
		}
	};

	const addFriendToGroup = async (friendId: string) => {
		if (!selectedGroup) {
			return;
		}

		processing = true;

		try {
			await addGroupMembers({ groupId: selectedGroup.group_id, principals: [friendId] });
			await loadAll();
			selectedGroup = groups.find((g) => g.group_id === selectedGroup?.group_id) ?? null;
		} catch (e: unknown) {
			alert(e instanceof Error && e.message ? e.message : 'Failed to add member');
		} finally {
			processing = false;
		}
	};

	const toggleAdmin = async ({ memberId, isAdmin }: { memberId: string; isAdmin: boolean }) => {
		if (!selectedGroup) {
			return;
		}

		processing = true;

		try {
			if (isAdmin) {
				await removeGroupAdmins({ groupId: selectedGroup.group_id, principals: [memberId] });
			} else {
				await addGroupAdmins({ groupId: selectedGroup.group_id, principals: [memberId] });
			}

			await loadAll();
			selectedGroup = groups.find((g) => g.group_id === selectedGroup?.group_id) ?? null;
		} catch (e: unknown) {
			alert(e instanceof Error && e.message ? e.message : 'Failed to toggle admin');
		} finally {
			processing = false;
		}
	};

	const removeMember = async (memberId: string) => {
		if (!selectedGroup) {
			return;
		}

		processing = true;

		try {
			await removeGroupMembers({ groupId: selectedGroup.group_id, principals: [memberId] });
			await removeGroupAdmins({ groupId: selectedGroup.group_id, principals: [memberId] });
			await loadAll();
			selectedGroup = groups.find((g) => g.group_id === selectedGroup?.group_id) ?? null;
		} catch (e: unknown) {
			alert(e instanceof Error && e.message ? e.message : 'Failed to remove member');
		} finally {
			processing = false;
		}
	};

	const userIsAdminOrCreator = (group: RegistryDid.Group) =>
		group.creator.toText() === userPrincipal ||
		group.admins.some((a) => a.toText() === userPrincipal);
</script>

<Card padding="lg" variant="glass">
	<div class="flex flex-col gap-4">
		<div class="flex items-center justify-between">
			<h3 class="text-primary text-xl font-bold">Groups</h3>
			<Button onclick={() => (isCreateModalOpen = true)} size="sm">New Group</Button>
		</div>

		{#if loading}
			<div class="flex justify-center py-8">
				<LoadingSpinner />
			</div>
		{:else if groups.length === 0}
			<p class="text-muted-foreground py-8 text-center text-sm opacity-50">
				You don't belong to any groups yet.
			</p>
		{:else}
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				{#each groups as group (group.group_id)}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="bg-accent/20 hover:bg-accent/40 flex cursor-pointer flex-col justify-between gap-2 rounded-xl p-4 transition-all"
						onclick={() => {
							selectedGroup = group;
							isManageModalOpen = true;
						}}
					>
						<div>
							<h4 class="font-bold">{group.name}</h4>
							<p class="text-muted-foreground text-xs">{group.members.length} members</p>
						</div>
						{#if userIsAdminOrCreator(group)}
							<div
								class="bg-primary/20 text-primary w-fit rounded px-2 py-0.5 text-xs font-semibold"
							>
								Admin
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</Card>

<Modal isOpen={isCreateModalOpen} onClose={() => (isCreateModalOpen = false)}>
	<div class="flex flex-col gap-4">
		<h2 class="text-xl font-bold">Create Group</h2>
		<input
			class="border-border bg-background focus:ring-primary/50 rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
			placeholder="Group Name"
			bind:value={newGroupName}
		/>
		<textarea
			class="border-border bg-background focus:ring-primary/50 rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
			placeholder="Description (optional)"
			bind:value={newGroupDesc}
		></textarea>
		<div class="flex justify-end gap-2">
			<Button onclick={() => (isCreateModalOpen = false)} variant="ghost">Cancel</Button>
			<Button
				onclick={handleCreateGroup}
				status={processing || !newGroupName ? 'disabled' : 'enabled'}
			>
				{processing ? 'Creating...' : 'Create'}
			</Button>
		</div>
	</div>
</Modal>

<Modal isOpen={isManageModalOpen} onClose={() => (isManageModalOpen = false)}>
	{#if selectedGroup}
		{@const amIAdmin = userIsAdminOrCreator(selectedGroup)}
		<div class="custom-scrollbar flex max-h-[80vh] flex-col gap-6 overflow-y-auto pr-2">
			<div>
				<h2 class="text-xl font-bold">{selectedGroup.name}</h2>
				<p class="text-muted-foreground text-sm">
					{selectedGroup.description?.[0] ?? 'No description'}
				</p>
			</div>

			<div class="space-y-3">
				<h3 class="text-lg font-semibold">Members</h3>
				{#each selectedGroup.members as member (member.toText())}
					{@const memberId = member.toText()}
					{@const isCreator = selectedGroup.creator.toText() === memberId}
					{@const isAdmin = isCreator || selectedGroup.admins.some((a) => a.toText() === memberId)}
					<div class="bg-accent/10 flex items-center justify-between rounded-lg p-2">
						<div class="mr-4 flex items-center gap-2 truncate">
							<span class="text-sm"
								>{memberId === userPrincipal
									? 'You'
									: (friendProfiles.get(memberId)?.nickname ?? 'User')}</span
							>
							{#if isAdmin}
								<span
									class="bg-primary/20 text-primary rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase"
									>Admin</span
								>
							{/if}
						</div>

						{#if amIAdmin && !isCreator && memberId !== userPrincipal}
							<div class="flex shrink-0 gap-2">
								<Button
									onclick={() => toggleAdmin({ memberId, isAdmin })}
									size="sm"
									status={processing ? 'disabled' : 'enabled'}
									variant="outline"
								>
									{isAdmin ? 'Revoke Admin' : 'Make Admin'}
								</Button>
								<!-- Removing class from Button because it uses variant -->
								<Button
									onclick={() => removeMember(memberId)}
									size="sm"
									status={processing ? 'disabled' : 'enabled'}
									variant="ghost"
								>
									Remove
								</Button>
							</div>
						{/if}
					</div>
				{/each}
			</div>

			{#if amIAdmin}
				{@const unaddedFriends = activeFriends.filter((f) => {
					const fid = f.participants.find((p) => p !== userPrincipal);

					return fid && !selectedGroup?.members.some((m) => m.toText() === fid);
				})}
				<div class="border-border space-y-3 border-t pt-4">
					<h3 class="text-lg font-semibold">Add Friends</h3>

					{#if unaddedFriends.length === 0}
						<p class="text-muted-foreground text-sm">All your friends are already in this group.</p>
					{:else}
						<div class="grid grid-cols-1 gap-2">
							{#each unaddedFriends as friend (friend.createdAt)}
								{@const friendId = friend.participants.find((p) => p !== userPrincipal)}
								{#if friendId}
									<div
										class="border-border flex items-center justify-between rounded-lg border p-2"
									>
										<span class="w-3/4 truncate text-sm"
											>{friendProfiles.get(friendId)?.nickname ?? friendId}</span
										>
										<Button
											onclick={() => addFriendToGroup(friendId)}
											size="sm"
											status={processing ? 'disabled' : 'enabled'}
											variant="outline">Add</Button
										>
									</div>
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<div class="flex justify-end pt-4">
				<Button onclick={() => (isManageModalOpen = false)} variant="ghost">Close</Button>
			</div>
		</div>
	{/if}
</Modal>

<style lang="postcss">
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(var(--primary-rgb), 0.2);
		border-radius: 10px;
	}
</style>
