<script lang="ts">
	import { isNullish } from '@dfinity/utils';
	import Button from '$lib/components/ui/Button.svelte';
	import { createMarket } from '$lib/services/market.services';
	import type { ButtonStatus } from '$lib/types/components';

	interface Props {
		onAddMarketSuccess: () => Promise<void>;
	}

	const { onAddMarketSuccess }: Props = $props();

	let status = $state<ButtonStatus>('enabled');

	let title = $state('');
	let description = $state('');
	let expiryDate = $state('');

	const onCreate = async () => {
		if (isNullish(title) || isNullish(description) || isNullish(expiryDate)) {
			return;
		}

		status = 'pending';

		try {
			await createMarket({
				title,
				description,
				expiryDate: BigInt(new Date(expiryDate).getTime())
			});

			title = '';
			description = '';
			expiryDate = '';

			await onAddMarketSuccess();

			alert('Market created successfully!');
		} catch (e: unknown) {
			alert((e as Error).message);
		} finally {
			status = 'enabled';
		}
	};
</script>

<div class="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
	<h2 class="mb-6 text-2xl font-bold text-slate-950">Create New Market</h2>
	<div class="space-y-6">
		<div class="space-y-2">
			<label class="text-xs font-bold tracking-widest text-slate-500 uppercase" for="market-title">
				Market Title
			</label>
			<input
				id="market-title"
				class="w-full rounded-2xl border-none bg-slate-50 px-6 py-4 text-slate-950 ring-1 ring-slate-200 ring-inset focus:ring-2 focus:ring-indigo-600"
				oninput={(e) => (title = e.currentTarget.value)}
				placeholder="e.g., Will Bitcoin hit $100k by 2027?"
				type="text"
				value={title}
			/>
		</div>

		<div class="space-y-2">
			<label
				class="text-xs font-bold tracking-widest text-slate-500 uppercase"
				for="market-description"
			>
				Description
			</label>
			<textarea
				id="market-description"
				class="w-full rounded-2xl border-none bg-slate-50 px-6 py-4 text-slate-950 ring-1 ring-slate-200 ring-inset focus:ring-2 focus:ring-indigo-600"
				oninput={(e) => (description = e.currentTarget.value)}
				placeholder="Provide detailed criteria for resolution..."
				rows="4"
				value={description}
			></textarea>
		</div>

		<div class="space-y-2">
			<label class="text-xs font-bold tracking-widest text-slate-500 uppercase" for="expiry-date"
				>Expiry Date</label
			>
			<input
				id="expiry-date"
				class="w-full rounded-2xl border-none bg-slate-50 px-6 py-4 text-slate-950 ring-1 ring-slate-200 ring-inset focus:ring-2 focus:ring-indigo-600"
				oninput={(e) => (expiryDate = e.currentTarget.value)}
				type="datetime-local"
				value={expiryDate}
			/>
		</div>

		<Button class="w-full" onclick={onCreate} size="lg" {status}>Deploy Market</Button>
	</div>
</div>
