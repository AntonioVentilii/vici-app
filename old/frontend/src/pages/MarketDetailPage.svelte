<script lang="ts">
	import { onMount } from 'svelte';
	import { auth, isAuthenticated, identity } from '../stores/auth';
	import { userProfile, isAdmin } from '../stores/profile';
	import { backend } from '../stores/actor';
	import Button from '../components/ui/Button.svelte';
	import Card from '../components/ui/Card.svelte';
	import Badge from '../components/ui/Badge.svelte';
	import Input from '../components/ui/Input.svelte';
	import {
		ArrowLeft,
		TrendingUp,
		TrendingDown,
		Clock,
		Info,
		Users,
		MessageSquare,
		BarChart2,
		Lock,
		UserPlus,
		LogIn
	} from 'lucide-svelte';
	import { MarketStatus, PositionType } from '../backend';
	import { toast } from 'sonner';
	import { Principal } from '@icp-sdk/core/principal';

	// These will be ported next
	// import MarketDepthPanel from '../components/MarketDepthPanel.svelte';
	// import MarketAnalyticsChart from '../components/MarketAnalyticsChart.svelte';
	// import MarketDiscussion from '../components/MarketDiscussion.svelte';

	export let marketId: bigint;
	export let onBack: () => void;

	let market: any = null; // Should be MarketSnapshot | null
	let isLoading = true;
	let invitedUsers: Principal[] = [];

	let tradeAmount = '';
	let selectedPosition: 'yes' | 'no' = 'yes';
	let activeTab = 'analytics';

	$: callerPrincipal = $identity?.getPrincipal();
	$: isInvited = market?.inviteOnly
		? invitedUsers.some((p) => p.toString() === callerPrincipal?.toString())
		: true;
	$: isCreator = market?.createdBy.toString() === callerPrincipal?.toString();
	$: canManageInvites = market?.inviteOnly && (isCreator || $isAdmin);
	$: isClosed = market?.status === MarketStatus.closed || market?.status === MarketStatus.resolved;
	$: canTrade = $isAuthenticated && !isClosed && isInvited;

	async function fetchMarketData() {
		const { actor } = $backend;
		if (!actor) return;

		isLoading = true;
		try {
			const [m, invited] = await Promise.all([
				actor.getMarket(marketId),
				// If the backend doesn't have a direct method for this, we get it from market snapshot
				Promise.resolve([]) // Placeholder for invited users fetch
			]);
			market = m;
			// In the React version, it was getting invited users from the market snapshot
			invitedUsers = market?.invitedUsers || [];
		} catch (error) {
			console.error('Failed to fetch market:', error);
			toast.error('Failed to load market details');
		} finally {
			isLoading = false;
		}
	}

	onMount(fetchMarketData);

	// Re-fetch if backend actor changes
	backend.subscribe(({ actor }) => {
		if (actor) fetchMarketData();
	});

	const handleTrade = async () => {
		if (!market || !$userProfile?.profile) return;

		const amount = parseInt(tradeAmount);
		if (isNaN(amount) || amount <= 0) {
			toast.error('Please enter a valid amount');
			return;
		}

		if (amount > Number($userProfile.profile.balance)) {
			toast.error('Insufficient balance');
			return;
		}

		try {
			const { actor } = $backend;
			if (!actor) throw new Error('Actor not available');

			await actor.placePosition(
				market.id,
				selectedPosition === 'yes' ? PositionType.yes : PositionType.no,
				BigInt(amount)
			);

			toast.success(`Successfully placed Ꝟ ${amount} on ${selectedPosition.toUpperCase()}`);
			tradeAmount = '';
			await fetchMarketData(); // Refresh market state
			userProfile.refresh(); // Refresh balance
		} catch (error: any) {
			toast.error(error.message || 'Failed to place trade');
		}
	};

	const formatDate = (timestamp: bigint) => {
		const date = new Date(Number(timestamp) / 1000000);
		return date.toLocaleDateString('en-US', {
			month: 'long',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	};
</script>

<div class="container mx-auto px-4 py-8">
	<Button variant="ghost" on:click={onBack} className="mb-6">
		<ArrowLeft size={16} class="mr-2" />
		Back to Markets
	</Button>

	{#if isLoading}
		<div class="space-y-6">
			<div class="h-12 w-48 animate-pulse rounded bg-slate-100"></div>
			<div class="h-96 animate-pulse rounded bg-slate-100"></div>
		</div>
	{:else if !market}
		<div class="text-muted-foreground py-16 text-center">Market not found</div>
	{:else}
		<div class="grid gap-8 lg:grid-cols-3">
			<!-- Main Content -->
			<div class="space-y-6 lg:col-span-2">
				<!-- Market Header -->
				<Card>
					<div class="space-y-4 p-6">
						<div class="flex items-start justify-between gap-4">
							<div class="flex-1">
								<h1 class="text-foreground mb-2 text-3xl font-bold">
									{market.title}
								</h1>
								<p class="text-muted-foreground">
									{market.description}
								</p>
							</div>
							<div class="flex flex-col gap-2">
								{#if market.status === MarketStatus.open}
									<Badge className="bg-emerald-500 text-white border-emerald-500">Open</Badge>
								{:else if market.status === MarketStatus.closed}
									<Badge variant="secondary">Closed</Badge>
								{:else if market.status === MarketStatus.resolved}
									<Badge variant="outline">Resolved</Badge>
								{/if}

								{#if market.inviteOnly}
									<Badge variant="outline" className="gap-1">
										<Lock size={12} />
										Invite-only
									</Badge>
								{/if}
							</div>
						</div>

						<div class="flex flex-wrap gap-2">
							{#each market.categories as category}
								<Badge variant="secondary">{category}</Badge>
							{/each}
						</div>

						<div class="text-muted-foreground flex items-center gap-4 text-sm">
							<div class="flex items-center gap-1">
								<Clock size={16} />
								<span>Expires: {formatDate(market.expiration)}</span>
							</div>
						</div>

						{#if market.status === MarketStatus.resolved && market.resolvedOutcome !== undefined}
							<div class="rounded-lg bg-slate-100 p-4">
								<p class="text-foreground text-sm font-medium">
									Resolved: <span class="text-lg font-bold"
										>{market.resolvedOutcome ? 'YES' : 'NO'}</span
									>
								</p>
							</div>
						{/if}
					</div>
				</Card>

				<!-- Odds Display -->
				<Card>
					<div class="space-y-4 p-6">
						<h3 class="text-lg font-semibold">Current Odds</h3>
						<div class="grid grid-cols-2 gap-4">
							<div class="rounded-lg border-2 border-emerald-200 bg-emerald-50 p-6 text-center">
								<div class="mb-2 flex items-center justify-center gap-2">
									<TrendingUp size={20} class="text-emerald-600" />
									<span class="text-muted-foreground text-sm font-medium">YES</span>
								</div>
								<p class="text-3xl font-bold text-emerald-600">
									{(market.oddsYes * 100).toFixed(1)}%
								</p>
							</div>
							<div class="rounded-lg border-2 border-rose-200 bg-rose-50 p-6 text-center">
								<div class="mb-2 flex items-center justify-center gap-2">
									<TrendingDown size={20} class="text-rose-600" />
									<span class="text-muted-foreground text-sm font-medium">NO</span>
								</div>
								<p class="text-3xl font-bold text-rose-600">
									{(market.oddsNo * 100).toFixed(1)}%
								</p>
							</div>
						</div>
					</div>
				</Card>

				<!-- Tabs Placeholder -->
				<Card>
					<div class="border-border rounded-t-md border-b bg-slate-100 p-1">
						<div class="flex">
							<button
								class="px-4 py-2 text-sm font-medium {activeTab === 'analytics'
									? 'rounded-sm bg-white shadow-sm'
									: 'hover:bg-slate-200'}"
								on:click={() => (activeTab = 'analytics')}
							>
								Analytics
							</button>
							<button
								class="px-4 py-2 text-sm font-medium {activeTab === 'depth'
									? 'rounded-sm bg-white shadow-sm'
									: 'hover:bg-slate-200'}"
								on:click={() => (activeTab = 'depth')}
							>
								Market Depth
							</button>
							<button
								class="px-4 py-2 text-sm font-medium {activeTab === 'discussion'
									? 'rounded-sm bg-white shadow-sm'
									: 'hover:bg-slate-200'}"
								on:click={() => (activeTab = 'discussion')}
							>
								Discussion
							</button>
						</div>
					</div>
					<div class="p-6">
						{#if activeTab === 'analytics'}
							<div
								class="text-muted-foreground flex h-64 items-center justify-center rounded bg-slate-50"
							>
								Analytics Chart Component (TBD)
							</div>
						{:else if activeTab === 'depth'}
							<div
								class="text-muted-foreground flex h-64 items-center justify-center rounded bg-slate-50"
							>
								Market Depth Panel (TBD)
							</div>
						{:else}
							<div
								class="text-muted-foreground flex h-64 items-center justify-center rounded bg-slate-50"
							>
								Market Discussion Component (TBD)
							</div>
						{/if}
					</div>
				</Card>
			</div>

			<!-- Sidebar -->
			<div class="space-y-6">
				<!-- Trading Card -->
				<Card>
					<div class="space-y-4 p-6">
						<h3 class="text-lg font-semibold">Place Trade</h3>

						{#if !$isAuthenticated}
							<div class="space-y-4 py-8 text-center">
								<LogIn size={48} class="text-muted-foreground mx-auto" />
								<div>
									<p class="text-foreground mb-1 text-sm font-medium">Login to Trade</p>
									<p class="text-muted-foreground mb-4 text-xs">
										Sign in to place your bets on this market
									</p>
								</div>
								<Button on:click={() => auth.login()} className="w-full">
									<LogIn size={16} class="mr-2" />
									Login to Trade
								</Button>
							</div>
						{:else if !isInvited}
							<div class="py-8 text-center">
								<Lock size={48} class="text-muted-foreground mx-auto mb-3" />
								<p class="text-foreground mb-1 text-sm font-medium">Invite-only Market</p>
								<p class="text-muted-foreground text-xs">You are not invited to this market</p>
							</div>
						{:else if isClosed}
							<div class="py-8 text-center">
								<Info size={48} class="text-muted-foreground mx-auto mb-3" />
								<p class="text-muted-foreground text-sm">This market is closed for trading</p>
							</div>
						{:else}
							<div class="space-y-4">
								<div class="space-y-2">
									<label class="text-sm font-medium">Position</label>
									<div class="grid grid-cols-2 gap-2">
										<Button
											variant={selectedPosition === 'yes' ? 'default' : 'outline'}
											on:click={() => (selectedPosition = 'yes')}
											className={selectedPosition === 'yes'
												? 'bg-emerald-600 hover:bg-emerald-700'
												: ''}
										>
											<TrendingUp size={16} class="mr-2" />
											YES
										</Button>
										<Button
											variant={selectedPosition === 'no' ? 'default' : 'outline'}
											on:click={() => (selectedPosition = 'no')}
											className={selectedPosition === 'no' ? 'bg-rose-600 hover:bg-rose-700' : ''}
										>
											<TrendingDown size={16} class="mr-2" />
											NO
										</Button>
									</div>
								</div>

								<div class="space-y-2">
									<label for="amount" class="text-sm font-medium">Amount (Ꝟ)</label>
									<Input id="amount" placeholder="100" bind:value={tradeAmount} />
									{#if $userProfile?.profile}
										<p class="text-muted-foreground text-xs">
											Available: Ꝟ {Number($userProfile.profile.balance).toLocaleString()}
										</p>
									{/if}
								</div>

								<Button on:click={handleTrade} disabled={!tradeAmount} className="w-full">
									Place Trade
								</Button>
							</div>
						{/if}
					</div>
				</Card>

				<!-- Market Info Card -->
				<Card>
					<div class="space-y-4 p-6">
						<div class="flex items-center gap-2">
							<Info size={20} />
							<h3 class="font-semibold">Market Info</h3>
						</div>
						<div class="space-y-3 text-sm">
							<div class="flex justify-between">
								<span class="text-muted-foreground">Status</span>
								<span class="font-medium uppercase underline">{market.status}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-muted-foreground">Type</span>
								<span class="font-medium">{market.inviteOnly ? 'Invite-only' : 'Public'}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-muted-foreground">Created</span>
								<span class="font-medium">{formatDate(market.createdAt)}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-muted-foreground">Expires</span>
								<span class="font-medium">{formatDate(market.expiration)}</span>
							</div>
						</div>
					</div>
				</Card>
			</div>
		</div>
	{/if}
</div>
