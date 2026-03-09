<script lang="ts">
	import type { PrincipalText } from '@dfinity/zod-schemas';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import type { UserRoleEntry } from '$lib/services/roles.services';

	let {
		roleEntries,
		onRemoveRole
	}: {
		roleEntries: UserRoleEntry[];
		onRemoveRole: (principal: PrincipalText) => Promise<void>;
	} = $props();

	let showConfirmModal = $state(false);
	let principalToRemove = $state<PrincipalText | null>(null);

	const confirmRemove = (principal: PrincipalText) => {
		principalToRemove = principal;
		showConfirmModal = true;
	};

	const handleConfirm = async () => {
		if (principalToRemove) {
			await onRemoveRole(principalToRemove);
		}
		showConfirmModal = false;
		principalToRemove = null;
	};

	const handleCancel = () => {
		showConfirmModal = false;
		principalToRemove = null;
	};
</script>

<Dialog title="Remove Admin" bind:show={showConfirmModal}>
	<p class="mb-6 text-slate-600">
		Are you sure you want to remove <strong class="break-all">{principalToRemove}</strong> from administrators?
		They will lose access to the admin dashboard.
	</p>
	<div class="flex justify-end gap-3">
		<Button onclick={handleCancel} variant="ghost">Cancel</Button>
		<Button onclick={handleConfirm} variant="danger">Remove</Button>
	</div>
</Dialog>

<div class="space-y-4">
	<h3 class="text-xl font-semibold text-slate-900">Current Assigned Roles</h3>

	{#if roleEntries.length === 0}
		<p class="text-sm text-slate-500">No roles found or still loading...</p>
	{:else}
		<ul class="divide-y divide-slate-200 overflow-hidden rounded-md border border-slate-200">
			{#each roleEntries as entry (entry.principal)}
				<li class="px-6 py-4">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-3">
							<span class="truncate text-sm font-medium text-slate-900">{entry.principal}</span>
							<span
								class="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-700/10 ring-inset"
							>
								{entry.role}
							</span>
						</div>
						<button
							class="text-sm font-medium text-red-600 hover:text-red-700"
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
