<script lang="ts">
	import { TriangleAlert, X } from 'lucide-svelte/icons';

	let envBannerVisible = $state(true);

	const closeEnvBanner = () => (envBannerVisible = false);
</script>

{#if envBannerVisible}
	<div
		class="fixed top-0 left-1/2 z-40 mx-auto mt-1 flex w-[calc(100vw-2rem)] max-w-3xl -translate-x-1/2 justify-between gap-4 rounded-xl bg-red-400 px-3 py-2 font-extrabold text-white lg:w-[calc(100vw-4rem)] lg:px-6 lg:py-4"
	>
		<span class="flex items-center justify-center gap-4">
			<TriangleAlert size="48" />
			<h3 class="clamp-4">For testing purposes only!</h3>
		</span>
		<button class="cursor-pointer" aria-label="Close banner" onclick={closeEnvBanner}><X /></button>
	</div>
{/if}
