<script lang="ts">
	import { onMount } from 'svelte';
	import { backend } from '../stores/actor';
	import { markets } from '../stores/markets';
	import { userProfile } from '../stores/profile';
	import { auth } from '../stores/auth';
	import Card from '../components/ui/Card.svelte';
	import Button from '../components/ui/Button.svelte';
	import Input from '../components/ui/Input.svelte';
	import Textarea from '../components/ui/Textarea.svelte';
	import Badge from '../components/ui/Badge.svelte';
	import Switch from '../components/ui/Switch.svelte';
	import RadioGroup from '../components/ui/RadioGroup.svelte';
	import RadioGroupItem from '../components/ui/RadioGroupItem.svelte';
	import {
		Plus,
		CheckCircle,
		Coins,
		Lock,
		AlertTriangle,
		Clock,
		Shield,
		Crown,
		Info,
		Loader2
	} from 'lucide-svelte';
	import { Principal } from '@icp-sdk/core/principal';
	import { toast } from 'sonner';

	// Tabs state
	let activeTab = 'resolve';

	// Create Market Form
	let title = '';
	let description = '';
	let categories = '';
	let expirationDate = '';
	let inviteOnly = false;
	let initialInvites = '';
	let isCreatingMarket = false;

	// Grant Coins Form (Placeholder)
	let userPrincipal = '';
	let coinAmount = '';

	// Admin Management (Placeholder)
	let adminList: Principal[] = [];
	let isAdminListLoading = false;
	let newAdminPrincipal = '';

	// Market Resolution State
	let selectedOutcomes: Record<string, string> = {};
	let isResolving: Record<string, boolean> = {};

	$: sortedMarkets = [...$markets.markets].sort((a, b) => {
		const now = BigInt(Date.now() * 1000000);
		const aExpired = a.expiration < now;
		const bExpired = b.expiration < now;
		const aResolved = a.status === 'resolved';
		const bResolved = b.status === 'resolved';

		if (aExpired && !aResolved && (!bExpired || bResolved)) return -1;
		if (bExpired && !bResolved && (!aExpired || aResolved)) return 1;

		return Number(a.expiration - b.expiration);
	});

	const isMarketExpired = (expiration: bigint): boolean => {
		return expiration < BigInt(Date.now() * 1000000);
	};

	const formatExpirationDate = (expiration: bigint): string => {
		return new Date(Number(expiration) / 1000000).toLocaleString();
	};

	const handleCreateMarket = async (e: Event) => {
		e.preventDefault();
		if (!title || !description || !expirationDate) {
			toast.error('Please fill in all required fields');
			return;
		}

		isCreatingMarket = true;
		try {
			const expiration = BigInt(new Date(expirationDate).getTime() * 1000000);
			const categoryArray = categories
				.split(',')
				.map((c) => c.trim())
				.filter(Boolean);

			let invitedUsersList: Principal[] = [];
			if (inviteOnly && initialInvites.trim()) {
				const invitePrincipals = initialInvites
					.split(',')
					.map((p) => p.trim())
					.filter(Boolean);
				invitedUsersList = invitePrincipals.map((p) => Principal.fromText(p));
			}

			const { actor } = $backend;
			if (!actor) throw new Error('Actor not available');

			await actor.createMarket(
				title,
				description,
				categoryArray,
				expiration,
				inviteOnly,
				invitedUsersList
			);

			toast.success('Market created successfully');
			title = '';
			description = '';
			categories = '';
			expirationDate = '';
			inviteOnly = false;
			initialInvites = '';
			markets.refresh();
		} catch (error: any) {
			toast.error(error.message || 'Failed to create market');
		} finally {
			isCreatingMarket = false;
		}
	};

	const handleResolveMarket = async (marketId: bigint) => {
		const outcome = selectedOutcomes[marketId.toString()];
		if (!outcome) return;

		if (outcome === 'canceled') {
			toast.error('CANCELED outcome is not yet supported');
			return;
		}

		isResolving[marketId.toString()] = true;
		try {
			const { actor } = $backend;
			if (!actor) throw new Error('Actor not available');

			await actor.resolveMarket(marketId, outcome === 'yes');
			toast.success(`Market resolved as ${outcome.toUpperCase()}`);

			delete selectedOutcomes[marketId.toString()];
			selectedOutcomes = selectedOutcomes; // Trigger reactivity
			markets.refresh();
			userProfile.refresh();
		} catch (error: any) {
			toast.error(error.message || 'Failed to resolve market');
		} finally {
			isResolving[marketId.toString()] = false;
		}
	};

	onMount(async () => {
		const { actor } = $backend;
		if (actor && 'getAdminList' in (actor as any)) {
			isAdminListLoading = true;
			try {
				adminList = await (actor as any).getAdminList();
			} catch (error) {
				console.error('Failed to fetch admin list:', error);
			} finally {
				isAdminListLoading = false;
			}
		}
	});

	const handleTabClick = (tab: string) => (activeTab = tab);
