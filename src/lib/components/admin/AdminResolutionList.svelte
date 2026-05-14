<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import type { Market, MarketId, Outcome } from '$lib/types/market';

	interface Props {
		markets: Market[];
		loading: boolean;
		onResolve: (params: { marketId: MarketId; outcome: Outcome }) => Promise<void>;
	}

	const { markets, loading, onResolve }: Props = $props();

	let resolvingMarketId = $state<MarketId | null>(null);

	const handleResolve = async (params: { marketId: MarketId; outcome: Outcome }) => {
		resolvingMarketId = params.marketId;

		try {
			await onResolve(params);
		} finally {
			resolvingMarketId = null;
		}
	};

	const sortedMarkets = $derived([...markets].sort((a, b) => Number(a.expiryDate - b.expiryDate)));

	const getExpirationStatus = (expiryDate: bigint) => {
		const now = BigInt(Date.now());

		const diff = Number(expiryDate - now);

		if (diff <= 0) {
			return { label: 'EXPIRED', color: 'red' };
		}

		if (diff < 1000 * 60 * 60) {
			return { label: 'URGENT (<1h)', color: 'orange' };
		}

		if (diff < 1000 * 60 * 60 * 24) {
			return { label: 'TODAY', color: 'orange-light' };
		}

		if (diff < 1000 * 60 * 60 * 24 * 7) {
			return { label: 'THIS WEEK', color: 'amber' };
		}

		return { label: 'PENDING', color: 'muted' };
	};

	const getStatusStyles = (color: string) => {
		switch (color) {
			case 'red':
				return 'bg-red-50 border-red-200 text-red-700';
			case 'orange':
				return 'bg-orange-100 border-orange-300 text-orange-900';
			case 'orange-light':
				return 'bg-orange-50 border-orange-200 text-orange-700';
			case 'amber':
				return 'bg-amber-50 border-amber-100 text-amber-700';
			default:
				return 'bg-foreground/5 border-border text-muted-foreground';
		}
	};

	const getBadgeStyles = (color: string) => {
		switch (color) {
			case 'red':
				return 'bg-red-200 text-red-800';
			case 'orange':
				return 'bg-orange-200 text-orange-900';
			case 'orange-light':
				return 'bg-orange-100 text-orange-800';
			case 'amber':
				return 'bg-amber-100 text-amber-800';
			default:
				return 'bg-foreground/8 text-foreground';
		}
	};
</script>

<div class="border-border bg-card rounded-3xl border p-8">
	<h2 class="text-foreground mb-6 text-2xl font-bold">Resolve Active Markets</h2>

	{#if loading}
		<div class="flex justify-center py-12">
			<div
				class="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
			></div>
		</div>
	{:else if sortedMarkets.length === 0}
		<p class="text-muted-foreground py-12 text-center text-sm italic">
			No active markets requiring resolution.
		</p>
	{:else}
		<div class="space-y-6">
			{#each sortedMarkets as market (market.id)}
				{@const { id: marketId, title, expiryDate } = market}
				{@const status = getExpirationStatus(expiryDate)}

				<div
					class="space-y-4 rounded-2xl border p-6 {getStatusStyles(status.color)} transition-all"
				>
					<div class="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
						<div class="space-y-1">
							<div class="flex items-center gap-3">
								<h3 class="text-lg font-bold">{title}</h3>
								<span
									class="rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-wider uppercase {getBadgeStyles(
										status.color
									)}"
								>
									{status.label}
								</span>
							</div>
							<p class="font-mono text-[10px] opacity-60">ID: {marketId}</p>
						</div>

						<div class="text-[11px] font-semibold opacity-80">
							Expires: {new Date(Number(expiryDate)).toLocaleString()}
						</div>
					</div>

					<div class="flex gap-2">
						<Button
							class="flex-1 rounded-xl border border-green-200 bg-green-50 py-2 text-xs font-bold text-green-700 hover:bg-green-100"
							onclick={() => handleResolve({ marketId, outcome: 'YES' })}
							size="sm"
							status={resolvingMarketId === marketId ? 'pending' : 'enabled'}
							variant="ghost"
						>
							Resolve YES
						</Button>
						<Button
							class="flex-1 rounded-xl border border-red-200 bg-red-50 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
							onclick={() => handleResolve({ marketId, outcome: 'NO' })}
							size="sm"
							status={resolvingMarketId === marketId ? 'pending' : 'enabled'}
							variant="ghost"
						>
							Resolve NO
						</Button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
