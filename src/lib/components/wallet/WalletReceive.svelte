<script lang="ts">
</script>

<div class="flex flex-col items-center space-y-6 text-center">
	<div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
		<div class="flex h-48 w-48 items-center justify-center rounded-lg bg-slate-100">
			<!-- Placeholder QR -->
			<span class="text-xs font-bold text-slate-400">QR CODE PLACEHOLDER</span>
		</div>
	</div>
	<div class="space-y-2">
		<p class="text-sm font-bold tracking-widest text-slate-500 uppercase">Your Principal ID</p>
		<div class="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2">
			<code class="font-mono text-indigo-600">current-user-principal-xxxx-xxxx</code>
			<button
				class="text-slate-400 transition-colors hover:text-slate-950"
				aria-label="Copy Principal ID"
				onclick={() => navigator.clipboard.writeText('current-user-principal-xxxx-xxxx')}
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
					/>
				</svg>
			</button>
		</div>
	</div>
</div>
