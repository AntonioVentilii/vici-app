<script lang="ts">
	import { initSatellite } from '@junobuild/core';
	import type { Snippet } from 'svelte';
	import Auth from '$lib/components/Auth.svelte';
	import Background from '$lib/components/Background.svelte';
	import Banner from '$lib/components/Banner.svelte';
	import Footer from '$lib/components/Footer.svelte';
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

	<main
		class="mx-auto max-w-(--breakpoint-2xl) px-8 py-16 md:px-24 [@media(min-height:800px)]:min-h-[calc(100dvh-128px)]"
	>
		<h1 class="text-5xl font-bold tracking-tight md:pt-24 md:text-6xl dark:text-white">
			Example App
		</h1>
		<p class="py-4 md:max-w-lg dark:text-white">
			Try out this demo app to discover
			<a class="underline" href="https://juno.build" rel="noopener noreferrer" target="_blank">
				Juno</a
			>.
		</p>

		<Auth>
			{@render children()}
		</Auth>
	</main>

	<Footer />

	<Background />
</div>
