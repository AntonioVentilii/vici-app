<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import { listCategories, associateSeriesWithCategory } from '$lib/services/category.services';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Category } from '$lib/types/category';
	import { shortenWithMiddleEllipsis } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		seriesId: string;
		adminPrincipal: string;
	}

	const { seriesId, adminPrincipal }: Props = $props();

	let categories = $state<Category[]>([]);

	let loading = $state(true);

	let saving = $state(false);

	let selectedCategoryId = $state('');

	onMount(async () => {
		categories = await listCategories();
		loading = false;
	});

	const handleAssociate = async () => {
		if (!selectedCategoryId) {
			return;
		}

		saving = true;

		try {
			await associateSeriesWithCategory({
				seriesId,
				categoryId: selectedCategoryId,
				adminPrincipal
			});
		} finally {
			saving = false;
		}
	};
</script>

<Card padding="lg" variant="outline">
	<div class="flex flex-col gap-4">
		<div>
			<h4 class="text-lg font-bold">
				{t({ locale: $localeStore, key: 'admin.category.title' })}
			</h4>
			<p class="text-muted-foreground text-xs tracking-wider uppercase">
				{t({
					locale: $localeStore,
					key: 'admin.category.series_id',
					params: { id: shortenWithMiddleEllipsis({ text: seriesId }) }
				})}
			</p>
		</div>

		{#if loading}
			<LoadingSpinner />
		{:else if categories.length === 0}
			<p class="py-4 text-center text-sm italic opacity-50">
				{t({ locale: $localeStore, key: 'admin.category.empty' })}
			</p>
		{:else}
			<div class="grid grid-cols-2 gap-2">
				{#each categories as cat (cat.id)}
					<button
						class="flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all {selectedCategoryId ===
						cat.id
							? 'border-primary bg-primary/10 ring-primary/20 ring-2'
							: 'border-border bg-background hover:border-primary/50'}"
						onclick={() => (selectedCategoryId = cat.id)}
					>
						<span class="text-xs font-bold tracking-widest uppercase">{cat.name}</span>
						{#if cat.description}
							<span class="text-muted-foreground line-clamp-2 text-[10px] leading-tight">
								{cat.description}
							</span>
						{/if}
					</button>
				{/each}
			</div>

			<Button
				onclick={handleAssociate}
				status={saving ? 'pending' : !selectedCategoryId ? 'disabled' : 'enabled'}
			>
				{#snippet busyLabel()}{t({
						locale: $localeStore,
						key: 'admin.category.action.associating'
					})}{/snippet}
				{t({ locale: $localeStore, key: 'admin.category.action.set' })}
			</Button>
		{/if}
	</div>
</Card>
