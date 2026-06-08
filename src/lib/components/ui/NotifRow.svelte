<script lang="ts">
	import { X } from '@lucide/svelte/icons';
	import { notificationKindConfig } from '$lib/constants/notification-kind.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import type { InboxNotification } from '$lib/types/inbox';
	import { haptic } from '$lib/utils/haptics.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { prefersReducedMotion } from '$lib/utils/reduced-motion.utils';

	/**
	 * NotifRow — a single notification card. Tap the body to open it (deep-link
	 * resolved by the parent), swipe left past the threshold to dismiss, or tap
	 * the unread dot to mark it read in place without navigating away.
	 *
	 * Pointer events cover both touch and mouse-drag. A drag that crossed the
	 * move slop suppresses the tap so swiping never accidentally opens the row.
	 *
	 * A11y: the card body is a real `<button>`; the dot is a labelled
	 * `role="button"` with a 28px box that, nested in the row's padding, clears
	 * a 44px effective target, plus keyboard support. Decorative icons are
	 * `aria-hidden`.
	 */
	interface Props {
		notification: InboxNotification;
		onOpen: (notification: InboxNotification) => void;
		onDismiss: (notification: InboxNotification) => void;
		onMarkRead: (notification: InboxNotification) => void;
	}

	const { notification, onOpen, onDismiss, onMarkRead }: Props = $props();

	// Swipe geometry mirrors the source: 84px past which a release dismisses,
	// capped at a 132px pull; a right-pull is heavily resisted (×0.18) so the
	// row only ever wants to go left. The exit collapse runs ~230ms.
	const SWIPE_THRESHOLD_PX = 84;
	const MAX_PULL_PX = 132;
	const RIGHT_PULL_RESISTANCE = 0.18;
	const MOVE_SLOP_PX = 4;
	const EXIT_MS = 230;

	const KindIcon = $derived(notificationKindConfig(notification.kind).icon);

	let dx = $state(0);
	let leaving = $state(false);
	let dragging = $state(false);
	let startX: number | undefined;
	let moved = false;

	const armed = $derived(dx <= -SWIPE_THRESHOLD_PX);

	const onPointerDown = (event: PointerEvent) => {
		startX = event.clientX;
		moved = false;
		dragging = true;
	};

	const onPointerMove = (event: PointerEvent) => {
		if (startX === undefined) {
			return;
		}

		const delta = event.clientX - startX;

		if (Math.abs(delta) > MOVE_SLOP_PX) {
			moved = true;
		}

		dx = delta < 0 ? Math.max(delta, -MAX_PULL_PX) : delta * RIGHT_PULL_RESISTANCE;
	};

	const onPointerUp = () => {
		if (startX === undefined) {
			return;
		}

		startX = undefined;
		dragging = false;

		if (dx <= -SWIPE_THRESHOLD_PX) {
			leaving = true;
			haptic('firm-tap');

			if (prefersReducedMotion()) {
				onDismiss(notification);

				return;
			}

			setTimeout(() => onDismiss(notification), EXIT_MS);

			return;
		}

		dx = 0;
	};

	const onTap = (event: MouseEvent) => {
		// A drag that crossed the slop suppresses the tap-to-open.
		if (moved) {
			event.preventDefault();

			return;
		}

		onOpen(notification);
	};

	const markRead = () => {
		haptic('light-tap');
		onMarkRead(notification);
	};

	const onDotKeyDown = (event: KeyboardEvent) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			event.stopPropagation();
			markRead();
		}
	};
</script>

