<script lang="ts">
	import { Principal } from '@icp-sdk/core/principal';
	import type { PrincipalText } from '@junobuild/schema';
	import { onMount } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import CopyableAddress from '$lib/components/ui/CopyableAddress.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { VICI_ORACLE_V1 } from '$lib/constants/app.constants';
	import { safeGetIdentityOnce } from '$lib/services/identity.services';
	import {
		authorizeOraclePrincipals,
		getViciOracle,
		registerViciOracle,
		revokeOraclePrincipals
	} from '$lib/services/oracle.services';
	import { notificationsStore } from '$lib/stores/notification.store';

	type Status = 'loading' | 'missing' | 'ready' | 'error';

	let status = $state<Status>('loading');
	let authorizedPrincipals = $state<PrincipalText[]>([]);
	let errorMessage = $state<string | undefined>();

	let newPrincipal = $state('');
	let isSubmitting = $state(false);
	let revokingPrincipal = $state<PrincipalText | null>(null);

	let showConfirmModal = $state(false);
	let principalToRevoke = $state<PrincipalText | null>(null);

	const load = async () => {
		status = 'loading';
		errorMessage = undefined;

		try {
			const oracle = await getViciOracle();

			if (oracle === undefined) {
				status = 'missing';
				authorizedPrincipals = [];

				return;
			}

			authorizedPrincipals = oracle.authorized_principals.map((p) => p.toText());
			status = 'ready';
		} catch (e: unknown) {
			status = 'error';
			errorMessage = (e as Error).message;
		}
	};

	onMount(load);

	const isValidPrincipal = (value: string): boolean => {
		try {
			Principal.fromText(value);

			return true;
		} catch {
			return false;
		}
	};

	const handleRegister = async () => {
		isSubmitting = true;

		try {
			const identity = await safeGetIdentityOnce();
			const self = identity.getPrincipal().toText();

			await registerViciOracle({ authorizedPrincipals: [self] });

			notificationsStore.add({
				title: 'Oracle Registered',
				message: `${VICI_ORACLE_V1} created with your principal authorized.`,
				type: 'success'
			});

			await load();
		} catch (e: unknown) {
			notificationsStore.add({
				title: 'Registration Failed',
				message: (e as Error).message,
				type: 'error'
			});
		} finally {
			isSubmitting = false;
		}
	};

	const handleAdd = async () => {
		const trimmed = newPrincipal.trim();

		if (!isValidPrincipal(trimmed)) {
			notificationsStore.add({
				title: 'Invalid Principal',
				message: 'Please enter a valid Internet Identity principal.',
				type: 'error'
			});

			return;
		}

		if (authorizedPrincipals.includes(trimmed)) {
			notificationsStore.add({
				title: 'Already Authorized',
				message: 'This principal is already authorized.',
				type: 'warning'
			});

			return;
		}

		isSubmitting = true;

		try {
			await authorizeOraclePrincipals({ principals: [trimmed] });

			notificationsStore.add({
				title: 'Principal Authorized',
				message: 'Principal can now settle markets on this oracle.',
				type: 'success'
			});

			newPrincipal = '';

			await load();
		} catch (e: unknown) {
			notificationsStore.add({
				title: 'Authorization Failed',
				message: (e as Error).message,
				type: 'error'
			});
		} finally {
			isSubmitting = false;
		}
	};

	const handleAuthorizeSelf = async () => {
		isSubmitting = true;

		try {
			const identity = await safeGetIdentityOnce();
			const self = identity.getPrincipal().toText();

			if (authorizedPrincipals.includes(self)) {
				notificationsStore.add({
					title: 'Already Authorized',
					message: 'Your principal is already authorized on this oracle.',
					type: 'info'
				});

				return;
			}

			await authorizeOraclePrincipals({ principals: [self] });

			notificationsStore.add({
				title: 'Principal Authorized',
				message: 'Your principal has been added to the oracle.',
				type: 'success'
			});

			await load();
		} catch (e: unknown) {
			notificationsStore.add({
				title: 'Authorization Failed',
				message: (e as Error).message,
				type: 'error'
			});
		} finally {
			isSubmitting = false;
		}
	};

	const confirmRevoke = (principal: PrincipalText) => {
		principalToRevoke = principal;
		showConfirmModal = true;
	};

	const handleRevokeConfirm = async () => {
		if (!principalToRevoke) {
			showConfirmModal = false;

			return;
		}

		revokingPrincipal = principalToRevoke;

		try {
			await revokeOraclePrincipals({ principals: [principalToRevoke] });

			notificationsStore.add({
				title: 'Authorization Revoked',
				message: 'Principal can no longer settle markets on this oracle.',
				type: 'success'
			});

			await load();
		} catch (e: unknown) {
			notificationsStore.add({
				title: 'Revoke Failed',
				message: (e as Error).message,
				type: 'error'
			});
		} finally {
			revokingPrincipal = null;
			principalToRevoke = null;
			showConfirmModal = false;
		}
	};

	const handleRevokeCancel = () => {
		showConfirmModal = false;
		principalToRevoke = null;
	};

	const addButtonStatus = $derived(
		isSubmitting ? 'pending' : !newPrincipal.trim() ? 'disabled' : 'enabled'
	);
