<script lang="ts">
	import type { Snippet } from 'svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import type { TestId } from '$lib/constants/test-ids.constants';
	import type { ButtonStatus } from '$lib/types/components';

	interface Props {
		status?: ButtonStatus;
		variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
		size?: 'sm' | 'md' | 'lg';
		busyLabel?: Snippet;
		children: Snippet;
		onclick?: () => void;
		class?: string;
		testId?: TestId;
	}

	const {
		status,
		variant = 'primary',
		size = 'md',
		busyLabel = undefined,
		children,
		onclick = undefined,
		class: className = '',
		testId
	}: Props = $props();

	const variants: Record<NonNullable<Props['variant']>, string> = {
		primary: 'bg-primary text-primary-foreground shadow-lg hover:opacity-90',
		secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:opacity-90',
		outline: 'border-2 border-primary text-primary bg-transparent hover:bg-primary/5',
		ghost: 'bg-transparent text-foreground hover:bg-primary/10',
		danger: 'bg-destructive text-destructive-foreground shadow-md hover:opacity-90'
	};

	const sizes: Record<NonNullable<Props['size']>, string> = {
		sm: 'px-4 py-1.5 text-xs',
		md: 'px-8 py-2.5 text-sm',
		lg: 'px-10 py-3.5 text-base'
	};
</script>

<BaseButton
	class="gap-2 rounded-lg font-bold active:scale-95 {variants[variant]} {sizes[size]} {className}"
	{busyLabel}
	data-tid={testId}
	{onclick}
	{status}
>
	{@render children()}
</BaseButton>
