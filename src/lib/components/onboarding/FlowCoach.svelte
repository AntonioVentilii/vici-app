<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * FlowCoach — first-run gesture coach overlay shown above the deck.
	 * Cycles through five hints (NO / YES / SKIP / TAP / IDLE) on a
	 * timer-driven phase machine. Every phase tags `.flow-card` and
	 * `.ob-card` elements with `data-coach-phase` so the cards drift
	 * in sympathy via the matching CSS in `app.css`
	 * (`.flow-card[data-coach-phase]`). Phase 3 flips the card to its
	 * back face by toggling `is-flipped`; phase 4 cleans up and returns
	 * control. Dismisses on any pointer-down; persists dismissal in
	 * `localStorage` so the coach is shown at most once per surface per
	 * device.
	 */
	interface Props {
		surface?: 'flow' | 'onboarding';
	}

	const { surface = 'flow' }: Props = $props();

	const storageKey = $derived(
		`vici.coach-${surface === 'onboarding' ? 'onboarding-seen' : 'flow-seen'}`
	);

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

	// Phase timeline (ms): 0 = mount, 2200 NO, 4400 YES, 6400 TAP-flip,
	// 8800 IDLE. The IDLE beat lingers `IDLE_LINGER_MS` then auto-
	// dismisses so the surface never sits there blocked. Tweak this if
	// the coach feels rushed or sticky.
	const IDLE_LINGER_MS = 2200;
	const IDLE_AUTO_DISMISS_MS = 8800 + IDLE_LINGER_MS;

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
			cards = Array.from(document.querySelectorAll('.flow-card, .ob-card'));
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
			// Auto-dismiss the IDLE ("your turn ⚡") hint after a short
			// lingering beat so the coach overlay never sits there blocking
			// the surface indefinitely. The user can also dismiss earlier
			// via any pointer-down (see handler below).
			timers.push(setTimeout(() => dismiss(), IDLE_AUTO_DISMISS_MS));
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

{#if visible}
	<div
		class="flow-coach"
		aria-label={t({ locale: $localeStore, key: 'flow.coach.aria' })}
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
