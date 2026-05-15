<script lang="ts">
	import { Target, Flame, Eye, Zap, Timer, Star } from 'lucide-svelte';
	import type { AchievementDef } from '$lib/constants/achievements.constants';

	interface Props {
		achievement: AchievementDef;
		unlocked?: boolean;
		progress?: number;
	}

	let { achievement, unlocked = false, progress = 0 }: Props = $props();

	const icons = { target: Target, flame: Flame, eye: Eye, zap: Zap, timer: Timer, star: Star };
	const Icon = $derived(icons[achievement.icon]);

	const progressPercent = $derived(Math.min(Math.round(progress * 100), 100));
</script>

<div
	class="border-border flex items-start gap-3.5 rounded-xl border p-4 transition-all {unlocked
		? 'bg-card'
		: 'bg-card/50 opacity-60'}"
>
	<div
		class="flex h-10 w-10 flex-none items-center justify-center rounded-lg {unlocked
			? 'bg-primary/15 text-primary'
			: 'bg-foreground/5 text-muted-foreground'}"
	>
		<Icon size={20} strokeWidth={1.8} />
	</div>

	<div class="min-w-0 flex-1">
		<div class="flex items-center justify-between gap-2">
			<span class="text-foreground text-sm font-semibold">{achievement.name}</span>
			<span class="text-primary font-mono text-xs font-bold tabular-nums">
				+{achievement.xp} XP
			</span>
		</div>
		<p class="text-muted-foreground mt-0.5 text-xs">{achievement.description}</p>

		{#if !unlocked && progress > 0}
			<div class="mt-2.5 flex items-center gap-2">
				<div class="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-surface)]">
					<div
						style="width: {progressPercent}%"
						class="bg-primary h-full rounded-full transition-all duration-500"
					></div>
				</div>
				<span class="text-muted-foreground font-mono text-[10px] tabular-nums">
					{progressPercent}%
				</span>
			</div>
		{/if}
	</div>
</div>
