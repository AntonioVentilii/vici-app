<script lang="ts" module>
	export type SwipeSide = 'YES' | 'NO';

	export interface SwipeState {
		dragX: number;
		dragY: number;
		dragging: boolean;
		committed: SwipeSide | null;
		rotation: number;
		yesOpacity: number;
		noOpacity: number;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Shared swipe-physics primitive for prediction-card surfaces.
	 *
	 * Powers the swipe-left-NO / swipe-right-YES gesture used in
	 * `OnboardingFlow` first-call card and `Beat1bCard`. The
	 * primitive owns the pointer lifecycle + the kinematic state
	 * (`dragX`, `dragging`, `committed`) and yields a `SwipeState`
	 * snippet argument so the consumer can wire the same drift /
	 * rotation / YES+NO tint behaviour to whatever card markup it
	 * chooses to render.
	 *
	 *  - Pointer capture so a fast flick that exits the card bounds
	 *    still resolves cleanly via `pointerup`.
	 *  - `touch-action: pan-y` so vertical scroll on touch surfaces
	 *    keeps working — the card consumes horizontal drag only.
	 *  - Snaps back to (0,0) if the release is inside the threshold.
	 *  - On commit, the card flies off-screen via `commitTravelPx`
	 *    (default 520) so the consumer's transition can take over.
	 *  - `disabled` short-circuits all gestures.
	 */
	interface Props {
		/** Fires once when a side commits past the threshold. */
		onCommit?: (side: SwipeSide) => void;
		/** When true, no gestures are tracked. */
		disabled?: boolean;
		/** Horizontal travel (px) at which a commit fires. Default 80. */
		threshold?: number;
		/** Where the card flies off post-commit. Default 520. */
		commitTravelPx?: number;
		/** Card body. Receives current swipe state as a snippet arg. */
		children: Snippet<[SwipeState]>;
	}

	const {
		onCommit,
		disabled = false,
		threshold = 80,
		commitTravelPx = 520,
		children
	}: Props = $props();

	let dragX = $state(0);
	let dragY = $state(0);
	let dragging = $state(false);
	let committed = $state<SwipeSide | null>(null);
	let startX = 0;
	let startY = 0;

	const rotation = $derived(dragX / 18);
	const yesOpacity = $derived(committed === 'YES' ? 1 : Math.max(0, dragX / 70));
	const noOpacity = $derived(committed === 'NO' ? 1 : Math.max(0, -dragX / 70));

	const swipe: SwipeState = $derived({
		dragX,
		dragY,
		dragging,
		committed,
		rotation,
		yesOpacity,
		noOpacity
	});

	const commitSide = (side: SwipeSide) => {
		if (committed !== null) {
			return;
		}

		committed = side;
		dragging = false;
		dragX = side === 'YES' ? commitTravelPx : -commitTravelPx;
		dragY = 0;
		onCommit?.(side);
	};

	const handlePointerDown = (event: PointerEvent) => {
		if (committed !== null || disabled) {
			return;
		}

		if (event.currentTarget instanceof HTMLElement) {
			event.currentTarget.setPointerCapture(event.pointerId);
		}

		startX = event.clientX;
		startY = event.clientY;
		dragging = true;
	};

	const handlePointerMove = (event: PointerEvent) => {
		if (!dragging || committed !== null) {
			return;
		}

		dragX = event.clientX - startX;
		dragY = event.clientY - startY;
	};

	const handlePointerUp = () => {
		if (!dragging || committed !== null) {
			return;
		}

		dragging = false;

		if (dragX > threshold) {
			commitSide('YES');

			return;
		}

		if (dragX < -threshold) {
			commitSide('NO');

			return;
		}

		dragX = 0;
		dragY = 0;
	};
</script>

<div
	class="swipe-host"
	class:is-disabled={disabled}
	aria-label="Swipe left for NO, right for YES"
	onpointercancel={handlePointerUp}
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={handlePointerUp}
	role="group"
>
	{@render children(swipe)}
</div>

<style lang="postcss">
	.swipe-host {
		touch-action: pan-y;
		user-select: none;
		-webkit-user-select: none;
	}

	.swipe-host.is-disabled {
		pointer-events: none;
	}
</style>
