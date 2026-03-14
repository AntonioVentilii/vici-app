<script lang="ts">
	import { onMount } from 'svelte';
	import { getGlobalActivities } from '$lib/services/activity.services';
	import type { Activity } from '$lib/types/social';

	interface Props {
		marketId: string;
		isEmbedded?: boolean;
	}

	const { marketId, isEmbedded = false }: Props = $props();

	let activities = $state<Activity[]>([]);

	onMount(async () => {
		const all = await getGlobalActivities(20);
		activities = all.filter((a) => a.marketId === marketId);
	});
</script>

<div
	class={isEmbedded
		? 'space-y-4 pt-4'
		: 'space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm'}
>
	{#if !isEmbedded}
		<h3 class="text-xs font-black tracking-widest text-slate-400 uppercase">Recent Activity</h3>
	{/if}

	<div class="space-y-4">
		{#if activities.length === 0}
			<p class="py-4 text-center text-xs text-slate-400">No recent activity</p>
		{:else}
			{#each activities as activity (activity.timestamp + activity.user)}
				<div class="flex items-start gap-3">
					<div class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs">
						👤
					</div>
					<div class="min-w-0 flex-1">
						<div class="flex items-center justify-between gap-2">
							<span class="truncate text-xs font-bold text-slate-900">
								{activity.user.substring(0, 8)}...{activity.user.substring(
									activity.user.length - 3
								)}
							</span>
							<span class="text-[10px] font-medium text-slate-400">
								{new Date(activity.timestamp).toLocaleTimeString([], {
									hour: '2-digit',
									minute: '2-digit'
								})}
							</span>
						</div>
						<p class="mt-0.5 text-[10px] leading-tight text-slate-500">
							{activity.details ?? `predicted on ${activity.title}`}
						</p>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>
