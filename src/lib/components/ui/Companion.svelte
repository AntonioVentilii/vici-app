<script lang="ts">
	import { onMount } from 'svelte';
	import FlameChar from '$lib/components/characters/FlameChar.svelte';
	import OracleChar from '$lib/components/characters/OracleChar.svelte';
	import TricksterChar from '$lib/components/characters/TricksterChar.svelte';
	import ViciChar from '$lib/components/characters/ViciChar.svelte';
	import type { FlameStage } from '$lib/utils/streak.utils';

	type CompanionWho = 'vici' | 'oracle' | 'trickster' | 'flame';
	type CompanionAnchor = 'br' | 'tr' | 'inline';
	type ViciMood = 'happy' | 'encouraging' | 'thinking' | 'surprised';

	interface Props {
		who?: CompanionWho;
		line?: string;
		dwell_ms?: number;
		sticky?: boolean;
		anchor?: CompanionAnchor;
		size?: number;
		mood?: ViciMood;
		stage?: FlameStage;
		lightning?: boolean;
		onDismiss?: () => void;
	}

	let {
		who = 'vici',
		line,
		dwell_ms = 3200,
		sticky = false,
		anchor = 'br',
		size = 44,
		mood = 'happy',
		stage = 'flame',
		lightning = false,
		onDismiss = () => {}
	}: Props = $props();

	let visible = $state(true);

	onMount(() => {
		if (sticky) {
			return;
		}

		const id = setTimeout(() => {
			visible = false;
			onDismiss();
		}, dwell_ms);

		return () => clearTimeout(id);
	});

	const isInline = $derived(anchor === 'inline');
</script>

{#if visible}
	<div
		class="companion-wrap char-pop {isInline ? 'companion-inline' : 'companion-floating'}"
		class:companion-br={!isInline && anchor === 'br'}
		class:companion-tr={!isInline && anchor === 'tr'}
	>
		<span style="width: {size}px; height: {size}px" class="inline-flex flex-none">
			{#if who === 'vici'}
				<ViciChar animate {mood} {size} />
			{:else if who === 'oracle'}
				<OracleChar animate {size} />
			{:else if who === 'trickster'}
				<TricksterChar animate {lightning} {size} />
			{:else if who === 'flame'}
				<FlameChar animate {size} {stage} />
			{/if}
		</span>
		{#if line}
			<span class="text-foreground text-[13px] leading-snug font-medium">{line}</span>
		{/if}
	</div>
{/if}

<style lang="postcss">
	.companion-wrap {
		display: flex;
		align-items: center;
		gap: 10px;
		transition: opacity var(--d-state) var(--ease-vici);
	}

	.companion-inline {
		display: inline-flex;
		padding: 8px 12px 8px 8px;
		border-radius: var(--r-pill);
		background: rgba(242, 236, 220, 0.04);
		border: 1px solid var(--border-base);
	}

	.companion-floating {
		position: fixed;
		z-index: 60;
		right: 16px;
		padding: 8px 14px 8px 8px;
		border-radius: var(--r-pill);
		background: rgba(14, 13, 11, 0.85);
		backdrop-filter: blur(16px);
		border: 1px solid var(--border-base);
		box-shadow: 0 12px 32px -12px rgba(0, 0, 0, 0.6);
		max-width: 280px;
	}

	.companion-tr {
		top: 16px;
	}

	.companion-br {
		bottom: calc(var(--bottomnav-h) + 24px);
	}
</style>
