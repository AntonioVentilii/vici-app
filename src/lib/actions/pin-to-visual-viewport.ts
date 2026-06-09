import { browser } from '$app/environment';

/**
 * Svelte action that pins a `position: fixed` full-viewport overlay to
 * `window.visualViewport` — the only reliable measure of the *actually-visible*
 * area on iOS.
 *
 * iOS browsers (notably iOS Chrome) resolve a fixed `inset: 0` / `100dvh`
 * against the *large* layout viewport (toolbars retracted), so a bottom-docked
 * footer lands behind the browser's bottom toolbar and gets clipped. `dvh` is
 * supposed to track the visible height but iOS Chrome doesn't honour it
 * reliably. Driving the node's `top` + `height` off `visualViewport` overlays
 * it exactly on the visible region, so a `flex-end` child docks above the
 * toolbar.
 *
 * No-op when `visualViewport` is unavailable (SSR / desktop / older engines) —
 * the node keeps its CSS height (the `100dvh` baseline stands).
 */
export const pinToVisualViewport = (node: HTMLElement) => {
	if (!browser) {
		return;
	}

	const viewport = window.visualViewport;

	if (!viewport) {
		return;
	}

	const sync = () => {
		// `top` tracks the visible region's offset within the layout viewport
		// (notch / collapsed top bar); `height` is the visible height. Together
		// they overlay the node on exactly the visible area.
		node.style.top = `${viewport.offsetTop}px`;
		node.style.height = `${viewport.height}px`;
	};

	// Passive: the listeners only read viewport metrics to size the node; they
	// never call `preventDefault`.
	const opts: AddEventListenerOptions = { passive: true };

	sync();
	viewport.addEventListener('resize', sync, opts);
	viewport.addEventListener('scroll', sync, opts);

	return {
		destroy: () => {
			viewport.removeEventListener('resize', sync, opts);
			viewport.removeEventListener('scroll', sync, opts);
			node.style.removeProperty('top');
			node.style.removeProperty('height');
		}
	};
};
