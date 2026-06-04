<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * FlowCoach — first-run gesture coach overlay. Cycles through five
	 * hints (NO / YES / SKIP / TAP / IDLE) on a timer-driven phase
	 * machine. Every phase tags the surface's card elements with
	 * `data-coach-phase` so they drift in sympathy via the matching CSS
	 * in `app.css`. Phase 3 toggles `is-flipped`; on a card with
	 * front/back faces (the deck) that reveals the detail back, and on
	 * the faceless onboarding card it degrades to a zoom-and-de-blur.
	 * The IDLE beat ("your turn")
	 * then lingers until the user acts. Dismisses on the first
	 * pointer-down, or when the user presses Escape / Enter.
	 *
	 * `surface` selects which card the coach rides on and which
	 * dismissal flag persists in `localStorage` (shown at most once per
	 * device, per surface):
	 *   - `flow` (default) → the in-product deck (`.flow-card`,
	 *     `vici.coach-flow-seen`).
	 *   - `onboarding` → the first-call card (`.ob-card`,
	 *     `vici.coach-onboarding-seen`).
	 */
	interface Props {
		surface?: 'flow' | 'onboarding';
	}

	const { surface = 'flow' }: Props = $props();

	const storageKey = $derived(
		surface === 'onboarding' ? 'vici.coach-onboarding-seen' : 'vici.coach-flow-seen'
	);
	const cardSelector = $derived(surface === 'onboarding' ? '.ob-card' : '.flow-card');

	const readSeen = (): boolean => {
		if (!browser) {
			return false;
		}

		try {
			return Boolean(localStorage.getItem(storageKey));
		} catch {
			return false;
		}
	};

	let visible = $state(!readSeen());
	let phase = $state(0);

	// Phase timeline: 0=NO shown immediately, 1=YES @2200ms,
	// 2=SKIP @4400ms, 3=TAP @6400ms (card flip), 4=IDLE @8800ms.
	// The IDLE beat ("your turn") lingers until the user acts;
	// pointer-down or Escape/Enter dismisses the coach for good.
	const hints = [
		{ key: 'flow.coach.hint_no', cls: 'no' },
		{ key: 'flow.coach.hint_yes', cls: 'yes' },
		{ key: 'flow.coach.hint_skip', cls: 'skip' },
		{ key: 'flow.coach.hint_tap', cls: 'tap' },
		{ key: 'flow.coach.hint_idle', cls: 'idle' }
	] as const;

	let cards: Element[] = [];
	let timers: ReturnType<typeof setTimeout>[] = [];
	let raf: number | null = null;
	let pointerHandler: (() => void) | null = null;

	const handleKeydown = (e: KeyboardEvent) => {
		if (!visible) {
			return;
		}

		if (e.key === 'Escape' || e.key === 'Enter') {
			e.stopPropagation();
			dismiss();
		}
	};

	const applyPhase = (p: number) => {
		cards.forEach((c) => c.setAttribute('data-coach-phase', String(p)));
		phase = p;
	};

	const cleanup = () => {
		timers.forEach(clearTimeout);
		timers = [];

		if (raf !== null) {
			cancelAnimationFrame(raf);
			raf = null;
		}

		cards.forEach((c) => {
			c.removeAttribute('data-coach-phase');
			c.classList.remove('is-flipped');
		});

		if (pointerHandler !== null && browser) {
			window.removeEventListener('pointerdown', pointerHandler);
			pointerHandler = null;
		}
	};

	const dismiss = () => {
		if (browser) {
			try {
				localStorage.setItem(storageKey, '1');
			} catch {
				// localStorage write blocked — accept the loss; the coach
				// will reappear next session for this device.
			}
		}

		cleanup();
		visible = false;
	};

	onMount(() => {
		if (!visible || !browser) {
			return;
		}

		raf = requestAnimationFrame(() => {
			cards = Array.from(document.querySelectorAll(cardSelector));
			applyPhase(0);
			timers.push(setTimeout(() => applyPhase(1), 2200));
			timers.push(setTimeout(() => applyPhase(2), 4400));
			timers.push(
				setTimeout(() => {
					applyPhase(3);
					cards.forEach((c) => c.classList.add('is-flipped'));
				}, 6400)
			);
			timers.push(
				setTimeout(() => {
					cards.forEach((c) => c.classList.remove('is-flipped'));
					cards.forEach((c) => c.removeAttribute('data-coach-phase'));
					phase = 4;
				}, 8800)
			);
		});

		pointerHandler = () => dismiss();
		window.addEventListener('pointerdown', pointerHandler, { once: true });
	});

	onDestroy(() => {
		cleanup();
	});

	const current = $derived(hints[phase] ?? hints[0]);
	const text = $derived(t({ locale: $localeStore, key: `${current.key}.txt` }));
	const accent = $derived(t({ locale: $localeStore, key: `${current.key}.acc` }));
</script>

<svelte:window onkeydown={handleKeydown} />

{#if visible}
	<div
		class="flow-coach"
		aria-label={t({ locale: $localeStore, key: 'flow.coach.aria' })}
		aria-modal="false"
		role="dialog"
	>
		{#key phase}
			<div class="flow-coach-center is-{current.cls}">
				<div class="flow-coach-line">
					<span class="flow-coach-text">{text}</span>
					<span class="flow-coach-accent">{accent}</span>
				</div>
			</div>
		{/key}
	</div>
{/if}
