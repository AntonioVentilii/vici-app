<script lang="ts">
	interface Props {
		title: string;
		description: string;
		expiryDate: string;
		onTitleChange: (v: string) => void;
		onDescriptionChange: (v: string) => void;
		onExpiryChange: (v: string) => void;
		onCreate: () => void;
	}

	const {
		title,
		description,
		expiryDate,
		onTitleChange,
		onDescriptionChange,
		onExpiryChange,
		onCreate
	}: Props = $props();
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
				oninput={(e) => onTitleChange(e.currentTarget.value)}
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
				oninput={(e) => onDescriptionChange(e.currentTarget.value)}
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
				oninput={(e) => onExpiryChange(e.currentTarget.value)}
				type="datetime-local"
				value={expiryDate}
			/>
		</div>

		<button
			class="w-full rounded-2xl bg-indigo-600 py-4 text-sm font-black text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-700 active:scale-[0.98]"
			onclick={onCreate}
		>
			Deploy Market
		</button>
	</div>
</div>
