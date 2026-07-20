<script lang="ts">
	import { initSatellite } from '@junobuild/core';
	import { onMount, type Snippet } from 'svelte';
	import { browser } from '$app/environment';
	import { afterNavigate } from '$app/navigation';
	import Authn from '$lib/components/authn/Authn.svelte';
	import type TweaksPanelComponent from '$lib/components/dev/TweaksPanel.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import MaintenanceOverlay from '$lib/components/ui/MaintenanceOverlay.svelte';
	import Notifications from '$lib/components/ui/Notifications.svelte';
	import { isDev } from '$lib/env/app.env';
	import {
		initMaintenanceWatch,
		reportMaintenanceCandidate
	} from '$lib/services/maintenance.services';
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

	// Dev-only panel, mounted from a lazy chunk: the static import shipped
	// its whole subtree (appearance picker, tweak stores) inside the prod
	// boot graph even though `isDev()` never renders it there.
	let TweaksPanel = $state<typeof TweaksPanelComponent | undefined>();

	onMount(() => {
		if (!isDev()) {
			return;
		}

		void import('$lib/components/dev/TweaksPanel.svelte')
			.then((module) => {
				TweaksPanel = module.default;
			})
			.catch((err: unknown) => console.warn('Tweaks panel failed to load', err));
	});

	const init = async () => {
		await initSatellite({
			workers: {
				// TODO: reinstate the `auth: true` when the PR is merged and released: https://github.com/junobuild/juno-js/issues/877#issuecomment-4206881878
				auth: '/workers/auth.worker.js'
			}
		});

		satelliteInitialized = true;

		// Start product-analytics capture once the satellite is ready (sets up
		// the tab-hide flush + emits `session_started`). Fire-and-forget, and
		// imported on demand: the analytics service pulls the satellite API +
		// zod cluster, which must not sit in the boot graph ahead of first
		// paint. Caught locally — a failed chunk fetch is an analytics loss,
		// not a boot failure, and must not reach `init()`'s maintenance
		// detection.
		void import('$lib/services/analytics.services')
			.then(({ initAnalytics }) => initAnalytics())
			.catch((err: unknown) => console.warn('Analytics init failed', err));
	};

	$effect(() => {
		// A boot from browser-cached assets can land mid-deploy while the
		// satellite is stopped — route the failure into maintenance detection
		// instead of hanging on the boot spinner.
		void init().catch((err: unknown) => {
			// Keep the failure diagnosable when it is NOT a deploy window (the
			// app still hangs on the boot spinner in that case).
			console.error('Satellite init failed', err);

			return reportMaintenanceCandidate(err);
		});
	});

	// Polling loaders let satellite rejections bubble (`void tick()` in
	// `AtomicLoader`), so the global listeners pick up the "canister is
	// stopped" errors a deploy causes and trigger the maintenance overlay.
	onMount(initMaintenanceWatch);

	// RTL scripts — kept in sync with the flash-free locale boot in
	// `app.html` so the document direction stays correct after hydrate.
	const RTL_LANGS = ['ar', 'he', 'fa', 'ur'];

	$effect(() => {
		if (!browser) {
			return;
		}

		const el = document.documentElement;
		const lang = $localeStore.split('-')[0].toLowerCase();

		el.lang = $localeStore;
		el.setAttribute('data-locale', $localeStore);
		el.dir = RTL_LANGS.includes(lang) ? 'rtl' : 'ltr';
	});

	afterNavigate(({ from }) => {
		if (from?.url) {
			previousPathStore.set(from.url.pathname + from.url.search);
		}
	});
</script>

{#if !satelliteInitialized}
	<div
		class="flex h-screen items-center justify-center"
		aria-label={t({ locale: $localeStore, key: 'ui.loading' })}
		aria-live="polite"
		role="status"
	>
		<LoadingSpinner size="lg" />
	</div>
{:else}
	<Authn>
		{@render children()}
	</Authn>
{/if}

<Notifications />

<MaintenanceOverlay />

{#if TweaksPanel}
	<TweaksPanel />
{/if}
