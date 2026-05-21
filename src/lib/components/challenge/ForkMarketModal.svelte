<script lang="ts">
	import { onMount } from 'svelte';
	import type { RegistryDid } from '$declarations';
	import Button from '$lib/components/ui/Button.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import { listGroups } from '$lib/services/group.services';
	import { forkMarket } from '$lib/services/market.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import type { ButtonStatus } from '$lib/types/components';
	import type { Market } from '$lib/types/market';
	import { t } from '$lib/utils/i18n.utils';
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
				title: t({ locale: $localeStore, key: 'challenge.fork.error.no_group.title' }),
				message: t({ locale: $localeStore, key: 'challenge.fork.error.no_group.message' }),
				type: 'warning'
			});

			return;
		}

		status = 'pending';

		try {
			await forkMarket({ marketId: market.id, groupIds: selectedGroupIds });

			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'challenge.fork.success.title' }),
				message: t({
					locale: $localeStore,
					key: 'challenge.fork.success.message',
					params: { title: market.title }
				}),
				type: 'success'
			});

			refreshMarkets();
			close();
		} catch (e: unknown) {
			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'challenge.fork.failed.title' }),
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
				<h3 class="text-foreground text-2xl font-black">
					{t({ locale: $localeStore, key: 'challenge.fork.title' })}
				</h3>
				<p class="text-muted-foreground mt-1 text-sm">
					{t({ locale: $localeStore, key: 'challenge.fork.sub' })}
				</p>
			</div>

			<div class="bg-foreground/5 ring-border rounded-2xl p-4 ring-1 ring-inset">
				<h4 class="text-foreground text-sm font-bold">{market.title}</h4>
				<p class="text-muted-foreground mt-1 line-clamp-2 text-xs">{market.description}</p>
			</div>

			<div class="space-y-3">
				<span class="text-muted-foreground text-xs font-bold tracking-widest uppercase">
					{t({ locale: $localeStore, key: 'challenge.fork.pick_group' })}
				</span>

				{#if availableGroups.length === 0}
					<p class="text-muted-foreground bg-foreground/5 rounded-2xl p-4 text-sm italic">
						{t({ locale: $localeStore, key: 'challenge.fork.no_groups' })}
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
									<span class="text-muted-foreground ml-2 text-xs">
										{t({
											locale: $localeStore,
											key: 'challenge.fork.members_count',
											params: { count: group.members.length }
										})}
									</span>
								</div>
							</label>
						{/each}
					</div>
				{/if}
			</div>

			<div class="bg-primary/5 ring-primary/10 rounded-2xl p-4 ring-1 ring-inset">
				<p class="text-muted-foreground text-xs leading-relaxed">
					{t({ locale: $localeStore, key: 'challenge.fork.note' })}
				</p>
			</div>

			<Button
				class="w-full py-4 text-lg font-black"
				onclick={onFork}
				status={availableGroups.length === 0 ? 'disabled' : status}
			>
				{#snippet busyLabel()}
					{t({ locale: $localeStore, key: 'challenge.fork.cta_busy' })}
				{/snippet}
				{t({ locale: $localeStore, key: 'challenge.fork.cta' })}
			</Button>
		</div>
	{/if}
</Modal>
