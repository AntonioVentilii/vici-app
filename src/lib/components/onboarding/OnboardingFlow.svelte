<script lang="ts">
	import { ChartLine, Bitcoin, Users, Cpu, Trophy, Sparkles, Check } from 'lucide-svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import ViciChar from '$lib/components/characters/ViciChar.svelte';
	import { ARCHETYPES } from '$lib/constants/archetypes.constants';
	import { TestId } from '$lib/constants/test-ids.constants';
	import { categoryColor } from '$lib/utils/category-color.utils';

	interface Props {
		onComplete: (result: { handle: string; archetype: string; interests: string[] }) => void;
	}

	let { onComplete }: Props = $props();

	let step = $state(0);
	const interests = new SvelteSet<string>();
	let archetype = $state('');
	let handle = $state('');

	const next = () => {
		step += 1;
	};

	const INTEREST_CATS = [
		{ id: 'macro', label: 'Macro', Icon: ChartLine },
		{ id: 'crypto', label: 'Crypto', Icon: Bitcoin },
		{ id: 'politics', label: 'Politics', Icon: Users },
		{ id: 'tech', label: 'Tech', Icon: Cpu },
		{ id: 'sports', label: 'Sports', Icon: Trophy },
		{ id: 'culture', label: 'Culture', Icon: Sparkles }
	];

	const toggleInterest = (id: string) => {
		if (interests.has(id)) {
			interests.delete(id);
		} else {
			interests.add(id);
		}
	};

	const sanitizeHandle = (raw: string): string =>
		raw
			.toLowerCase()
			.replace(/[^a-z0-9_.]/g, '')
			.slice(0, 16);

	const progressWidth = $derived(`${((step + 1) / 5) * 100}%`);
</script>

