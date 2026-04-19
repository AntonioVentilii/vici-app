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
	class="inline-flex shrink-0 items-center rounded-full bg-indigo-50 font-bold tracking-wider text-indigo-700 uppercase ring-1 ring-indigo-700/20 ring-inset {sizes[
		size
	]}"
	title="This is you"
>
	{label}
</span>
