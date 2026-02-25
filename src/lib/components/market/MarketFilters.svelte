<script lang="ts">
	interface Props {
		tabs: string[];
		activeTab: string;
		searchTerm: string;
		onTabChange: (tab: string) => void;
		onSearchChange: (term: string) => void;
	}

	const { tabs, activeTab, searchTerm, onTabChange, onSearchChange }: Props = $props();
</script>

<div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
	<div class="flex flex-wrap gap-2">
		{#each tabs as tab (tab)}
			<button
				class="rounded-xl px-5 py-2.5 text-sm font-bold transition-all {activeTab === tab
					? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
					: 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}"
				onclick={() => onTabChange(tab)}
			>
				{tab}
			</button>
		{/each}
	</div>

	<div class="relative w-full lg:max-w-sm">
		<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
			<svg class="h-5 w-5 text-gray-500" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20">
				<path
					clip-rule="evenodd"
					d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
					fill-rule="evenodd"
				/>
			</svg>
		</div>
		<input
			class="block w-full rounded-xl border-none bg-white/5 py-3 pr-4 pl-10 text-sm text-white placeholder-gray-500 ring-1 ring-white/10 transition-all ring-inset focus:bg-white/10 focus:ring-2 focus:ring-indigo-500"
			oninput={(e) => onSearchChange(e.currentTarget.value)}
			placeholder="Search markets..."
			type="text"
			value={searchTerm}
		/>
	</div>
</div>
