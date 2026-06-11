<script lang="ts">
	import { handleRedirectCallback } from '@junobuild/core';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import { SIGNED_IN_FLAG_KEY } from '$lib/constants/app.constants';
	import { AppPath, PublicPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	onMount(async () => {
		try {
			await handleRedirectCallback({
				google: null
			});

			// Land the freshly authenticated session straight on Flow —
			// the canonical first surface for every authenticated session
			// (see #421). Routing through `/` here would double-bounce
			// (`/` → `/flow`) and risk a transient marketing / markets
			// paint before the root gate re-runs.
			await goto(resolve(AppPath.Flow), { replaceState: true });
		} catch (err: unknown) {
			console.error('Failed to finish Google sign-in:', err);

			// Sign-in failed, so this device has no session. Clear the stale
			// `signed-in` hint — otherwise the root gate (`src/routes/+page.svelte`)
			// would read it and hold its resume spinner on `/` waiting for a
			// session that never arrives, the "loop, can't enter" report (#546).
			// Route to the sign-in screen (not `/`) so they get the provider
			// buttons back with the flag cleared, breaking the loop.
			if (browser) {
				try {
					localStorage.removeItem(SIGNED_IN_FLAG_KEY);
				} catch {
					// Private mode / storage disabled — nothing to clear.
				}
			}

			await goto(resolve(PublicPath.SignIn), { replaceState: true });
		}
	});
</script>

<div class="flex h-screen w-full flex-col items-center justify-center gap-4">
	<LoadingSpinner center={false} size="md" />
	<p class="animate-pulse text-lg font-medium">
		{t({ locale: $localeStore, key: 'auth.callback.google.completing' })}
	</p>
</div>
