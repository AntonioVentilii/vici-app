<script lang="ts">
	import { initSatellite } from '@junobuild/core';
	import type { Snippet } from 'svelte';
	import TweaksPanel from '$lib/components/dev/TweaksPanel.svelte';
	import Banner from '$lib/components/layout/Banner.svelte';
	import Notifications from '$lib/components/ui/Notifications.svelte';
	// eslint-disable-next-line import/no-relative-parent-imports
	import '../app.css';

	interface Props {
		children: Snippet;
	}

	const { children }: Props = $props();

	let satelliteInitialized = $state(false);

	const init = async () => {
		await initSatellite({
			workers: {
				// TODO: reinstate the `auth: true` when the PR is merged and released: https://github.com/junobuild/juno-js/issues/877#issuecomment-4206881878
				auth: '/workers/auth.worker.js'
			}
		});

		satelliteInitialized = true;
	};

	$effect(() => {
		init();
	});
</script>

{#if !satelliteInitialized}
	<div class="flex h-screen items-center justify-center">
		<div class="text-center">
			<div class="loader mb-4"></div>
			<p class="text-lg">Loading...</p>
		</div>
	</div>
{:else}
	{@render children()}
{/if}

<Banner />

<Notifications />

<TweaksPanel />
