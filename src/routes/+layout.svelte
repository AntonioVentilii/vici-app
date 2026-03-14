<script lang="ts">
	import { initSatellite } from '@junobuild/core';
	import type { Snippet } from 'svelte';
	import Banner from '$lib/components/layout/Banner.svelte';
	import Notifications from '$lib/components/ui/Notifications.svelte';
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

{@render children()}

<Banner />

<Notifications />
