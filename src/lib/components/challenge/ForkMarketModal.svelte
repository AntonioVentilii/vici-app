<script lang="ts">
	import { onMount } from 'svelte';
	import type { RegistryDid } from '$declarations';
	import Button from '$lib/components/ui/Button.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import { listGroups } from '$lib/services/group.services';
	import { forkMarket } from '$lib/services/market.services';
	import { notificationsStore } from '$lib/stores/notification.store';
	import type { ButtonStatus } from '$lib/types/components';
	import type { Market } from '$lib/types/market';
	import { refreshMarkets } from '$lib/utils/refresh.utils';

	interface Props {
		isOpen: boolean;
		market: Market | null;
		onClose: () => void;
	}

	const { isOpen, market, onClose }: Props = $props();

	let status = $state<ButtonStatus>('enabled');
	let availableGroups = $state<RegistryDid.Group[]>([]);
	let selectedGroupIds = $state<string[]>([]);

	onMount(async () => {
		try {
			availableGroups = await listGroups();
		} catch {
			// Groups API may not be available yet
		}
	});

	const reset = () => {
		selectedGroupIds = [];
		status = 'enabled';
	};

	const close = () => {
		reset();
		onClose();
	};

	const onFork = async () => {
		if (!market || selectedGroupIds.length === 0) {
			notificationsStore.add({
				title: 'Select a Group',
				message: 'Pick at least one group to challenge.',
				type: 'warning'
			});

			return;
		}

		status = 'pending';

		try {
			await forkMarket({ marketId: market.id, groupIds: selectedGroupIds });

			notificationsStore.add({
				title: 'Challenge Sent!',
				message: `"${market.title}" is now live for your group.`,
				type: 'success'
			});

			refreshMarkets();
			close();
		} catch (e: unknown) {
			notificationsStore.add({
				title: 'Fork Failed',
				message: (e as Error).message,
				type: 'error'
			});
		} finally {
			status = 'enabled';
		}
	};
</script>

<Modal {isOpen} onClose={close}>
	{#if market}
		<div class="space-y-6">
			<div>
				<h3 class="text-foreground text-2xl font-black">Challenge Your Friends</h3>
				<p class="text-muted-foreground mt-1 text-sm">
					Fork this market into a private challenge for your group.
				</p>
			</div>

			<div class="bg-foreground/5 ring-border rounded-2xl p-4 ring-1 ring-inset">
				<h4 class="text-foreground text-sm font-bold">{market.title}</h4>
				<p class="text-muted-foreground mt-1 line-clamp-2 text-xs">{market.description}</p>
			</div>

			<div class="space-y-3">
				<span class="text-muted-foreground text-xs font-bold tracking-widest uppercase"
					>Pick a group</span
				>

				{#if availableGroups.length === 0}
					<p class="text-muted-foreground rounded-2xl bg-slate-50 p-4 text-sm italic">
						No groups yet. Create one from your Profile page first.
					</p>
				{:else}
					<div class="space-y-2">
						{#each availableGroups as group (group.group_id)}
							<label
								class="bg-card ring-border hover:bg-foreground/5 flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 ring-1 transition-colors ring-inset {selectedGroupIds.includes(
									group.group_id
								)
									? 'bg-primary/10 ring-primary ring-2'
									: ''}"
							>
								<input
									class="accent-primary"
									checked={selectedGroupIds.includes(group.group_id)}
									onchange={() => {
										if (selectedGroupIds.includes(group.group_id)) {
											selectedGroupIds = selectedGroupIds.filter((id) => id !== group.group_id);
										} else {
											selectedGroupIds = [...selectedGroupIds, group.group_id];
										}
									}}
									type="checkbox"
								/>
								<div class="flex-1">
									<span class="text-foreground text-sm font-semibold">{group.name}</span>
									<span class="text-muted-foreground ml-2 text-xs"
										>{group.members.length} members</span
									>
								</div>
							</label>
						{/each}
					</div>
				{/if}
			</div>

			<div class="bg-primary/5 ring-primary/10 rounded-2xl p-4 ring-1 ring-inset">
				<p class="text-muted-foreground text-xs leading-relaxed">
					This creates a copy of the market restricted to your selected group(s). Members can
					predict YES or NO within their circle.
				</p>
			</div>

			<Button
				class="w-full py-4 text-lg font-black"
				onclick={onFork}
				status={availableGroups.length === 0 ? 'disabled' : status}
			>
				{#snippet busyLabel()}
					Forking...
				{/snippet}
				Challenge Group
			</Button>
		</div>
	{/if}
</Modal>
