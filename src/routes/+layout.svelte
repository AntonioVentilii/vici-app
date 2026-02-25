<script lang="ts">
	import { initSatellite } from '@junobuild/core';
	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import { page } from '$app/state';
	import Auth from '$lib/components/auth/Auth.svelte';
	import Background from '$lib/components/layout/Background.svelte';
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
