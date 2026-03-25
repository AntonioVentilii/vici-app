<script lang="ts">
	import { Copy, Check } from 'lucide-svelte/icons';
	import { fade } from 'svelte/transition';
	import { copyToClipboard } from '$lib/utils/clipboard.utils';
	import { shortenWithMiddleEllipsis } from '$lib/utils/format.utils';

	interface Props {
		address: string;
		splitLength?: number;
		label?: string;
	}

	const { address, splitLength = 7, label = 'Address' }: Props = $props();

	let copied = $state(false);

	const displayAddress = $derived(shortenWithMiddleEllipsis({ text: address, splitLength }));

	const handleCopy = async () => {
		await copyToClipboard({ value: address, text: label });
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 2000);
	};
</script>

<span class="inline-flex items-center gap-1">
	<span class="font-mono text-inherit">{displayAddress}</span>
	<button
		class="relative inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 transition-colors hover:text-slate-700"
		aria-label="Copy {label}"
		onclick={handleCopy}
	>
		{#if copied}
			<span class="absolute inset-0 flex items-center justify-center" in:fade={{ duration: 150 }}>
				<Check class="h-3.5 w-3.5 text-emerald-500" />
			</span>
		{:else}
			<span class="absolute inset-0 flex items-center justify-center" in:fade={{ duration: 150 }}>
				<Copy class="h-3.5 w-3.5" />
			</span>
		{/if}
	</button>
</span>
