<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import { page } from '$app/state';
	import Authn from '$lib/components/authn/Authn.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import Header from '$lib/components/layout/Header.svelte';
	import MobileNav from '$lib/components/layout/MobileNav.svelte';
	import Loaders from '$lib/components/loaders/Loaders.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import { AppPath } from '$lib/constants/routes.constants';

	interface Props {
		children: Snippet;
	}

	const { children }: Props = $props();

	const isFlowPage = $derived(page.url.pathname === AppPath.Flow);
</script>

<div class="relative isolate min-h-dvh">
	<div class={isFlowPage ? 'hidden md:block' : ''}>
		<Banner />
	</div>

	<div class={isFlowPage ? 'hidden md:block' : ''}>
		<Header />
	</div>

	<main class="flex-1 {isFlowPage ? 'md:pb-0' : 'pb-20 md:pb-0'}">
		<Authn>
			{#key page.url.pathname}
				<div
					class={isFlowPage
						? 'md:container md:mx-auto md:px-4 md:py-8'
						: 'container mx-auto px-4 py-8'}
					in:fade={{ duration: 100, delay: 100 }}
					out:fade={{ duration: 100 }}
				>
					{@render children()}
				</div>
			{/key}

			<Loaders />
		</Authn>
	</main>

	<div class={isFlowPage ? 'hidden md:block' : ''}>
		<Footer />
	</div>

	{#if !isFlowPage}
		<MobileNav />
	{/if}
</div>
