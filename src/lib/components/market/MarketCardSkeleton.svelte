<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import { TestId } from '$lib/constants/test-ids.constants';
</script>

<Card
	class="bg-card/60 !border-dashed"
	data-tid={TestId.MarketCardSkeleton}
	padding="sm"
	variant="default"
>
	<div class="flex h-full w-full flex-col gap-3">
		<div class="flex items-start justify-between gap-4">
			<Skeleton class="h-5 w-28 rounded-full" />
			<Skeleton class="h-4 w-20 rounded-md" />
		</div>

		<div class="space-y-2">
			<Skeleton class="h-5 w-4/5 rounded-md" />
			<Skeleton class="h-3.5 w-full rounded-md" tone="soft" />
			<Skeleton class="h-3.5 w-2/3 rounded-md" tone="soft" />
		</div>

		<div class="mt-1 grid grid-cols-2 gap-2.5">
			<Skeleton class="h-14 rounded-xl" tone="soft" />
			<Skeleton class="h-14 rounded-xl" tone="soft" />
		</div>

		<div class="border-border mt-auto flex justify-end border-t pt-3">
			<Skeleton class="h-5 w-16 rounded-md" tone="soft" />
		</div>
	</div>
</Card>
