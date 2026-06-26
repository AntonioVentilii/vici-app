/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { build, files, prerendered, version } from '$service-worker';

// `self` is the `ServiceWorkerGlobalScope` at runtime; the cast gives us the
// worker-scoped APIs (`skipWaiting`, `clients`) without pulling the whole
// `webworker` lib into the app's default `lib`.
const sw = self as unknown as ServiceWorkerGlobalScope;

// Per-deploy cache. `version` changes on every build, so a new release lands a
// fresh cache and the old one is evicted in `activate`.
const CACHE = `vici-cache-${version}`;

// Content-hashed build output + static files + any prerendered pages. These are
// immutable under a given `version`, so they're safe to precache and serve
// cache-first. NOTE: this is deliberately the ONLY thing the worker caches — no
// API/canister responses ever enter the cache.
const PRECACHE = [...build, ...files, ...prerendered];
const PRECACHE_SET = new Set(PRECACHE);

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(PRECACHE))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
			)
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;

	// The worker only ever owns same-origin GETs. POSTs and cross-origin traffic
	// — notably the IC / canister boundary calls and auth — always go straight to
	// the network, so the worker never sits between the app and the replica.
	if (request.method !== 'GET') {
		return;
	}

	const url = new URL(request.url);

	if (url.origin !== sw.location.origin) {
		return;
	}

	// Precached, content-hashed assets never change under a hash — serve them
	// cache-first.
	if (PRECACHE_SET.has(url.pathname)) {
		event.respondWith(
			caches.open(CACHE).then(async (cache) => (await cache.match(url.pathname)) ?? fetch(request))
		);

		return;
	}

	// App-shell navigations: network-first so an online user always gets the
	// freshest HTML, falling back to a cached shell only when offline. This is
	// also the non-empty `fetch` handler Chrome requires before it will offer to
	// install the app.
	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request).catch(async () => {
				const cache = await caches.open(CACHE);

				return (await cache.match(request)) ?? (await cache.match('/')) ?? Response.error();
			})
		);
	}
});
