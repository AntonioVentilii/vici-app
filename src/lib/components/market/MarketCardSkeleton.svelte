<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
</script>

<Card padding="lg" variant="default">
	<div class="flex h-full w-full flex-col gap-4">
		<!-- Title and Badge -->
		<div class="flex items-start justify-between gap-4">
			<div class="h-6 w-3/4 animate-pulse rounded-lg bg-slate-200"></div>
			<div class="h-5 w-16 animate-pulse rounded-full bg-slate-100"></div>
		</div>

		<!-- Description -->
		<div class="space-y-2">
			<div class="h-4 w-full animate-pulse rounded-md bg-slate-100"></div>
			<div class="h-4 w-5/6 animate-pulse rounded-md bg-slate-100"></div>
		</div>

		<!-- Probabilities Area -->
		<div class="mt-2 grid grid-cols-2 gap-4">
			<div class="h-16 animate-pulse rounded-xl bg-slate-50"></div>
			<div class="h-16 animate-pulse rounded-xl bg-slate-50"></div>
		</div>

		<!-- Footer Stats -->
		<div class="mt-auto border-t border-slate-100 pt-3">
			<div class="flex items-center gap-2">
				<div class="h-3 w-3 animate-pulse rounded-full bg-slate-100"></div>
				<div class="h-3 w-20 animate-pulse rounded-md bg-slate-100"></div>
			</div>
		</div>
	</div>
</Card>

<style lang="postcss">
	/* Custom shimmer effect if needed, but animate-pulse is standard */
	.animate-pulse {
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
</style>
