/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// OAuth (Google/Apple) returns to `/auth/callback/*` as a HARD document fetch
// from the IC HTTP gateway. When the gateway transiently fails — certification
// not yet settled, cold canister, boundary-node throttle — it serves its own
// "500 Internal error" page before any app JS runs, so the in-page callback
// handler never executes and the sign-in dies. This worker's sole job is to
// intercept that failed navigation and serve the cached app shell, letting the
// SPA boot and finish the callback. It is navigation-fallback only.
//
// Cache-scope safety: the ONLY things cached are (a) the immutable,
// content-hashed Vite `build` assets and (b) the SPA shell HTML. We never cache
// API / canister / satellite / auth / dynamic responses — those come back from
// the IC uncertified inside the SW, and caching them would risk serving stale
// or incorrect on-chain data. Anything that is not a same-origin build asset or
// a navigation passes straight through to the network, untouched.

import { base, build, version } from '$service-worker';

declare const self: ServiceWorkerGlobalScope;

// Versioned so each deployment invalidates the previous build's assets.
const ASSET_CACHE = `vici-cache-${version}`;

// The shell lives in a SEPARATE, NON-versioned cache so the last-good shell
// survives a version bump: on the deploy that ships a new SW, the gateway may
// still be flaky for the navigation that bootstraps it. Keeping the shell out
// of the versioned cache means `activate` does not evict it, so the fallback
// stays available across upgrades.
const SHELL_CACHE = 'vici-shell';

// Stable key under which any successful navigation response is stored. Because
// the app is `prerender:false` + SPA `fallback`, every route returns the same
// shell HTML, so a single stored entry is a valid fallback for ALL routes —
// including the OAuth callback.
const SHELL_KEY = `${base}/__app_shell`;

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(ASSET_CACHE);

			await cache.addAll(build);

			await self.skipWaiting();
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();

			await Promise.all(
				keys
					.filter((key) => key !== ASSET_CACHE && key !== SHELL_CACHE)
					.map((key) => caches.delete(key))
			);

			await self.clients.claim();
		})()
	);
});

const BUILD_ASSETS = new Set(build);

const handleNavigation = async (request: Request): Promise<Response> => {
	const shellCache = await caches.open(SHELL_CACHE);

	try {
		const res = await fetch(request);

		// Only a genuinely-served shell (status < 500) is worth caching; a gateway
		// 5xx is the failure mode we exist to mask, so it must not overwrite the
		// last-good shell.
		if (res.status < 500) {
			await shellCache.put(SHELL_KEY, res.clone());

			return res;
		}

		const cached = await shellCache.match(SHELL_KEY);

		return cached ?? res;
	} catch (_err) {
		const cached = await shellCache.match(SHELL_KEY);

		return cached ?? Response.error();
	}
};

const handleBuildAsset = async (request: Request): Promise<Response> => {
	const cache = await caches.open(ASSET_CACHE);

	const cached = await cache.match(request);

	if (nonNullishResponse(cached)) {
		return cached;
	}

	const res = await fetch(request);

	await cache.put(request, res.clone());

	return res;
};

// Local guard: `@dfinity/utils` is a FE-only dependency, so the SW resolves
// nullishness inline to keep its dependency surface to `$service-worker`.
const nonNullishResponse = (value: Response | undefined): value is Response =>
	value instanceof Response;

self.addEventListener('fetch', (event) => {
	const { request } = event;

	if (request.method !== 'GET') {
		return;
	}

	const url = new URL(request.url);

	if (url.origin !== self.location.origin) {
		return;
	}

	if (request.mode === 'navigate') {
		event.respondWith(handleNavigation(request));

		return;
	}

	if (BUILD_ASSETS.has(url.pathname)) {
		event.respondWith(handleBuildAsset(request));
	}
});
