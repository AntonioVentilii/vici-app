<script lang="ts">
	import { downloadJsonFile } from '$lib/utils/download.utils';

	interface Props {
		onBulkCreate: (
			markets: {
				title: string;
				description: string;
				expiryDate: string;
				balanceDomain?: string;
				outcomes?: string[];
				categories?: string[];
			}[]
		) => void;
	}

	const { onBulkCreate }: Props = $props();

	let fileInput: HTMLInputElement;
	let error = $state<string | null>(null);
	let dragging = $state(false);

	const exampleJson = [
		{
			title: 'Will Bitcoin hit $100k by 2027?',
			description:
				'This market resolves to YES if the Bitcoin price reaches $100,000 USD on any major exchange before Jan 1, 2027.',
			expiryDate: '2027-01-01T00:00:00Z',
			balanceDomain: 'ViciXp',
			categories: ['Finance', 'Crypto']
		},
		{
			title: 'Who will win the 2026 FIFA World Cup?',
			description: 'Prediction on the champion of the 2026 FIFA World Cup.',
			expiryDate: '2026-07-20T21:59:59.000Z',
			balanceDomain: 'ViciXp',
			outcomes: ['Italy', 'Brazil', 'France', 'Argentina', 'England', 'Spain', 'Germany', 'Other'],
			categories: ['Sports', 'Football']
		}
	];

	const processFile = async (file: File) => {
		error = null;

		if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
			error = 'Please upload a JSON file.';

			return;
		}

		try {
			const text = await file.text();
			const data = JSON.parse(text);

			if (!Array.isArray(data)) {
				error = 'JSON must be an array of market objects.';

				return;
			}

			// Basic validation
			for (const item of data) {
				if (!item.title || !item.description || !item.expiryDate) {
					error = 'Each market must have a title, description, and expiryDate.';

					return;
				}

				if (isNaN(Date.parse(item.expiryDate))) {
					error = `Invalid date format: ${item.expiryDate}`;

					return;
				}

				if (item.outcomes) {
					if (!Array.isArray(item.outcomes)) {
						error = `Outcomes must be an array for market: ${item.title}`;

						return;
					}

					if (item.outcomes.some((o: unknown) => typeof o !== 'string')) {
						error = `Each outcome must be a string for market: ${item.title}`;

						return;
					}

					if (item.outcomes.length < 2) {
						error = `Categorical markets must have at least 2 outcomes: ${item.title}`;

						return;
					}
				}

				if (item.categories) {
					if (!Array.isArray(item.categories)) {
						error = `Categories must be an array for market: ${item.title}`;

						return;
					}

					if (item.categories.some((c: unknown) => typeof c !== 'string')) {
						error = `Each category must be a string for market: ${item.title}`;

						return;
					}
				}
			}

			onBulkCreate(data);

			if (fileInput) {
				fileInput.value = '';
			}
		} catch (e: unknown) {
			error = `Failed to parse JSON: ${(e as Error).message}`;
		}
	};

	const handleFileChange = (e: Event) => {
		const target = e.target as HTMLInputElement;

		if (target.files && target.files[0]) {
			processFile(target.files[0]);
		}
	};

	const handleDrop = (e: DragEvent) => {
		e.preventDefault();
		dragging = false;

		if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
			processFile(e.dataTransfer.files[0]);
		}
	};
</script>

<div class="border-border bg-card rounded-3xl border p-8">
	<div class="mb-6 flex items-center justify-between">
		<h2 class="text-foreground text-2xl font-bold">Bulk Create Markets</h2>
		<span class="bg-primary/10 text-primary rounded-full px-3 py-1 text-[10px] font-bold uppercase">
			JSON Upload
		</span>
	</div>

	<div class="space-y-6">
		<!-- Drop Zone -->
		<div
			class="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 transition-all {dragging
				? 'border-primary bg-primary/10'
				: 'border-border bg-foreground/5 hover:bg-foreground/8'}"
			aria-label="Upload markets JSON"
			ondragleave={() => (dragging = false)}
			ondragover={(e) => {
				e.preventDefault();
				dragging = true;
			}}
			ondrop={handleDrop}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					fileInput.click();
				}
			}}
			role="button"
			tabindex="0"
		>
			<input
				bind:this={fileInput}
				id="bulk-market-upload"
				class="absolute inset-0 cursor-pointer opacity-0"
				onchange={handleFileChange}
				type="file"
			/>
			<div class="text-center">
				<div
					class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm"
				>
					<svg class="text-primary h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
						/>
					</svg>
				</div>
				<p class="text-foreground text-sm font-semibold">Click to upload or drag and drop</p>
				<p class="text-muted-foreground mt-1 text-xs">JSON file containing an array of markets</p>
			</div>
		</div>

		{#if error}
			<div class="rounded-xl border border-red-100 bg-red-50 p-4 text-xs font-medium text-red-600">
				{error}
			</div>
		{/if}

		<!-- Example Section -->
		<div class="space-y-3">
			<label
				class="text-muted-foreground text-xs font-bold tracking-widest uppercase"
				for="bulk-market-upload"
			>
				Required JSON Format
			</label>
			<div class="bg-background overflow-hidden rounded-2xl p-4">
				<pre class="text-primary overflow-x-auto font-mono text-[10px]"><code>
						{JSON.stringify(exampleJson, null, 2)}
					</code></pre>
			</div>
			<button
				class="text-primary hover:text-primary flex items-center gap-2 text-xs font-bold transition-colors"
				onclick={() => downloadJsonFile({ data: exampleJson, filename: 'markets_template.json' })}
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
					/>
				</svg>
				Download Template
			</button>
		</div>
	</div>
</div>
