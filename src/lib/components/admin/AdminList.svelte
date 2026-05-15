<script lang="ts">
	import type { PrincipalText } from '@junobuild/schema';
	import Button from '$lib/components/ui/Button.svelte';
	import CopyableAddress from '$lib/components/ui/CopyableAddress.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import type { UserRoleEntry } from '$lib/services/roles.services';
	import { shortenWithMiddleEllipsis } from '$lib/utils/format.utils';

	let {
		roleEntries,
		onRemoveRole
	}: {
		roleEntries: UserRoleEntry[];
		onRemoveRole: (principal: PrincipalText) => Promise<void>;
	} = $props();

	let showConfirmModal = $state(false);
	let principalToRemove = $state<PrincipalText | null>(null);
	let isRemoving = $state(false);

	const confirmRemove = (principal: PrincipalText) => {
		principalToRemove = principal;
		showConfirmModal = true;
	};

	const handleConfirm = async () => {
		if (principalToRemove) {
			isRemoving = true;

			try {
				await onRemoveRole(principalToRemove);
			} finally {
				isRemoving = false;
			}
		}

		showConfirmModal = false;
		principalToRemove = null;
	};

	const handleCancel = () => {
		showConfirmModal = false;
		principalToRemove = null;
	};

	const nicknameToRemove = $derived(
		principalToRemove
			? roleEntries.find((e) => e.principal === principalToRemove)?.nickname
			: undefined
	);
</script>

<Dialog title="Remove Admin" bind:show={showConfirmModal}>
	<p class="text-muted-foreground mb-6">
		Are you sure you want to remove <strong class="break-all">
			{nicknameToRemove ??
				(principalToRemove ? shortenWithMiddleEllipsis({ text: principalToRemove }) : '')}
		</strong> from administrators? They will lose access to the admin dashboard.
	</p>
	<div class="flex justify-end gap-3">
		<Button onclick={handleCancel} status={isRemoving ? 'disabled' : 'enabled'} variant="ghost">
			Cancel
		</Button>
		<Button onclick={handleConfirm} status={isRemoving ? 'pending' : 'enabled'} variant="danger">
			Remove
		</Button>
	</div>
</Dialog>

<div class="space-y-4">
	<h3 class="text-foreground text-xl font-semibold">Current Assigned Roles</h3>

	{#if roleEntries.length === 0}
		<p class="text-muted-foreground text-sm">No roles found or still loading...</p>
	{:else}
		<ul class="divide-border border-border divide-y overflow-hidden rounded-md border">
			{#each roleEntries as entry (entry.principal)}
				<li class="px-6 py-4">
					<div class="flex items-center justify-between">
						<div class="flex items-start gap-3">
							<div class="min-w-0">
								{#if entry.nickname}
									<span class="text-foreground block text-sm font-semibold">
										{entry.nickname}
									</span>
								{/if}
								<span class="text-muted-foreground text-sm" class:font-medium={!entry.nickname}>
									<CopyableAddress address={entry.principal} label="Principal ID" />
								</span>
							</div>
							<span
								class="bg-hold-wash text-hold ring-hold/10 mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset"
							>
								{entry.role}
							</span>
						</div>
						<button
							class="text-destructive hover:text-destructive ml-4 shrink-0 text-sm font-medium"
							onclick={() => confirmRemove(entry.principal)}
						>
							Remove
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>
