<script lang="ts">
	import { browser } from '$app/environment';

	/**
	 * TEMPORARY iOS-viewport diagnostic. Renders nothing unless the URL carries
	 * `?vvprobe` (persisted to localStorage so it survives in-app navigation).
	 *
	 * It overlays:
	 *  - a live numeric readout of every viewport metric, and
	 *  - two reference edges: RED = bottom of a `visualViewport`-pinned fixed box,
	 *    BLUE = bottom of a plain `position: fixed; bottom: 0` box.
	 *
	 * On a real iOS Chrome device this tells us, at a glance, whether
	 * `window.visualViewport` excludes the bottom toolbar (RED sits above the
	 * toolbar) or not (RED is hidden behind it like BLUE). Remove once the
	 * bottom-sheet clipping is resolved.
	 */
	const enabled = $state(
		browser &&
			(new URLSearchParams(window.location.search).has('vvprobe') ||
				window.localStorage.getItem('vvprobe') === '1')
	);

	let m = $state({
		innerH: 0,
		innerW: 0,
		vvH: 0,
		vvW: 0,
		vvOffsetTop: 0,
		vvScale: 1,
		clientH: 0,
		screenH: 0,
		dpr: 1,
		dvh: 0,
		svh: 0,
		lvh: 0,
		vh: 0,
		safeBottom: 0,
		ua: ''
	});

	const measureUnit = (unit: string): number => {
		const el = document.createElement('div');
		el.style.cssText = `position:fixed;top:0;left:-9999px;height:100${unit};`;
		document.body.appendChild(el);
		const h = el.getBoundingClientRect().height;
		el.remove();

		return Math.round(h);
	};

	const measureSafeBottom = (): number => {
		const el = document.createElement('div');
		el.style.cssText =
			'position:fixed;left:-9999px;padding-bottom:env(safe-area-inset-bottom,0px);';
		document.body.appendChild(el);
		const pb = parseFloat(getComputedStyle(el).paddingBottom) || 0;
		el.remove();

		return Math.round(pb);
	};

	$effect(() => {
		if (!enabled) {
			return;
		}

		if (new URLSearchParams(window.location.search).has('vvprobe')) {
			window.localStorage.setItem('vvprobe', '1');
		}

		const vv = window.visualViewport;

		const sync = () => {
			m = {
				innerH: window.innerHeight,
				innerW: window.innerWidth,
				vvH: vv ? Math.round(vv.height) : -1,
				vvW: vv ? Math.round(vv.width) : -1,
				vvOffsetTop: vv ? Math.round(vv.offsetTop) : -1,
				vvScale: vv ? Number(vv.scale.toFixed(2)) : -1,
				clientH: document.documentElement.clientHeight,
				screenH: window.screen.height,
				dpr: window.devicePixelRatio,
				dvh: measureUnit('dvh'),
				svh: measureUnit('svh'),
				lvh: measureUnit('lvh'),
				vh: measureUnit('vh'),
				safeBottom: measureSafeBottom(),
				ua: navigator.userAgent
			};
		};

		const opts: AddEventListenerOptions = { passive: true };
		sync();
		vv?.addEventListener('resize', sync, opts);
		vv?.addEventListener('scroll', sync, opts);
		window.addEventListener('resize', sync, opts);

		return () => {
			vv?.removeEventListener('resize', sync, opts);
			vv?.removeEventListener('scroll', sync, opts);
			window.removeEventListener('resize', sync, opts);
		};
	});

	const pin = (node: HTMLElement) => {
		const vv = window.visualViewport;

		if (!vv) {
			return;
		}

		const sync = () => {
			node.style.top = `${vv.offsetTop}px`;
			node.style.height = `${vv.height}px`;
		};

		const opts: AddEventListenerOptions = { passive: true };
		sync();
		vv.addEventListener('resize', sync, opts);
		vv.addEventListener('scroll', sync, opts);

		return {
			destroy: () => {
				vv.removeEventListener('resize', sync, opts);
				vv.removeEventListener('scroll', sync, opts);
			}
		};
	};

	const disable = () => {
		window.localStorage.removeItem('vvprobe');
		window.location.reload();
	};
</script>

{#if enabled}
	<!-- BLUE edge (full width): bottom of a plain fixed; bottom:0 box — the broken
	     baseline; this sits at the layout-viewport bottom, behind the toolbar. -->
	<div class="vvp-fixed-bottom" aria-hidden="true">
		<div class="vvp-edge vvp-blue">BLUE fixed bottom:0</div>
	</div>

	<!-- RED edge (70% width): bottom of a visualViewport-pinned box. -->
	<div class="vvp-pinned" aria-hidden="true" use:pin>
		<div class="vvp-edge vvp-red">RED visualViewport</div>
	</div>

	<!-- GREEN edge (40% width): bottom of a 100svh box (smallest viewport). If
	     THIS clears the toolbar, an svh-sized container + sticky footer fixes it. -->
	<div class="vvp-svh" aria-hidden="true">
		<div class="vvp-edge vvp-green">GREEN 100svh</div>
	</div>

	<!-- Numbers -->
	<div class="vvp-panel">
		<button class="vvp-close" onclick={disable} type="button">tap to disable probe ✕</button>
		<div>innerH <b>{m.innerH}</b> · clientH <b>{m.clientH}</b></div>
		<div>
			vv.height <b>{m.vvH}</b> · vv.offsetTop <b>{m.vvOffsetTop}</b> · scale <b>{m.vvScale}</b>
		</div>
		<div>dvh <b>{m.dvh}</b> · svh <b>{m.svh}</b> · lvh <b>{m.lvh}</b> · vh <b>{m.vh}</b></div>
		<div>safe-bottom <b>{m.safeBottom}</b> · screenH <b>{m.screenH}</b> · dpr <b>{m.dpr}</b></div>
		<div class="vvp-delta">
			innerH − vv.height − offsetTop = <b>{m.innerH - m.vvH - m.vvOffsetTop}</b>
		</div>
		<div class="vvp-ua">{m.ua}</div>
	</div>
{/if}

<style lang="postcss">
	.vvp-fixed-bottom {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 2147483646;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		height: 100dvh;
		pointer-events: none;
	}

	.vvp-pinned {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 100dvh;
		z-index: 2147483647;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: center;
		pointer-events: none;
	}

	.vvp-svh {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 100svh;
		z-index: 2147483647;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: center;
		pointer-events: none;
	}

	.vvp-edge {
		width: 100%;
		padding: 4px 8px;
		font: 700 12px/1.3 monospace;
		text-align: center;
		color: #fff;
	}

	.vvp-blue {
		background: rgba(0, 90, 255, 0.88);
	}

	.vvp-red {
		width: 70%;
		background: rgba(255, 0, 0, 0.88);
	}

	.vvp-green {
		width: 40%;
		background: rgba(0, 170, 60, 0.92);
	}

	.vvp-panel {
		position: fixed;
		top: env(safe-area-inset-top, 0px);
		left: 0;
		right: 0;
		z-index: 2147483647;
		padding: 6px 8px;
		background: rgba(0, 0, 0, 0.82);
		color: #0f0;
		font: 600 11px/1.4 monospace;
		word-break: break-all;
	}

	.vvp-panel b {
		color: #ff0;
	}

	.vvp-delta {
		color: #f90;
	}

	.vvp-ua {
		margin-top: 2px;
		color: #888;
		font-size: 9px;
	}

	.vvp-close {
		display: block;
		margin-bottom: 4px;
		padding: 2px 6px;
		border: 1px solid #0f0;
		border-radius: 4px;
		background: transparent;
		color: #0f0;
		font: inherit;
	}
</style>