<div class="notif-swipe" class:is-leaving={leaving}>
	<div class="notif-swipe-bg" class:is-armed={armed} aria-hidden="true">
		<X size={16} strokeWidth={1.8} />
	</div>
	<button
		style:transform={`translateX(${dx}px)`}
		style:transition={dragging ? 'none' : `transform ${EXIT_MS}ms var(--ease-vici)`}
		class="notif-row"
		class:is-unread={notification.unread}
		onclick={onTap}
		onpointercancel={onPointerUp}
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		type="button"
	>
		<span class="notif-row-icon" aria-hidden="true">
			<KindIcon size={16} strokeWidth={1.8} />
		</span>
		<span class="notif-row-copy">
			<span class="notif-row-title">{notification.title}</span>
			<span class="notif-row-body">{notification.body}</span>
			<span class="notif-row-when num">{notification.when}</span>
		</span>
		{#if notification.unread}
			<span
				class="notif-dot-tap"
				aria-label={t({ locale: $localeStore, key: 'notifications.mark_read_one' })}
				onclick={(event) => {
					event.stopPropagation();
					markRead();
				}}
				onkeydown={onDotKeyDown}
				onpointerdown={(event) => event.stopPropagation()}
				role="button"
				tabindex="0"
			>
				<span class="notif-unread-dot"></span>
			</span>
		{/if}
	</button>
</div>

<style lang="postcss">
	/* Swipe-to-dismiss row + mark-read dot. The armed red wash and the
	   collapse-on-leaving timings are ported 1:1 from the source `.notif-swipe`
	   block; colours are token-based so they adapt across themes. */
	.notif-swipe {
		position: relative;
		border-radius: var(--r-14, 14px);
		overflow: hidden;
		max-height: 200px;
		transition:
			max-height 0.24s var(--ease-vici),
			opacity 0.24s var(--ease-vici),
			margin 0.24s var(--ease-vici);
	}

	.notif-swipe.is-leaving {
		max-height: 0;
		opacity: 0;
		margin-top: -6px;
		pointer-events: none;
	}

	.notif-swipe-bg {
		position: absolute;
		inset: 0;
		border-radius: var(--r-14, 14px);
		background: color-mix(in srgb, var(--color-danger) 16%, transparent);
		display: flex;
		align-items: center;
		justify-content: flex-end;
		padding-right: 20px;
		color: var(--color-danger);
		transition:
			background 0.14s var(--ease-vici),
			color 0.14s var(--ease-vici);
	}

	.notif-swipe-bg.is-armed {
		background: color-mix(in srgb, var(--color-danger) 32%, transparent);
		color: var(--parchment);
	}

	.notif-row {
		position: relative;
		z-index: 1;
		will-change: transform;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 0.625rem;
		align-items: flex-start;
		width: 100%;
		padding: 0.875rem;
		border-radius: var(--r-14, 14px);
		border: 1px solid var(--border-base);
		background: var(--bg-surface);
		box-shadow: var(--shadow-card);
		color: var(--text-base);
		text-align: left;
		appearance: none;
		cursor: pointer;
		touch-action: pan-y;
	}

	.notif-row.is-unread {
		border-color: color-mix(in srgb, var(--accent) 30%, var(--border-base));
		background:
			linear-gradient(
				color-mix(in srgb, var(--accent) 5.5%, transparent),
				color-mix(in srgb, var(--accent) 5.5%, transparent)
			),
			var(--bg-surface);
	}

	.notif-row-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		flex: 0 0 auto;
		border-radius: var(--r-8, 8px);
		background: color-mix(in srgb, var(--parchment) 6%, transparent);
		color: var(--accent);
	}

	.notif-row-copy {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}

	.notif-row-title {
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--text-base);
	}

	.notif-row-body {
		font-size: var(--t-12);
		color: var(--text-muted);
	}

	.notif-row-when {
		margin-top: 0.125rem;
		font-size: var(--t-11);
		color: var(--text-muted);
	}

	/* 28×28 tap zone, nudged into the row's padding so the effective target
	   (zone + surrounding padding) clears the 44px minimum. */
	.notif-dot-tap {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		margin: -6px -8px 0 0;
		border-radius: 50%;
		flex: 0 0 auto;
		cursor: pointer;
	}

	.notif-dot-tap:hover {
		background: color-mix(in srgb, var(--accent) 12%, transparent);
	}

	.notif-unread-dot {
		width: 7px;
		height: 7px;
		border-radius: var(--r-pill, 999px);
		background: var(--accent);
	}

	@media (prefers-reduced-motion: reduce) {
		.notif-swipe {
			transition: none;
		}
	}
</style>
