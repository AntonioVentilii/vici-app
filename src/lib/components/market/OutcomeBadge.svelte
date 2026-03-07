<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import type { Outcome } from '$lib/types/market';
	import { getOutcomeVariant } from '$lib/utils/market.utils';

	interface Props {
		outcome?: Outcome | string;
		status?: string;
	}

	const { outcome, status }: Props = $props();

	const label = $derived(outcome ?? status ?? 'Unknown');

	const variant = $derived(getOutcomeVariant(label));
</script>

<Badge {variant}>
	{label}
</Badge>
