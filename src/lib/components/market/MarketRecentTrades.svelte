<script lang="ts">
	import { onMount } from 'svelte';
	import YouBadge from '$lib/components/ui/YouBadge.svelte';
	import { authPrincipal } from '$lib/derived/user.derived';
	import { getGlobalActivities } from '$lib/services/activity.services';
	import { getProfile } from '$lib/services/profile.services';
	import type { UserProfile } from '$lib/types/profile';
	import type { Activity } from '$lib/types/social';
	import { shortenWithMiddleEllipsis } from '$lib/utils/format.utils';

	interface Props {
		marketId: string;
		isEmbedded?: boolean;
	}

	const { marketId, isEmbedded = false }: Props = $props();

	let activities = $state<Activity[]>([]);
	const profiles = $state<Map<string, UserProfile>>(new Map());

	onMount(async () => {
		const all = await getGlobalActivities({ limit: 20 });
		activities = all.filter((a) => a.marketId === marketId);

		const uniquePrincipals = Array.from(new Set(activities.map((a) => a.user)));
		const fetched = await Promise.all(
			uniquePrincipals.map(async (principal) => [principal, await getProfile(principal)] as const)
		);

		for (const [principal, doc] of fetched) {
			if (doc) {
				profiles.set(principal, doc.data);
			}
		}
	});

	const displayNameFor = (principal: string): string => {
		const nickname = profiles.get(principal)?.nickname;

		return nickname && nickname.length > 0
			? nickname
			: shortenWithMiddleEllipsis({ text: principal });
	};
</script>

<div
	class={isEmbedded ? 'space-y-4 pt-4' : 'border-border bg-card space-y-4 rounded-3xl border p-6'}
>
	{#if !isEmbedded}
		<h3 class="text-muted-foreground text-xs font-black tracking-widest uppercase">
			Recent Activity
		</h3>
	{/if}

	<div class="space-y-4">
		{#if activities.length === 0}
			<p class="text-muted-foreground py-4 text-center text-xs">No recent activity</p>
		{:else}
			{#each activities as activity (activity.timestamp + activity.user)}
				<div class="flex items-start gap-3">
					<div
						class="bg-foreground/5 flex h-8 w-8 items-center justify-center rounded-full text-xs"
					>
						👤
					</div>
					<div class="min-w-0 flex-1">
						<div class="flex items-center justify-between gap-2">
							<span
								class="text-foreground inline-flex min-w-0 items-center gap-1.5 text-xs font-bold"
							>
								<span class="truncate">{displayNameFor(activity.user)}</span>
								{#if $authPrincipal && activity.user === $authPrincipal}
									<YouBadge />
								{/if}
							</span>
							<span class="text-muted-foreground text-[10px] font-medium">
								{new Date(activity.timestamp).toLocaleTimeString([], {
									hour: '2-digit',
									minute: '2-digit'
								})}
							</span>
						</div>
						<p class="text-muted-foreground mt-0.5 text-[10px] leading-tight">
							{activity.details ?? `predicted on ${activity.title}`}
						</p>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>
