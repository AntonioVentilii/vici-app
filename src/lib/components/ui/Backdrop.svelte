<script lang="ts">
	interface Props {
		spinner?: boolean;
	}

	const { spinner = false }: Props = $props();
</script>

<div class="bg-card/30 fixed inset-0 z-40 flex items-center justify-center backdrop-blur-xl">
	{#if spinner}
		<div
			class="border-primary h-12 w-12 animate-spin rounded-full border-[3px] border-solid border-t-transparent"
		></div>
	{/if}
</div>
