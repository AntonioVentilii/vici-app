<script lang="ts">
	/**
	 * Four overlapping circles seeded from
	 * `augustus / cassandra / nero / livia`. Thin wrapper around
	 * `SeededAvatarStack` so the landing markup keeps its existing
	 * name while the actual rendering lives in the shared component.
	 */
	import SeededAvatarStack from '$lib/components/ui/SeededAvatarStack.svelte';
</script>

<SeededAvatarStack />
