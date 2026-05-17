<script lang="ts">
	import type { PrincipalText } from '@junobuild/schema';
	import { onMount } from 'svelte';
	import type { RegistryDid } from '$declarations';
	import AdminAddForm from '$lib/components/admin/AdminAddForm.svelte';
	import AdminBulkMarketForm from '$lib/components/admin/AdminBulkMarketForm.svelte';
	import AdminList from '$lib/components/admin/AdminList.svelte';
	import AdminMarketForm from '$lib/components/admin/AdminMarketForm.svelte';
	import AdminOracleManager from '$lib/components/admin/AdminOracleManager.svelte';
	import AdminResolutionHistory from '$lib/components/admin/AdminResolutionHistory.svelte';
	import AdminResolutionList from '$lib/components/admin/AdminResolutionList.svelte';
	import { markets } from '$lib/derived/markets.derived';
	import { UserRole } from '$lib/enums/user';
	import { resolveMarket } from '$lib/services/authn.services';
	import { associateSeriesWithCategory } from '$lib/services/category.services';
	import { safeGetIdentityOnce } from '$lib/services/identity.services';
	import { createMarket } from '$lib/services/market.services';
	import { getProfile } from '$lib/services/profile.services';
	import { listRoles, removeRole, setRole, type UserRoleEntry } from '$lib/services/roles.services';
	import { notificationsStore } from '$lib/stores/notification.store';
	import type { MarketId, Outcome } from '$lib/types/market';
	import { toBalanceDomain } from '$lib/utils/balance-domain.utils';

	let loading = $state(true);
	let isAssigningRole = $state(false);

	let roleEntries = $state<UserRoleEntry[]>([]);

	let newRolePrincipal = $state('');
	let newRoleSelected = $state<UserRole>(UserRole.ADMIN);

	let bulkProgress = $state(0);
	let bulkTotal = $state(0);
	let bulkSuccess = $state(0);
	let bulkFailed = $state(0);

	// eslint-disable-next-line require-await
	const fetchMarkets = async () => {
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
			categories?: string[];
		}[]
	) => {
		const results = { success: 0, failed: 0 };

		loading = true;
		bulkProgress = 0;
		bulkTotal = bulkMarkets.length;
		bulkSuccess = 0;
		bulkFailed = 0;

		const identity = await safeGetIdentityOnce();
		const adminPrincipal = identity.getPrincipal().toText();
		const defaultDomain: RegistryDid.BalanceDomain = { ViciXp: null };

		await Promise.allSettled(
			bulkMarkets.map(
				async ({ title, description, expiryDate, outcomes, balanceDomain, categories }) => {
					try {
						const result = await createMarket({
							title,
							description,
							expiryDate: BigInt(new Date(expiryDate).getTime()),
							outcomes,
							balanceDomain: balanceDomain ? toBalanceDomain(balanceDomain) : defaultDomain
						});

						if (categories && categories.length > 0) {
							await Promise.allSettled(
								categories.map((categoryId) =>
									associateSeriesWithCategory({
										seriesId: result,
										categoryId: categoryId.toLowerCase(),
										adminPrincipal
									})
								)
							);
						}

						bulkSuccess++;

						return result;
					} catch (e) {
						console.error(`Failed to create bulk market: ${title}`, e);

						bulkFailed++;
						throw e;
					} finally {
						bulkProgress++;
					}
				}
			)
		);

		results.success = bulkSuccess;
		results.failed = bulkFailed;

		await fetchMarkets();

		loading = false;

		notificationsStore.add({
			title: 'Bulk Creation Complete',
			message: `Success: ${results.success}\nFailed: ${results.failed}${
				results.failed > 0 ? '\nCheck console for errors.' : ''
			}`,
			type: results.failed > 0 ? 'warning' : 'success'
		});
	};

	const handleResolve = async ({ marketId, outcome }: { marketId: MarketId; outcome: Outcome }) => {
		try {
			await resolveMarket({ marketId, outcome });
			await fetchMarkets();
			notificationsStore.add({
				title: 'Market Resolved',
				message: `Market ${marketId} resolved as ${outcome}`,
				type: 'success'
			});
		} catch (e: unknown) {
			notificationsStore.add({
				title: 'Resolution Failed',
				message: (e as Error).message,
				type: 'error'
			});
		}
	};

	const handleAddRole = async () => {
		const principal = newRolePrincipal.trim();

		const role = newRoleSelected;

		if (!principal) {
			return;
		}

		isAssigningRole = true;

		try {
			await setRole({ principal, role });

			notificationsStore.add({
				title: 'Role Granted',
				message: 'Role granted successfully!',
				type: 'success'
			});

			newRolePrincipal = '';
			newRoleSelected = UserRole.ADMIN;

			const getNickname = async (principal: PrincipalText): Promise<string | undefined> => {
				try {
					const profile = await getProfile(principal);

					return profile.data?.nickname;
				} catch {
					// The nickname is purely cosmetic for the admin role list; missing profiles should not block the grant flow.
				}
			};

			const nickname = await getNickname(principal);

			roleEntries = [
				...roleEntries.filter((e) => e.principal !== principal),
				{ principal, role, nickname }
			];

			await fetchRoles();
		} catch (e: unknown) {
			notificationsStore.add({
				title: 'Grant Failed',
				message: (e as Error).message,
				type: 'error'
			});
		} finally {
			isAssigningRole = false;
		}
	};

	const handleRemoveRole = async (principal: PrincipalText) => {
		try {
			await removeRole(principal);
			notificationsStore.add({
				title: 'Role Removed',
				message: 'Role removed successfully!',
				type: 'success'
			});

			roleEntries = roleEntries.filter((e) => e.principal !== principal);

			await fetchRoles();
		} catch (e: unknown) {
			notificationsStore.add({
				title: 'Removal Failed',
				message: (e as Error).message,
				type: 'error'
			});
		}
	};

	const unresolvedMarkets = $derived($markets.filter((m) => m.status !== 'Resolved'));
	const resolvedMarkets = $derived($markets.filter((m) => m.status === 'Resolved'));