</script>

<Dialog title="Revoke Oracle Authorization" bind:show={showConfirmModal}>
	<p class="mb-6 text-slate-600">
		Are you sure you want to revoke settlement authorization for
		<strong class="font-mono break-all text-slate-950">{principalToRevoke}</strong>? They will no
		longer be able to settle markets backed by <code>{VICI_ORACLE_V1}</code>.
	</p>
	<div class="flex justify-end gap-3">
		<Button
			onclick={handleRevokeCancel}
			status={revokingPrincipal ? 'disabled' : 'enabled'}
			variant="ghost"
		>
			Cancel
		</Button>
		<Button
			onclick={handleRevokeConfirm}
			status={revokingPrincipal ? 'pending' : 'enabled'}
			variant="danger"
		>
			Revoke
		</Button>
	</div>
</Dialog>

<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
	<div class="mb-6 flex items-start justify-between gap-4">
		<div>
			<h2 class="text-xl font-semibold text-slate-900">Oracle Authorization</h2>
			<p class="mt-1 text-sm text-slate-500">
				Principals authorized to settle markets backed by
				<code class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">
					{VICI_ORACLE_V1}
				</code>
				on the registry canister.
			</p>
		</div>
		<button
			class="shrink-0 text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
			disabled={status === 'loading' || isSubmitting}
			onclick={load}
		>
			Refresh
		</button>
	</div>

	{#if status === 'loading'}
		<div class="flex justify-center py-8">
			<div
				class="h-6 w-6 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"
			></div>
		</div>
	{:else if status === 'error'}
		<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
			<p class="font-semibold">Failed to load oracle</p>
			<p class="mt-1 break-all">{errorMessage}</p>
			<Button class="mt-3" onclick={load} size="sm" variant="outline">Retry</Button>
		</div>
	{:else if status === 'missing'}
		<div class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
			<p class="font-semibold">Oracle not registered</p>
			<p class="mt-1">
				<code>{VICI_ORACLE_V1}</code> does not exist in the registry yet. Markets cannot be settled until
				it is registered. Only a controller or an Engine OracleAdmin can do this.
			</p>
			<Button
				class="mt-3"
				onclick={handleRegister}
				size="sm"
				status={isSubmitting ? 'pending' : 'enabled'}
			>
				Register Oracle with My Principal
			</Button>
		</div>
	{:else}
		<form
			class="mb-6 space-y-4"
			onsubmit={(e) => {
				e.preventDefault();

				handleAdd();
			}}
		>
			<div>
				<label class="block text-sm font-medium text-slate-900" for="oracle-principal">
					Authorize Principal
				</label>
				<div class="mt-2">
					<input
						id="oracle-principal"
						class="focus:ring-brand-600 block w-full rounded-md border-0 py-1.5 text-slate-900 shadow-sm ring-1 ring-slate-300 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
						oninput={(e) => (newPrincipal = e.currentTarget.value.trim())}
						placeholder="aaaaa-aa..."
						type="text"
						value={newPrincipal}
					/>
				</div>
				<p class="mt-2 text-sm text-slate-500">
					Add the II principal of a user that needs to be able to resolve markets.
				</p>
			</div>

			<div class="flex flex-wrap gap-3">
				<Button onclick={handleAdd} status={addButtonStatus}>Authorize</Button>
				<Button
					onclick={handleAuthorizeSelf}
					status={isSubmitting ? 'pending' : 'enabled'}
					variant="outline"
				>
					Authorize My Principal
				</Button>
			</div>
		</form>

		<div class="space-y-4">
			<h3 class="text-sm font-semibold tracking-wider text-slate-900 uppercase">
				Authorized ({authorizedPrincipals.length})
			</h3>

			{#if authorizedPrincipals.length === 0}
				<p class="text-sm text-slate-500 italic">
					No principals authorized yet. Markets using this oracle cannot be settled until at least
					one principal is added.
				</p>
			{:else}
				<ul class="divide-y divide-slate-200 overflow-hidden rounded-md border border-slate-200">
					{#each authorizedPrincipals as principal (principal)}
						<li class="px-6 py-4">
							<div class="flex items-center justify-between gap-4">
								<div class="min-w-0 text-sm text-slate-700">
									<CopyableAddress address={principal} label="Principal ID" />
								</div>
								<button
									class="shrink-0 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
									disabled={revokingPrincipal === principal}
									onclick={() => confirmRevoke(principal)}
								>
									{revokingPrincipal === principal ? 'Revoking...' : 'Revoke'}
								</button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>
