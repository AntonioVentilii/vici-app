<script lang="ts">
	import type { PrincipalText } from '@junobuild/schema';
	import { onMount } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import CopyableAddress from '$lib/components/ui/CopyableAddress.svelte';
	import { VICI_ORACLE_V1 } from '$lib/constants/app.constants';
	import { safeGetIdentityOnce } from '$lib/services/identity.services';
	import { getViciOracle, registerViciOracle } from '$lib/services/oracle.services';
	import { notificationsStore } from '$lib/stores/notification.store';

	type Status = 'loading' | 'missing' | 'ready' | 'error';

	let status = $state<Status>('loading');
	let authorizedPrincipals = $state<PrincipalText[]>([]);
	let errorMessage = $state<string | undefined>();
	let isSubmitting = $state(false);

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

	const handleRegister = async () => {
		isSubmitting = true;

		try {
			const identity = await safeGetIdentityOnce();
			const self = identity.getPrincipal().toText();

			await registerViciOracle({ authorizedPrincipals: [self] });

			notificationsStore.add({
				title: 'Oracle Registered',
				message: `${VICI_ORACLE_V1} created with your principal authorized. Subsequent settlers are synced automatically from the Roles list above.`,
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
</script>

<div class="border-border bg-card rounded-xl border p-6">
	<div class="mb-6 flex items-start justify-between gap-4">
		<div>
			<h2 class="text-foreground text-xl font-semibold">Oracle Settlers</h2>
			<p class="text-muted-foreground mt-1 text-sm">
				Principals authorized to settle markets backed by
				<code class="bg-foreground/5 text-foreground rounded px-1.5 py-0.5 font-mono text-xs">
					{VICI_ORACLE_V1}
				</code>. This list is driven by the
				<strong>Roles</strong> panel above: granting
				<code class="bg-foreground/5 rounded px-1 py-0.5 font-mono text-xs">ADMIN</code>
				or
				<code class="bg-foreground/5 rounded px-1 py-0.5 font-mono text-xs">SOLVER</code>
				automatically adds a user here, and revoking the role removes them.
			</p>
		</div>
		<button
			class="text-primary hover:text-primary shrink-0 text-sm font-medium disabled:opacity-50"
			disabled={status === 'loading' || isSubmitting}
			onclick={load}
		>
			Refresh
		</button>
	</div>

	{#if status === 'loading'}
		<div class="flex justify-center py-8">
			<div
				class="border-primary h-6 w-6 animate-spin rounded-full border-4 border-t-transparent"
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
			<p class="mt-2">
				Registering adds your principal as the first settler. Future settlers are added/removed
				automatically when the corresponding Juno role changes.
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
		<div class="space-y-4">
			<h3 class="text-foreground text-sm font-semibold tracking-wider uppercase">
				Authorized ({authorizedPrincipals.length})
			</h3>

			{#if authorizedPrincipals.length === 0}
				<p class="text-muted-foreground text-sm italic">
					No principals authorized yet. Assign the <strong>ADMIN</strong> or
					<strong>SOLVER</strong> role to a user above; the satellite hook will sync them here.
				</p>
			{:else}
				<ul class="divide-border border-border divide-y overflow-hidden rounded-md border">
					{#each authorizedPrincipals as principal (principal)}
						<li class="px-6 py-4">
							<div class="text-foreground min-w-0 text-sm">
								<CopyableAddress address={principal} label="Principal ID" />
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>
