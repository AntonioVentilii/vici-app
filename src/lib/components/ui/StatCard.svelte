<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
	import type { CardPadding } from '$lib/types/components';

	interface Props {
		label: string;
		value: string | number;
		unit?: string;
		variant?: 'default' | 'primary' | 'success' | 'danger' | 'warning';
		size?: 'sm' | 'md' | 'lg';
	}

	const { label, value, unit, variant = 'default', size = 'md' }: Props = $props();

	const variantStyles: Record<NonNullable<Props['variant']>, string> = {
		default: 'text-slate-950',
		primary: 'text-indigo-600',
		success: 'text-emerald-600',
		danger: 'text-rose-600',
		warning: 'text-amber-600'
	};

	const sizes: Record<
		NonNullable<Props['size']>,
		{ label: string; value: string; padding: CardPadding }
	> = {
		sm: { label: 'text-[10px]', value: 'text-xl', padding: 'sm' },
		md: { label: 'text-[10px]', value: 'text-2xl', padding: 'md' },
		lg: { label: 'text-xs', value: 'text-3xl', padding: 'lg' }
	};

	const sizeStyles = $derived(sizes[size]);
</script>

<Card padding={sizeStyles.padding}>
	<div class="{sizeStyles.label} font-bold tracking-widest text-slate-500 uppercase">{label}</div>
	<div class="mt-1 flex items-baseline gap-2">
		<span class="{sizeStyles.value} font-black {variantStyles[variant]}">{value}</span>
		{#if unit}
			<span class="text-xs font-bold text-slate-500 uppercase">{unit}</span>
		{/if}
	</div>
</Card>
