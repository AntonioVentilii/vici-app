<script lang="ts">
	import BaseButton from '$lib/components/ui/BaseButton.svelte';

	interface Props {
		tabs: string[];
		activeTab: string;
		onTabChange?: (tab: string) => void;
	}

	let { tabs, activeTab = $bindable(), onTabChange }: Props = $props();

	const handleTabClick = (tab: string) => {
		activeTab = tab;
		onTabChange?.(tab);
	};
</script>

<div class="border-border flex w-full border-b">
	{#each tabs as tab (tab)}
		<BaseButton
			class="flex-1 py-4 text-sm font-bold {activeTab === tab
				? 'border-primary bg-primary/5 text-primary border-b-2'
				: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}"
			onclick={() => handleTabClick(tab)}
		>
			{tab}
		</BaseButton>
	{/each}
</div>