<div class="bg-background fixed inset-0 z-50 flex flex-col" data-tid={TestId.OnboardingFlow}>
	<!-- Progress bar -->
	<div class="px-6 pt-5">
		<div class="mb-1.5 flex items-center justify-between">
			<span class="text-primary font-display text-sm font-bold tracking-[0.18em] uppercase">
				VICI
			</span>
			<span class="text-muted-foreground font-mono text-[11px] tabular-nums">
				Step {step + 1} of 5
			</span>
		</div>
		<div class="h-[3px] overflow-hidden rounded-full bg-[rgba(242,236,220,0.08)]">
			<div
				style="width: {progressWidth}; transition-timing-function: var(--ease-vici)"
				class="bg-primary h-full transition-all duration-[320ms]"
			></div>
		</div>
	</div>

	<!-- Step content -->
	<div class="flex-1 overflow-auto px-6 pt-10 pb-6">
		{#if step === 0}
			<!-- Welcome -->
			<div class="space-y-4">
				<div class="mb-6">
					<ViciChar mood="happy" size={64} />
				</div>
				<div class="serif-italic text-primary text-lg">Veni.</div>
				<h1
					style="letter-spacing: -0.03em"
					class="font-display text-foreground text-[38px] leading-[1.05] font-semibold"
				>
					Predict at the speed of thought.
				</h1>
				<p class="text-muted-foreground text-[15px] leading-relaxed">
					Real markets. Real signals. Make calls in seconds, build a track record over time.
				</p>
				<div class="border-border bg-card shadow-inset-hi mt-6 rounded-2xl border p-[18px]">
					<div class="flex items-center justify-between">
						<span class="text-hold text-[10px] font-bold tracking-widest uppercase"> MACRO </span>
						<span class="text-muted-foreground font-mono text-[11px] tabular-nums">2.4M vol</span>
					</div>
					<div class="text-foreground mt-3 text-[15px] leading-snug font-semibold">
						Will the Fed cut rates in June?
					</div>
					<div class="mt-3 flex items-center justify-between">
						<span class="text-yes font-mono font-semibold tabular-nums">64%</span>
						<span class="text-no font-mono font-semibold tabular-nums">36%</span>
					</div>
					<div class="probbar mt-1.5"><i style="width: 64%"></i></div>
				</div>
			</div>
		{:else if step === 1}
			<!-- Swipe tutorial -->
			<div class="space-y-3.5">
				<div class="eyebrow">SWIPE TO PREDICT</div>
				<h2
					style="letter-spacing: -0.025em"
					class="font-display text-foreground text-[30px] font-semibold"
				>
					Right for <span class="text-yes">YES</span>. Left for
					<span class="text-no">NO</span>.
				</h2>
				<p class="text-muted-foreground text-sm">
					Each swipe earns XP. Accuracy compounds into rank, reputation, and rewards.
				</p>
			</div>
		{:else if step === 2}
			<!-- Interest selection -->
			<div class="space-y-4">
				<div>
					<div class="eyebrow">PICK YOUR INTERESTS</div>
					<h2
						style="letter-spacing: -0.025em"
						class="font-display text-foreground mt-2 text-[28px] font-semibold"
					>
						What do you want to predict?
					</h2>
					<p class="text-muted-foreground mt-2 text-sm">
						Pick 3 or more. We'll seed your Flow with the markets that matter.
					</p>
				</div>
				<div class="mt-2 grid grid-cols-2 gap-2.5">
					{#each INTEREST_CATS as { id, label, Icon } (id)}
						{@const selected = interests.has(id)}
						{@const color = categoryColor(id)}
						<button
							style={selected ? `border-color: ${color}40; background: ${color}0D` : undefined}
							class="flex flex-col items-start rounded-2xl border p-[18px] text-left transition-all {selected
								? 'text-foreground'
								: 'border-border text-muted-foreground bg-card'}"
							data-tid={TestId.OnboardingInterest}
							onclick={() => toggleInterest(id)}
						>
							<div
								style="background: {color}22; color: {color}"
								class="flex h-9 w-9 items-center justify-center rounded-lg"
							>
								<Icon size={18} />
							</div>
							<div class="mt-3.5 text-[15px] font-semibold">{label}</div>
						</button>
					{/each}
				</div>
				<div class="text-muted-foreground mt-1 font-mono text-[11px] tabular-nums">
					{interests.size} of {INTEREST_CATS.length} selected
				</div>
			</div>
		{:else if step === 3}
			<!-- Archetype selection -->
			<div class="space-y-3.5">
				<div>
					<div class="eyebrow">CHOOSE YOUR STARTING ARCHETYPE</div>
					<h2
						style="letter-spacing: -0.025em"
						class="font-display text-foreground mt-2 text-[28px] font-semibold"
					>
						How will you predict?
					</h2>
					<p class="text-muted-foreground mt-2 text-sm">
						This sets your starter style. It evolves with your track record.
					</p>
				</div>
				<div class="mt-2 space-y-2">
					{#each ARCHETYPES as a (a.id)}
						{@const selected = archetype === a.id}
						<button
							style="border-color: {selected
								? a.accent
								: 'var(--border-base)'}; border-left: 2px solid {selected
								? a.accent
								: 'var(--border-base)'}"
							class="flex w-full flex-col rounded-2xl border p-4 text-left transition-all {selected
								? 'bg-[rgba(226,184,66,0.06)]'
								: 'bg-card'}"
							data-tid={TestId.OnboardingArchetype}
							onclick={() => (archetype = a.id)}
						>
							<div class="flex items-center justify-between">
								<span
									style="color: {a.accent}"
									class="text-[10px] font-bold tracking-widest uppercase"
								>
									{a.tag}
								</span>
								{#if selected}
									<Check style="color: {a.accent}" size={16} strokeWidth={2} />
								{/if}
							</div>
							<div class="text-foreground mt-1.5 text-base font-semibold">{a.name}</div>
							<div class="text-muted-foreground mt-1 text-[13px]">{a.description}</div>
						</button>
					{/each}
				</div>
			</div>
		{:else if step === 4}
			<!-- Handle claim -->
			<div class="space-y-3.5">
				<div>
					<div class="eyebrow">CLAIM YOUR HANDLE</div>
					<h2
						style="letter-spacing: -0.025em"
						class="font-display text-foreground mt-2 text-[28px] font-semibold"
					>
						One name. Earned, not given.
					</h2>
					<p class="text-muted-foreground mt-2 text-sm">
						This is the name on the leaderboard. Choose carefully.
					</p>
				</div>
				<div class="border-border bg-card shadow-inset-hi mt-2 rounded-2xl border p-4">
					<div class="eyebrow">YOUR HANDLE</div>
					<div class="mt-2 flex items-baseline gap-2">
						<span class="text-muted-foreground font-mono text-lg">@</span>
						<input
							class="text-foreground flex-1 border-0 bg-transparent font-mono text-[22px] font-semibold outline-none"
							data-tid={TestId.OnboardingHandleInput}
							oninput={(e) => (handle = sanitizeHandle(e.currentTarget.value))}
							placeholder="tacitus"
							type="text"
							value={handle}
						/>
					</div>
					<div class="bg-border mt-1.5 h-px"></div>
					<div class="text-muted-foreground mt-2 font-mono text-[11px]">
						{handle ? `vici.app/${handle}` : 'a-z, 0-9, dot or underscore'}
					</div>
				</div>
				<div
					class="mt-2 rounded-2xl border border-[rgba(226,184,66,0.18)] bg-[rgba(226,184,66,0.04)] p-4"
				>
					<div class="flex items-center gap-2">
						<Sparkles class="text-primary" size={14} strokeWidth={2} />
						<span class="eyebrow text-primary">STARTER PACK</span>
					</div>
					<p class="text-foreground mt-2 text-[13px] leading-relaxed">
						1,000 VXP · 10 starter markets · 3-day grace period for streak
					</p>
				</div>
			</div>
		{/if}
	</div>

	<!-- Bottom action -->
	<div class="border-border border-t px-6 py-3 pb-[calc(env(safe-area-inset-bottom,0px)+24px)]">
		{#if step === 0}
			<button
				class="bg-primary text-primary-foreground w-full rounded-[12px] py-4 text-base font-semibold"
				data-tid={TestId.OnboardingPrimary}
				onclick={next}
			>
				Begin
			</button>
		{:else if step === 1}
			<button
				class="bg-primary text-primary-foreground w-full rounded-[12px] py-4 text-base font-semibold"
				data-tid={TestId.OnboardingPrimary}
				onclick={next}
			>
				Got it
			</button>
		{:else if step === 2}
			<button
				class="bg-primary text-primary-foreground w-full rounded-[12px] py-4 text-base font-semibold transition-opacity"
				class:opacity-35={interests.size < 3}
				data-tid={TestId.OnboardingPrimary}
				disabled={interests.size < 3}
				onclick={next}
			>
				Continue
			</button>
		{:else if step === 3}
			<button
				class="bg-primary text-primary-foreground w-full rounded-[12px] py-4 text-base font-semibold transition-opacity"
				class:opacity-35={!archetype}
				data-tid={TestId.OnboardingPrimary}
				disabled={!archetype}
				onclick={next}
			>
				Continue
			</button>
		{:else if step === 4}
			<button
				class="bg-primary text-primary-foreground w-full rounded-[12px] py-4 text-base font-semibold transition-opacity"
				class:opacity-35={handle.length < 3}
				data-tid={TestId.OnboardingPrimary}
				disabled={handle.length < 3}
				onclick={() => onComplete({ handle, archetype, interests: Array.from(interests) })}
			>
				Enter VICI
			</button>
		{/if}
	</div>
</div>
