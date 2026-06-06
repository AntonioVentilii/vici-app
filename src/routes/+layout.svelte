<script lang="ts">
	import { initSatellite } from '@junobuild/core';
	import type { Snippet } from 'svelte';
	import { browser } from '$app/environment';
	import { afterNavigate } from '$app/navigation';
	import Authn from '$lib/components/authn/Authn.svelte';
	import TweaksPanel from '$lib/components/dev/TweaksPanel.svelte';
	import Notifications from '$lib/components/ui/Notifications.svelte';
	import { initAnalytics } from '$lib/services/analytics.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { previousPathStore } from '$lib/stores/previous-path.store';
	import { t } from '$lib/utils/i18n.utils';
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

		// Start product-analytics capture once the satellite is ready (sets up
		// the tab-hide flush + emits `session_started`). Fire-and-forget.
		initAnalytics();
	};

	$effect(() => {
		init();
	});

	$effect(() => {
		if (!browser) {
			return;
		}

		document.documentElement.lang = $localeStore;
	});

	afterNavigate(({ from }) => {
		if (from?.url) {
			previousPathStore.set(from.url.pathname + from.url.search);
		}
	});
</script>

{#if !satelliteInitialized}
	<div class="flex h-screen items-center justify-center">
		<div class="text-center">
			<div class="loader mb-4"></div>
			<p class="text-lg">{t({ locale: $localeStore, key: 'ui.loading' })}</p>
		</div>
	</div>
{:else}
	<Authn>
		{@render children()}
	</Authn>
{/if}

<Notifications />

<TweaksPanel />
