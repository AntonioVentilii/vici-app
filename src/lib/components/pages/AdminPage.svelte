<script lang="ts">
	import type { PrincipalText } from '@dfinity/zod-schemas';
	import { onMount } from 'svelte';
	import AdminAddForm from '$lib/components/admin/AdminAddForm.svelte';
	import AdminList from '$lib/components/admin/AdminList.svelte';
	import AdminMarketForm from '$lib/components/admin/AdminMarketForm.svelte';
	import AdminResolutionHistory from '$lib/components/admin/AdminResolutionHistory.svelte';
	import AdminResolutionList from '$lib/components/admin/AdminResolutionList.svelte';
	import { resolveMarket } from '$lib/services/authn.services';
	import { createMarket, getMarkets } from '$lib/services/market.services';
	import { listRoles, removeRole, setRole, type UserRoleEntry } from '$lib/services/roles.services';
	import type { Market, MarketId, Outcome } from '$lib/types/market';
	import { UserRole } from '$lib/types/user';

	let markets = $state<Market[]>([]);
	let loading = $state(true);

	// Create Market Form State
	let title = $state('');
	let description = $state('');
	let expiryDate = $state('');

	// Admin Management State
	let roleEntries = $state<UserRoleEntry[]>([]);

	let newRolePrincipal = $state('');
	let newRoleSelected = $state<UserRole>(UserRole.ADMIN);

	const fetchMarkets = async () => {
		markets = await getMarkets();
		loading = false;
	};

	const fetchRoles = async () => {
		try {
			roleEntries = await listRoles();
		} catch (e: unknown) {
			console.error('Failed to fetch roles:', e);
		}
	};

	onMount(() => {
		fetchMarkets();

		fetchRoles();
	});

	const handleCreateMarket = async () => {
		if (!title || !description || !expiryDate) {
			return;
		}
		try {
			await createMarket({
				title,
				description,
				expiryDate: BigInt(new Date(expiryDate).getTime())
			});
			title = '';
			description = '';
			expiryDate = '';
			await fetchMarkets();
			alert('Market created successfully!');
		} catch (e: unknown) {
			alert((e as Error).message);
		}
	};

	const handleResolve = async ({ marketId, outcome }: { marketId: MarketId; outcome: Outcome }) => {
		try {
			await resolveMarket({ marketId, outcome });
			await fetchMarkets();
			alert(`Market ${marketId} resolved as ${outcome}`);
		} catch (e: unknown) {
			alert((e as Error).message);
		}
	};

	const handleAddRole = async () => {
		if (!newRolePrincipal) {
			return;
		}
		try {
			await setRole({ principal: newRolePrincipal, role: newRoleSelected });

			alert('Role granted successfully!');

			newRolePrincipal = '';
			newRoleSelected = UserRole.ADMIN;

			await fetchRoles();
		} catch (e: unknown) {
			alert((e as Error).message);
		}
	};

	const handleRemoveRole = async (principal: PrincipalText) => {
		try {
			await removeRole(principal);
			alert('Role removed successfully!');
			await fetchRoles();
		} catch (e: unknown) {
			alert((e as Error).message);
		}
	};

	const unresolvedMarkets = $derived(markets.filter((m) => m.status !== 'Resolved'));
	const resolvedMarkets = $derived(markets.filter((m) => m.status === 'Resolved'));
</script>

<div class="space-y-12">
	<div class="space-y-4">
		<h1 class="text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">
			Admin Dashboard
		</h1>
		<p class="max-w-2xl text-lg text-slate-600">
			Manage markets, create new opportunities, resolve expired predictions, and manage
			administrators.
		</p>
	</div>

	<div class="grid grid-cols-1 gap-12 lg:grid-cols-2">
		<!-- Main Admin Forms Stack -->
		<section class="space-y-8">
			<!-- Add Role -->
			<AdminAddForm
				onAddRole={handleAddRole}
				onPrincipalChange={(v) => (newRolePrincipal = v)}
				onRoleChange={(v) => (newRoleSelected = v)}
				principal={newRolePrincipal}
				role={newRoleSelected}
			/>

			<!-- Create Market -->
			<AdminMarketForm
				{description}
				{expiryDate}
				onCreate={handleCreateMarket}
				onDescriptionChange={(v) => (description = v)}
				onExpiryChange={(v) => (expiryDate = v)}
				onTitleChange={(v) => (title = v)}
				{title}
			/>
		</section>

		<!-- Lists Stack -->
		<section class="space-y-8">
			<!-- Roles List -->
			<AdminList onRemoveRole={handleRemoveRole} {roleEntries} />

			<!-- Resolve Markets -->
			<AdminResolutionList {loading} markets={unresolvedMarkets} onResolve={handleResolve} />

			<!-- Resolved History -->
			<AdminResolutionHistory markets={resolvedMarkets} />
		</section>
	</div>
</div>
