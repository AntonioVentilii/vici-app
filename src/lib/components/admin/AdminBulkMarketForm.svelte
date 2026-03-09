<script lang="ts">
	interface Props {
		onBulkCreate: (markets: { title: string; description: string; expiryDate: string }[]) => void;
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
			expiryDate: '2027-01-01T00:00:00Z'
		},
		{
			title: 'Will the first human land on Mars by 2030?',
			description:
				'Resolves to YES if a human successfully lands on Mars and returns or survives at least 24 hours.',
			expiryDate: '2030-12-31T23:59:59Z'
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

<div class="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
	<div class="mb-6 flex items-center justify-between">
		<h2 class="text-2xl font-bold text-slate-950">Bulk Create Markets</h2>
		<span
			class="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-bold text-indigo-600 uppercase"
		>
			JSON Upload
		</span>
	</div>

	<div class="space-y-6">
		<!-- Drop Zone -->
		<div
			class="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 transition-all {dragging
				? 'border-indigo-500 bg-indigo-50'
				: 'border-slate-200 bg-slate-50 hover:bg-slate-100'}"
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
					<svg
						class="h-6 w-6 text-indigo-600"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
						/>
					</svg>
				</div>
				<p class="text-sm font-semibold text-slate-900">Click to upload or drag and drop</p>
				<p class="mt-1 text-xs text-slate-500">JSON file containing an array of markets</p>
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
				class="text-xs font-bold tracking-widest text-slate-500 uppercase"
				for="bulk-market-upload"
			>
				Required JSON Format
			</label>
			<div class="overflow-hidden rounded-2xl bg-slate-900 p-4">
				<pre class="overflow-x-auto font-mono text-[10px] text-indigo-300"><code
						>{JSON.stringify(exampleJson, null, 2)}</code
					></pre>
			</div>
			<button
				class="flex items-center gap-2 text-xs font-bold text-indigo-600 transition-colors hover:text-indigo-700"
				onclick={() => {
					const blob = new Blob([JSON.stringify(exampleJson, null, 2)], {
						type: 'application/json'
					});
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = 'markets_template.json';
					a.click();
					URL.revokeObjectURL(url);
				}}
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
