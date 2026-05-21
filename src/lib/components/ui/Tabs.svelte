<script lang="ts">
	import BaseButton from '$lib/components/ui/BaseButton.svelte';

	interface TabOption {
		value: string;
		label: string;
	}

	interface Props {
		tabs: Array<string | TabOption>;
		activeTab: string;
		onTabChange?: (tab: string) => void;
	}

	let { tabs, activeTab = $bindable(), onTabChange }: Props = $props();

	const tabOptions = $derived(
		tabs.map((tab) => (typeof tab === 'string' ? { value: tab, label: tab } : tab))
	);

	const handleTabClick = (value: string) => {
		activeTab = value;
		onTabChange?.(value);
	};
</script>

<div class="border-border flex w-full border-b">
	{#each tabOptions as tab (tab.value)}
		<BaseButton
			class="ease-vici duration-hover flex-1 py-4 text-sm font-bold transition-colors {activeTab ===
			tab.value
				? 'text-foreground border-primary border-b-2'
				: 'text-muted-foreground hover:text-foreground'}"
			onclick={() => handleTabClick(tab.value)}
		>
			{tab.label}
		</BaseButton>
	{/each}
</div>
