<script lang="ts">
	import { Copy, Check } from 'lucide-svelte/icons';
	import { fade } from 'svelte/transition';
	import YouBadge from '$lib/components/ui/YouBadge.svelte';
	import { authPrincipal } from '$lib/derived/user.derived';
	import { copyToClipboard } from '$lib/utils/clipboard.utils';
	import { shortenWithMiddleEllipsis } from '$lib/utils/format.utils';

	interface Props {
		address: string;
		splitLength?: number;
		label?: string;
		showSelfIndicator?: boolean;
	}

	const { address, splitLength = 7, label = 'Address', showSelfIndicator = true }: Props = $props();

	let copied = $state(false);

	const displayAddress = $derived(shortenWithMiddleEllipsis({ text: address, splitLength }));
	const isSelf = $derived(showSelfIndicator && !!$authPrincipal && address === $authPrincipal);

	const handleCopy = async () => {
		await copyToClipboard({ value: address, text: label });
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 2000);
	};
</script>

<span class="inline-flex items-center gap-1.5">
	<span class="font-mono text-inherit">{displayAddress}</span>
	<button
		class="text-muted-foreground hover:text-foreground relative inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded transition-colors"
		aria-label="Copy {label}"
		onclick={handleCopy}
	>
		{#if copied}
			<span class="absolute inset-0 flex items-center justify-center" in:fade={{ duration: 150 }}>
				<Check class="h-3.5 w-3.5 text-[var(--yes)]" />
			</span>
		{:else}
			<span class="absolute inset-0 flex items-center justify-center" in:fade={{ duration: 150 }}>
				<Copy class="h-3.5 w-3.5" />
			</span>
		{/if}
	</button>
	{#if isSelf}
		<YouBadge />
	{/if}
</span>
