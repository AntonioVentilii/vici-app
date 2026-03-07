<script lang="ts">
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
		<button
			class="flex-1 py-4 text-sm font-bold transition-all {activeTab === tab
				? 'border-primary bg-primary/5 text-primary border-b-2'
				: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}"
			onclick={() => handleTabClick(tab)}
		>
			{tab}
		</button>
	{/each}
</div>
