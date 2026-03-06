<script lang="ts">
	import { initSatellite } from '@junobuild/core';
	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import { page } from '$app/state';
	import Authn from '$lib/components/authn/Authn.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import Header from '$lib/components/layout/Header.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	// eslint-disable-next-line import/no-relative-parent-imports
	import '../app.css';

	interface Props {
		children: Snippet;
	}

	const { children }: Props = $props();

	const init = async () => {
		await initSatellite({
			workers: {
				auth: true
			}
		});
	};

	$effect(() => {
		init();
	});
</script>

<div class="relative isolate min-h-dvh">
	<Banner />

	<Header />

	<main class="flex-1">
		<Authn>
			{#key page.url.pathname}
				<div
					class="container mx-auto px-4 py-8"
					in:fade={{ duration: 300, delay: 300 }}
					out:fade={{ duration: 300 }}
				>
					{@render children()}
				</div>
			{/key}
		</Authn>
	</main>

	<Footer />
</div>
