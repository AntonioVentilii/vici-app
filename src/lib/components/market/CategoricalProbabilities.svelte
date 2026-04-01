<script lang="ts">
	import type { Market } from '$lib/types/market';
	import { formatProbability } from '$lib/utils/format.utils';

	interface Props {
		outcomes: NonNullable<Market['outcomes']>;
	}

	const { outcomes }: Props = $props();
</script>

<div class="border-border bg-muted/30 col-span-2 flex flex-col gap-3 rounded-2xl border p-5">
	<div class="flex items-center justify-between">
		<div class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
			Top Outcomes
		</div>
		<div class="text-primary text-[10px] font-bold tracking-widest uppercase">
			{outcomes.length} total
		</div>
	</div>

	<div class="flex flex-col gap-3">
		{#each outcomes
			.toSorted(// eslint-disable-next-line local-rules/prefer-object-params
				(a, b) => {
					const probA = a.probability ?? 0;
					const probB = b.probability ?? 0;

					return probB - probA || a.title.localeCompare(b.title);
				})
			.slice(0, 2) as outcome (outcome.id)}
			<div class="flex flex-col gap-1.5">
				<div class="flex items-center justify-between text-xs">
					<span class="text-foreground font-bold">{outcome.title}</span>
					<span class="text-foreground font-serif font-black">
						{formatProbability(outcome.probability ?? 0)}
					</span>
				</div>
				<div
					class="bg-background ring-border h-1.5 w-full overflow-hidden rounded-full ring-1 ring-inset"
				>
					<div
						style="width: {(outcome.probability ?? 0) * 100}%"
						class="bg-primary h-full transition-all duration-700 ease-out"
					></div>
				</div>
			</div>
		{/each}
		{#if outcomes.length > 2}
			<div class="flex items-center justify-center pt-1">
				<span class="text-primary text-[10px] font-black tracking-widest uppercase">
					+ {outcomes.length - 2} Other...
				</span>
			</div>
		{/if}
	</div>
</div>
