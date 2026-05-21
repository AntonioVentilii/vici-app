<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import type { ButtonStatus } from '$lib/types/components';

	interface Props extends Omit<HTMLButtonAttributes, 'disabled' | 'aria-busy'> {
		status?: ButtonStatus;
		variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
		size?: 'sm' | 'md' | 'lg';
		busyLabel?: Snippet;
		children: Snippet;
		onclick?: () => void;
		class?: string;
	}

	const {
		status,
		variant = 'primary',
		size = 'md',
		busyLabel = undefined,
		children,
		onclick = undefined,
		class: className = '',
		...rest
	}: Props = $props();

	const variants: Record<NonNullable<Props['variant']>, string> = {
		primary: 'bg-primary text-primary-foreground shadow-inset-hi hover:bg-laurel-deep',
		secondary:
			'border border-border bg-foreground/6 text-foreground shadow-inset-hi hover:border-border-strong hover:bg-foreground/10',
		outline:
			'border border-primary/45 bg-transparent text-primary hover:border-primary hover:bg-laurel-glow',
		ghost: 'bg-transparent text-foreground hover:bg-foreground/6',
		danger: 'bg-destructive text-destructive-foreground shadow-inset-hi hover:bg-no-deep'
	};

	const sizes: Record<NonNullable<Props['size']>, string> = {
		sm: 'px-3 py-2 text-xs',
		md: 'px-5 py-3.5 text-[15px]',
		lg: 'rounded-[14px] px-6 py-4 text-base'
	};
</script>

<BaseButton
	class="ease-vici duration-hover gap-2 rounded-xl font-semibold tracking-tight whitespace-nowrap transition-all active:scale-[0.985] {variants[
		variant
	]} {sizes[size]} {className}"
	{busyLabel}
	{onclick}
	{status}
	{...rest}
>
	{@render children()}
</BaseButton>
