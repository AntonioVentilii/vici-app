<script lang="ts">
	import { nonNullish } from '@dfinity/utils';
	import type { Snippet } from 'svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import type { CardPadding } from '$lib/types/components';

	interface Props {
		children: Snippet;
		variant?: 'default' | 'glass' | 'outline';
		padding?: CardPadding;
		onclick?: (e: MouseEvent) => void;
		onkeydown?: (e: KeyboardEvent) => void;
		role?: 'button' | 'presentation' | 'none';
	}

	const {
		children,
		variant = 'default',
		padding = 'md',
		onclick,
		onkeydown,
		role
	}: Props = $props();

	const commonClasses =
		'flex flex-col items-start justify-between rounded-2xl border transition-all';

	const variants: Record<NonNullable<Props['variant']>, string> = {
		default: 'bg-card text-card-foreground border-border shadow-sm',
		glass: 'bg-white/5 backdrop-blur-md border-white/10 shadow-xl',
		outline: 'bg-transparent border-2 border-border'
	};

	const paddings: Record<NonNullable<Props['padding']>, string> = {
		none: 'p-0',
		sm: 'p-4',
		md: 'p-6',
		lg: 'p-8'
	};

	const isInteractive = $derived(nonNullish(onclick) || nonNullish(onkeydown) || role === 'button');
</script>

{#if isInteractive}
	<BaseButton class="{commonClasses} {variants[variant]} {paddings[padding]}" {onclick} {onkeydown}>
		{@render children()}
	</BaseButton>
{:else}
	<div class="{commonClasses} {variants[variant]} {paddings[padding]}">
		{@render children()}
	</div>
{/if}
