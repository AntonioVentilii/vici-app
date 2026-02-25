<script lang="ts">
	interface Props {
		class?: string;
	}

	const { class: className = '' }: Props = $props();
</script>

<div class="flex justify-center py-24 {className}">
	<div
		class="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"
	></div>
</div>
