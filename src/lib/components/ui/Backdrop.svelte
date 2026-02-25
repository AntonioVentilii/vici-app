<script lang="ts">
	interface Props {
		spinner?: boolean;
	}

	const { spinner = false }: Props = $props();
</script>

<div class="fixed inset-0 z-40 flex items-center justify-center bg-white/30 backdrop-blur-xl">
	{#if spinner}
		<div
			class="h-12 w-12 animate-spin rounded-full border-[3px] border-solid border-indigo-600 border-t-transparent"
		></div>
	{/if}
</div>
