<script lang="ts">
	interface Props {
		label?: string;
		size?: 'xs' | 'sm';
	}

	const { label = 'You', size = 'xs' }: Props = $props();

	const sizes: Record<NonNullable<Props['size']>, string> = {
		xs: 'px-1.5 py-0.5 text-[9px]',
		sm: 'px-2 py-0.5 text-[10px]'
	};
</script>

<span
	class="bg-primary/10 text-primary ring-primary/20 inline-flex shrink-0 items-center rounded-full font-bold tracking-wider uppercase ring-1 ring-inset {sizes[
		size
	]}"
	title="This is you"
>
	{label}
</span>
