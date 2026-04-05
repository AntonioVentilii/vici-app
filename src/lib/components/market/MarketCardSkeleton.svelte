<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
</script>

<Card class="bg-muted/20 animate-pulse !border-dashed" padding="lg" variant="default">
	<div class="flex h-full w-full flex-col gap-4">
		<!-- Title and Badge -->
		<div class="flex items-start justify-between gap-4">
			<div class="bg-muted-foreground/20 h-6 w-3/4 rounded-lg"></div>
			<div class="bg-muted-foreground/20 h-5 w-16 rounded-full"></div>
		</div>

		<!-- Description -->
		<div class="space-y-2">
			<div class="bg-muted-foreground/10 h-4 w-full rounded-md"></div>
			<div class="bg-muted-foreground/10 h-4 w-5/6 rounded-md"></div>
		</div>

		<!-- Probabilities Area -->
		<div class="mt-2 grid grid-cols-2 gap-4">
			<div class="bg-muted-foreground/10 h-16 rounded-xl"></div>
			<div class="bg-muted-foreground/10 h-16 rounded-xl"></div>
		</div>

		<!-- Footer Stats -->
		<div class="border-border mt-auto border-t pt-3">
			<div class="flex items-center gap-2">
				<div class="bg-muted-foreground/10 h-3 w-3 rounded-full"></div>
				<div class="bg-muted-foreground/10 h-3 w-20 rounded-md"></div>
			</div>
		</div>
	</div>
</Card>
