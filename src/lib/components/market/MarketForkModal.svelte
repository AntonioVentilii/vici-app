<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { RegistryDid } from '$declarations';
	import Button from '$lib/components/ui/Button.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import { getOrCreateFriendsGroup, listGroups } from '$lib/services/group.services';
	import { forkMarket } from '$lib/services/market.services';
	import { notificationsStore } from '$lib/stores/notification.store';
	import type { Market } from '$lib/types/market';

	interface Props {
		isOpen: boolean;
		market: Market;
		onClose: () => void;
	}

	const { isOpen, market, onClose }: Props = $props();

	let mode = $state<'Friends' | 'Group'>('Friends');
	let availableGroups = $state<RegistryDid.Group[]>([]);
	let selectedGroupId = $state<string | null>(null);
	let loadingGroups = $state(false);
	let forking = $state(false);

	onMount(async () => {
		loadingGroups = true;

		try {
			const all = await listGroups();
			// Only show groups where user is admin/creator or member?
			// For forking, user probably needs to be admin to "manage" the forked market's access?
			// Actually, createMarket (relaxed) allows creating restricted markets.
			availableGroups = all;
		} catch (e) {
			console.error('Failed to load groups', e);
		} finally {
			loadingGroups = false;
		}
	});

	const handleFork = async () => {
		forking = true;

		try {
			let targetGroupIds: string[] = [];

			if (mode === 'Friends') {
				const friendsGroupId = await getOrCreateFriendsGroup();
				targetGroupIds = [friendsGroupId];
			} else if (selectedGroupId) {
				targetGroupIds = [selectedGroupId];
			} else {
				throw new Error('Please select a group');
			}

			const newMarketId = await forkMarket({
				marketId: market.id,
				groupIds: targetGroupIds
			});

			notificationsStore.add({
				title: 'Challenge Started!',
				message: 'Your private circle can now start betting.',
				type: 'success'
			});

			onClose();
			goto(`/markets/${newMarketId}`);
		} catch (e: unknown) {
			notificationsStore.add({
				title: 'Fork Failed',
				message: e instanceof Error ? e.message : 'Unknown error',
				type: 'error'
			});
		} finally {
			forking = false;
		}
	};
</script>

<Modal {isOpen} {onClose}>
	<div class="space-y-6">
		<div class="space-y-2">
			<h2 class="text-2xl font-black text-slate-950">Bring to your Circle</h2>
			<p class="text-sm text-slate-500">
				Create a private match of <span class="font-bold text-slate-700">"{market.title}"</span> just
				for your close circle.
			</p>
		</div>

		<div class="space-y-4">
			<div class="flex gap-4">
				<button
					class="flex-1 rounded-2xl border-2 px-4 py-3 text-center transition-all {mode ===
					'Friends'
						? 'border-indigo-600 bg-indigo-50 text-indigo-700'
						: 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}"
					onclick={() => (mode = 'Friends')}
				>
					<span class="block text-lg">👫</span>
					<span class="text-xs font-bold tracking-wider uppercase">Friends</span>
				</button>
				<button
					class="flex-1 rounded-2xl border-2 px-4 py-3 text-center transition-all {mode === 'Group'
						? 'border-indigo-600 bg-indigo-50 text-indigo-700'
						: 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}"
					onclick={() => (mode = 'Group')}
				>
					<span class="block text-lg">🏘️</span>
					<span class="text-xs font-bold tracking-wider uppercase">Group</span>
				</button>
			</div>

			{#if mode === 'Friends'}
				<div class="rounded-2xl bg-slate-50 p-4 text-center ring-1 ring-slate-200">
					<p class="text-xs leading-relaxed text-slate-600">
						This will create a private market accessible only to you and your active friends.
					</p>
				</div>
			{:else}
				<div class="space-y-2">
					{#if loadingGroups}
						<div class="py-4 text-center text-xs text-slate-400">Loading your groups...</div>
					{:else if availableGroups.length === 0}
						<p class="py-4 text-center text-xs text-slate-400 italic">No groups found.</p>
					{:else}
						<div class="max-h-48 space-y-2 overflow-y-auto pr-1">
							{#each availableGroups as group (group.group_id)}
								<label
									class="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 transition-colors hover:bg-slate-50"
								>
									<input
										name="group"
										class="accent-indigo-600"
										checked={selectedGroupId === group.group_id}
										onchange={() => (selectedGroupId = group.group_id)}
										type="radio"
										value={group.group_id}
									/>
									<span class="text-sm font-semibold text-slate-800">{group.name}</span>
								</label>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<div class="pt-4">
			<Button
				class="w-full"
				onclick={handleFork}
				size="lg"
				status={forking ? 'pending' : mode === 'Group' && !selectedGroupId ? 'disabled' : 'enabled'}
			>
				{forking ? 'Creating...' : 'Start Circle Match'}
			</Button>
		</div>
	</div>
</Modal>
