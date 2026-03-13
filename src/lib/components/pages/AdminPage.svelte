<script lang="ts">
	import type { PrincipalText } from '@dfinity/zod-schemas';
	import { onMount } from 'svelte';
	import AdminAddForm from '$lib/components/admin/AdminAddForm.svelte';
	import AdminBulkMarketForm from '$lib/components/admin/AdminBulkMarketForm.svelte';
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

	// Admin Management State
	let roleEntries = $state<UserRoleEntry[]>([]);

	let newRolePrincipal = $state('');
	let newRoleSelected = $state<UserRole>(UserRole.ADMIN);

	// Bulk Creation Progress
	let bulkProgress = $state(0);
	let bulkTotal = $state(0);
	let bulkSuccess = $state(0);
	let bulkFailed = $state(0);

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

	const handleBulkCreate = async (
		bulkMarkets: {
			title: string;
			description: string;
			expiryDate: string;
			balanceDomain?: string;
			outcomes?: string[];
		}[]
	) => {
		const results = { success: 0, failed: 0 };

		loading = true;
		bulkProgress = 0;
		bulkTotal = bulkMarkets.length;
		bulkSuccess = 0;
		bulkFailed = 0;

		await Promise.allSettled(
			bulkMarkets.map(async ({ title, description, expiryDate, outcomes }) => {
				try {
					const result = await createMarket({
						title,
						description,
						expiryDate: BigInt(new Date(expiryDate).getTime()),
						outcomes
					});

					bulkSuccess++;
					return result;
				} catch (e) {
					bulkFailed++;
					throw e;
				} finally {
					bulkProgress++;
				}
			})
		);

		results.success = bulkSuccess;
		results.failed = bulkFailed;

		await fetchMarkets();

		loading = false;

		alert(
			`Bulk creation complete!\nSuccess: ${results.success}\nFailed: ${results.failed}${
				results.failed > 0 ? '\nCheck console for errors.' : ''
			}`
		);
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
			<AdminMarketForm onAddMarketSuccess={fetchMarkets} />

			<!-- Bulk Create -->
			<AdminBulkMarketForm onBulkCreate={handleBulkCreate} />
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

{#if loading && bulkTotal > 0}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm">
		<div class="scale-up w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
			<div class="mb-6 flex items-center justify-between">
				<h3 class="text-xl font-bold text-slate-950">Creating Markets</h3>
				<span class="text-sm font-medium text-slate-500">
					{bulkProgress} of {bulkTotal}
				</span>
			</div>

			<div class="mb-4 h-3 w-full overflow-hidden rounded-full bg-slate-100">
				<div
					style="width: {(bulkProgress / bulkTotal) * 100}%"
					class="h-full bg-indigo-600 transition-all duration-300 ease-out"
				></div>
			</div>

			<div class="mb-6 flex justify-between gap-4">
				<div
					class="flex grow flex-col items-center justify-center rounded-2xl bg-emerald-50 p-3 text-center"
				>
					<span class="text-xs font-bold text-emerald-600 uppercase">Success</span>
					<span class="text-xl font-bold text-emerald-950">{bulkSuccess}</span>
				</div>
				<div
					class="flex grow flex-col items-center justify-center rounded-2xl bg-rose-50 p-3 text-center"
				>
					<span class="text-xs font-bold text-rose-600 uppercase">Failed</span>
					<span class="text-xl font-bold text-rose-950">{bulkFailed}</span>
				</div>
			</div>

			<p class="text-center text-sm text-slate-600 italic">
				Please wait while we set up your prediction markets on the blockchain...
			</p>
		</div>
	</div>
{/if}

<style lang="postcss">
	.scale-up {
		animation: scale-up 0.3s ease-out;
	}

	@keyframes scale-up {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
