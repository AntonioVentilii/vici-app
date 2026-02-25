<script lang="ts">
	import { initSatellite } from '@junobuild/core';
	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import { page } from '$app/state';
	import Auth from '$lib/components/Auth.svelte';
	import Background from '$lib/components/Background.svelte';
	import Banner from '$lib/components/Banner.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Header from '$lib/components/Header.svelte';
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

<div class="relative isolate min-h-dvh bg-black text-gray-100">
	<Banner />

	<Header />

	<main class="mx-auto max-w-7xl px-4 pt-24 pb-16 sm:px-6 lg:px-8">
		<Auth>
			{#key page.url.pathname}
				<div in:fade={{ duration: 300, delay: 300 }} out:fade={{ duration: 300 }}>
					{@render children()}
				</div>
			{/key}
		</Auth>
	</main>

	<Footer />

	<Background />
</div>
