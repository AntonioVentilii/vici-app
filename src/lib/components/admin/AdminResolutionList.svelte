<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market, MarketId, Outcome } from '$lib/types/market';
	import { t } from '$lib/utils/i18n.utils';

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
			return {
				label: t({ locale: $localeStore, key: 'admin.resolution.status.expired' }),
				color: 'red'
			};
		}

		if (diff < 1000 * 60 * 60) {
			return {
				label: t({ locale: $localeStore, key: 'admin.resolution.status.urgent' }),
				color: 'orange'
			};
		}

		if (diff < 1000 * 60 * 60 * 24) {
			return {
				label: t({ locale: $localeStore, key: 'admin.resolution.status.today' }),
				color: 'orange-light'
			};
		}

		if (diff < 1000 * 60 * 60 * 24 * 7) {
			return {
				label: t({ locale: $localeStore, key: 'admin.resolution.status.this_week' }),
				color: 'amber'
			};
		}

		return {
			label: t({ locale: $localeStore, key: 'admin.resolution.status.pending' }),
			color: 'muted'
		};
	};

	const getStatusStyles = (color: string) => {
		switch (color) {
			case 'red':
				return 'bg-destructive/10 border-destructive/20 text-destructive';
			case 'orange':
				return 'bg-primary/10 border-primary/30 text-primary';
			case 'orange-light':
				return 'bg-primary/10 border-primary/25 text-primary';
			case 'amber':
				return 'bg-amber-50 border-amber-100 text-amber-700';
			default:
				return 'bg-foreground/5 border-border text-muted-foreground';
		}
	};

	const getBadgeStyles = (color: string) => {
		switch (color) {
			case 'red':
				return 'bg-destructive/20 text-destructive';
			case 'orange':
				return 'bg-primary/20 text-primary';
			case 'orange-light':
				return 'bg-primary/10 text-primary';
			case 'amber':
				return 'bg-amber-100 text-amber-800';
			default:
				return 'bg-foreground/8 text-foreground';
		}
	};
</script>

<div class="border-border bg-card rounded-3xl border p-8">
	<h2 class="text-foreground mb-6 text-2xl font-bold">
		{t({ locale: $localeStore, key: 'admin.resolution.title' })}
	</h2>

	{#if loading}
		<div class="flex justify-center py-12">
			<LoadingSpinner center={false} size="sm" />
		</div>
	{:else if sortedMarkets.length === 0}
		<p class="text-muted-foreground py-12 text-center text-sm italic">
			{t({ locale: $localeStore, key: 'admin.resolution.empty' })}
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
							<p class="font-mono text-[10px] opacity-60">
								{t({
									locale: $localeStore,
									key: 'admin.resolution.id_label',
									params: { marketId }
								})}
							</p>
						</div>

						<div class="text-[11px] font-semibold opacity-80">
							{t({
								locale: $localeStore,
								key: 'admin.resolution.expires',
								params: { date: new Date(Number(expiryDate)).toLocaleString() }
							})}
						</div>
					</div>

					<div class="flex gap-2">
						<Button
							class="border-success/20 bg-success/10 text-success hover:bg-success/15 flex-1 rounded-xl border py-2 text-xs font-bold"
							onclick={() => handleResolve({ marketId, outcome: 'YES' })}
							size="sm"
							status={resolvingMarketId === marketId ? 'pending' : 'enabled'}
							variant="ghost"
						>
							{t({ locale: $localeStore, key: 'admin.resolution.action.resolve_yes' })}
						</Button>
						<Button
							class="border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/15 flex-1 rounded-xl border py-2 text-xs font-bold"
							onclick={() => handleResolve({ marketId, outcome: 'NO' })}
							size="sm"
							status={resolvingMarketId === marketId ? 'pending' : 'enabled'}
							variant="ghost"
						>
							{t({ locale: $localeStore, key: 'admin.resolution.action.resolve_no' })}
						</Button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