</script>

<div class="container mx-auto px-4 py-8">
	<div class="space-y-8">
		<!-- Header -->
		<div>
			<h1 class="text-foreground text-4xl font-bold">Admin Panel</h1>
			<p class="text-muted-foreground mt-2">Manage markets, users, and admins</p>
		</div>

		<!-- Tabs List -->
		<div class="border-border flex border-b">
			<button
				class="border-b-2 px-4 py-2 text-sm font-medium transition-colors {activeTab === 'resolve'
					? 'border-primary text-primary'
					: 'text-muted-foreground hover:text-foreground border-transparent'}"
				on:click={() => handleTabClick('resolve')}
			>
				Market Resolution
			</button>
			<button
				class="border-b-2 px-4 py-2 text-sm font-medium transition-colors {activeTab === 'create'
					? 'border-primary text-primary'
					: 'text-muted-foreground hover:text-foreground border-transparent'}"
				on:click={() => handleTabClick('create')}
			>
				Create Market
			</button>
			<button
				class="border-b-2 px-4 py-2 text-sm font-medium transition-colors {activeTab === 'grant'
					? 'border-primary text-primary'
					: 'text-muted-foreground hover:text-foreground border-transparent'}"
				on:click={() => handleTabClick('grant')}
			>
				Grant Coins
			</button>
			<button
				class="border-b-2 px-4 py-2 text-sm font-medium transition-colors {activeTab === 'admins'
					? 'border-primary text-primary'
					: 'text-muted-foreground hover:text-foreground border-transparent'}"
				on:click={() => handleTabClick('admins')}
			>
				Admin Management
			</button>
		</div>

		{#if activeTab === 'resolve'}
			<div class="space-y-6">
				<Card>
					<div class="p-6">
						<h3 class="mb-2 flex items-center gap-2 text-xl font-bold">
							<CheckCircle size={20} />
							Market Resolution Dashboard
						</h3>
						<p class="text-muted-foreground mb-6 text-sm">
							Resolve market outcomes. Expired markets requiring urgent attention are highlighted.
						</p>

						{#if sortedMarkets.length > 0}
							<div class="space-y-4">
								{#each sortedMarkets as market}
									{@const expired = isMarketExpired(market.expiration)}
									{@const resolved = market.status === 'resolved'}
									{@const urgent = expired && !resolved}
									{@const marketIdStr = market.id.toString()}
									{@const selectedOutcome = selectedOutcomes[marketIdStr]}

									<div
										class="rounded-lg border-2 p-4 transition-all {urgent
											? 'border-red-500 bg-red-50'
											: 'border-slate-100 bg-white shadow-sm'}"
									>
										{#if urgent}
											<div class="mb-3 flex items-center gap-2 text-red-600">
												<AlertTriangle size={20} />
												<span class="text-sm font-bold uppercase">Urgent: Expired & Unresolved</span
												>
											</div>
										{/if}

										<div class="space-y-3">
											<div class="flex justify-between gap-4">
												<div class="flex-1">
													<h4 class="text-lg font-bold">
														{market.title}
													</h4>
													<p class="text-muted-foreground mt-1 line-clamp-2 text-sm">
														{market.description}
													</p>
												</div>
											</div>

											<div class="flex flex-wrap items-center gap-2">
												<Badge
													variant={market.status === 'open'
														? 'default'
														: market.status === 'resolved'
															? 'success'
															: 'secondary'}
												>
													{market.status.toUpperCase()}
												</Badge>
												{#if market.inviteOnly}
													<Badge variant="outline" class="gap-1">
														<Lock size={12} /> Invite-only
													</Badge>
												{/if}
												<Badge variant={expired ? 'destructive' : 'outline'} class="gap-1">
													<Clock size={12} />
													{expired ? 'Expired' : 'Active'}
												</Badge>
												<span class="text-muted-foreground text-xs"
													>Expires: {formatExpirationDate(market.expiration)}</span
												>
											</div>

											{#if resolved}
												<div class="border-t pt-3">
													<div class="flex items-center gap-2">
														<span class="text-muted-foreground text-sm font-medium"
															>Resolved Outcome:</span
														>
														<Badge variant={market.resolvedOutcome ? 'success' : 'destructive'}>
															{market.resolvedOutcome ? 'YES' : 'NO'}
														</Badge>
													</div>
												</div>
											{:else}
												<div class="space-y-3 border-t pt-3">
													<label class="block text-sm font-medium">Select Outcome:</label>
													<RadioGroup
														value={selectedOutcome || ''}
														onValueChange={(v) => {
															selectedOutcomes[marketIdStr] = v;
															selectedOutcomes = selectedOutcomes;
														}}
														className="flex gap-6"
													>
														<div class="flex items-center gap-2">
															<RadioGroupItem value="yes" id="yes-{marketIdStr}" />
															<label for="yes-{marketIdStr}" class="cursor-pointer text-sm"
																>YES</label
															>
														</div>
														<div class="flex items-center gap-2">
															<RadioGroupItem value="no" id="no-{marketIdStr}" />
															<label for="no-{marketIdStr}" class="cursor-pointer text-sm">NO</label
															>
														</div>
														<div class="flex items-center gap-2">
															<RadioGroupItem value="canceled" id="canceled-{marketIdStr}" />
															<label
																for="canceled-{marketIdStr}"
																class="text-muted-foreground cursor-pointer text-sm">CANCELED</label
															>
														</div>
													</RadioGroup>

													<Button
														size="sm"
														on:click={() => handleResolveMarket(market.id)}
														disabled={!selectedOutcome || isResolving[marketIdStr]}
														class={urgent ? 'bg-red-600 text-white hover:bg-red-700' : ''}
													>
														{#if isResolving[marketIdStr]}
															<Loader2 size={16} class="mr-2 animate-spin" />
															Resolving...
														{:else}
															<CheckCircle size={16} class="mr-2" />
															Resolve Market
														{/if}
													</Button>
												</div>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<div class="text-muted-foreground py-12 text-center">
								<p>No markets available</p>
							</div>
						{/if}
					</div>
				</Card>
			</div>
		{:else if activeTab === 'create'}
			<Card>
				<div class="p-6">
					<h3 class="mb-6 flex items-center gap-2 text-xl font-bold">
						<Plus size={20} />
						Create New Market
					</h3>
					<form on:submit={handleCreateMarket} class="space-y-4">
						<div class="space-y-2">
							<label for="title" class="text-sm font-medium">Title *</label>
							<Input
								id="title"
								bind:value={title}
								placeholder="Will Bitcoin reach $100k?"
								required
							/>
						</div>
						<div class="space-y-2">
							<label for="description" class="text-sm font-medium">Description *</label>
							<Textarea
								id="description"
								bind:value={description}
								placeholder="Detailed resolution criteria..."
								rows={4}
								required
							/>
						</div>
						<div class="space-y-2">
							<label for="categories" class="text-sm font-medium"
								>Categories (comma-separated)</label
							>
							<Input id="categories" bind:value={categories} placeholder="Crypto, Finance" />
						</div>
						<div class="space-y-2">
							<label for="expiration" class="text-sm font-medium">Expiration Date *</label>
							<Input id="expiration" type="datetime-local" bind:value={expirationDate} required />
						</div>
						<div class="space-y-2">
							<div class="flex items-center gap-2">
								<Switch id="inviteOnly" bind:checked={inviteOnly} />
								<label for="inviteOnly" class="cursor-pointer text-sm font-medium"
									>Invite-only Market</label
								>
							</div>
							<p class="text-muted-foreground text-xs">Only invited users can participate</p>
						</div>
						{#if inviteOnly}
							<div class="space-y-2">
								<label for="initialInvites" class="text-sm font-medium"
									>Initial Invites (comma-separated Principal IDs)</label
								>
								<Textarea
									id="initialInvites"
									bind:value={initialInvites}
									placeholder="principal1, principal2..."
									rows={3}
								/>
							</div>
						{/if}
						<Button type="submit" disabled={isCreatingMarket} class="w-full">
							{#if isCreatingMarket}
								<Loader2 size={16} class="mr-2 animate-spin" />
								Creating...
							{:else}
								<Plus size={16} class="mr-2" />
								Create Market
							{/if}
						</Button>
					</form>
				</div>
			</Card>
		{:else if activeTab === 'grant'}
			<Card>
				<div class="p-6">
					<h3 class="mb-6 flex items-center gap-2 text-xl font-bold">
						<Coins size={20} />
						Grant Vici Coins
					</h3>
					<div class="mb-6 flex gap-3 rounded-lg bg-blue-50 p-4 text-blue-800">
						<Info size={20} class="shrink-0" />
						<p class="text-sm">This feature is not yet fully implemented in the backend.</p>
					</div>
					<form class="space-y-4">
						<div class="space-y-2">
							<label for="userPrincipal" class="text-sm font-medium">User Principal ID *</label>
							<Input
								id="userPrincipal"
								bind:value={userPrincipal}
								placeholder="Enter user's Principal ID"
								disabled
							/>
						</div>
						<div class="space-y-2">
							<label for="coinAmount" class="text-sm font-medium">Amount (Ꝟ) *</label>
							<Input
								id="coinAmount"
								type="number"
								bind:value={coinAmount}
								placeholder="1000"
								disabled
							/>
						</div>
						<Button disabled class="w-full">
							<Coins size={16} class="mr-2" />
							Grant Coins (Coming Soon)
						</Button>
					</form>
				</div>
			</Card>
		{:else if activeTab === 'admins'}
			<Card>
				<div class="space-y-6 p-6">
					<h3 class="flex items-center gap-2 text-xl font-bold">
						<Shield size={20} />
						Admin Management
					</h3>
					<div class="flex gap-3 rounded-lg bg-blue-50 p-4 text-blue-800">
						<Info size={20} class="shrink-0" />
						<p class="text-sm">Admin management features are coming in a future update.</p>
					</div>

					<div class="space-y-3">
						<h4 class="text-sm font-bold">Current Admins</h4>
						{#if isAdminListLoading}
							<div class="flex justify-center py-8">
								<Loader2 class="text-primary animate-spin" />
							</div>
						{:else if adminList.length > 0}
							<div class="space-y-2">
								{#each adminList as admin, index}
									<div
										class="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3"
									>
										<div class="flex items-center gap-3">
											{#if index === 0}<Crown size={16} class="text-yellow-500" />{/if}
											<code class="font-mono text-xs">{admin.toString()}</code>
											{#if index === 0}
												<Badge
													variant="outline"
													class="border-yellow-200 bg-yellow-50 text-yellow-700">Owner</Badge
												>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-muted-foreground py-8 text-center text-sm">
								No admins found or feature not yet supported.
							</p>
						{/if}
					</div>
				</div>
			</Card>
		{/if}
	</div>
</div>