</script>

<div class="space-y-12">
	<div class="space-y-4">
		<h1 class="font-display text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">
			Admin Dashboard
		</h1>
		<p class="text-muted-foreground max-w-2xl text-lg">
			Manage markets, create new opportunities, resolve expired predictions, and manage
			administrators.
		</p>
	</div>

	<div class="grid grid-cols-1 gap-12 lg:grid-cols-2">
		<section class="space-y-8">
			<AdminAddForm
				isAssigning={isAssigningRole}
				onAddRole={handleAddRole}
				onPrincipalChange={(v) => (newRolePrincipal = v)}
				onRoleChange={(v) => (newRoleSelected = v)}
				principal={newRolePrincipal}
				role={newRoleSelected}
			/>

			<AdminMarketForm onAddMarketSuccess={fetchMarkets} />

			<AdminBulkMarketForm onBulkCreate={handleBulkCreate} />
		</section>

		<section class="space-y-8">
			<AdminList onRemoveRole={handleRemoveRole} {roleEntries} />

			<AdminOracleManager />

			<AdminResolutionList {loading} markets={unresolvedMarkets} onResolve={handleResolve} />

			<AdminResolutionHistory markets={resolvedMarkets} />
		</section>
	</div>
</div>

{#if loading && bulkTotal > 0}
	<div
		class="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
	>
		<div class="scale-up border-border bg-card w-full max-w-md rounded-lg border p-8 shadow-2xl">
			<div class="mb-6 flex items-center justify-between">
				<h3 class="text-foreground text-xl font-bold">Creating Markets</h3>
				<span class="text-muted-foreground font-mono text-sm font-medium tabular-nums">
					{bulkProgress} of {bulkTotal}
				</span>
			</div>

			<div class="bg-card mb-4 h-3 w-full overflow-hidden rounded-full">
				<div
					style="width: {(bulkProgress / bulkTotal) * 100}%"
					class="bg-primary h-full transition-all duration-300 ease-out"
				></div>
			</div>

			<div class="mb-6 flex justify-between gap-4">
				<div
					class="bg-yes-wash flex grow flex-col items-center justify-center rounded-lg p-3 text-center"
				>
					<span class="text-yes text-xs font-bold uppercase">Success</span>
					<span class="text-foreground font-mono text-xl font-bold">{bulkSuccess}</span>
				</div>
				<div
					class="bg-no-wash flex grow flex-col items-center justify-center rounded-lg p-3 text-center"
				>
					<span class="text-no text-xs font-bold uppercase">Failed</span>
					<span class="text-foreground font-mono text-xl font-bold">{bulkFailed}</span>
				</div>
			</div>

			<p class="text-muted-foreground text-center text-sm italic">
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
