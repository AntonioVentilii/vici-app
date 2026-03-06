<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import { page } from '$app/state';
	import Authn from '$lib/components/authn/Authn.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import Header from '$lib/components/layout/Header.svelte';
	import Loaders from '$lib/components/loaders/Loaders.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';

	interface Props {
		children: Snippet;
	}

	const { children }: Props = $props();
</script>

<div class="relative isolate min-h-dvh">
	<Banner />

	<Header />

	<main class="flex-1">
		<Authn>
			{#key page.url.pathname}
				<div
					class="container mx-auto px-4 py-8"
					in:fade={{ duration: 100, delay: 100 }}
					out:fade={{ duration: 100 }}
				>
					{@render children()}
				</div>
			{/key}

			<Loaders />
		</Authn>
	</main>

	<Footer />
</div>
