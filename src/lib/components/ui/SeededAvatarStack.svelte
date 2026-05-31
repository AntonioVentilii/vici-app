<script lang="ts">
	/**
	 * Stack of overlapping circular avatars, each tinted by a stable
	 * hue derived from its seed string. Used as decorative social-proof
	 * on the FlowCard front face and the landing-page hero deck — both
	 * surfaces want four faceless circles that read as a crowd without
	 * exposing real user data.
	 *
	 * The default seed roster (`augustus / cassandra / nero / livia`)
	 * matches the canonical four the landing surface ships with, so
	 * tunnelling a deck card from landing into Flow keeps the same
	 * visual palette. Callers can override `seeds` for surfaces that
	 * want a different colour spread.
	 */

	interface Props {
		/** Seed strings — one per avatar. Order is preserved. */
		seeds?: ReadonlyArray<string>;
		/** Outer diameter in pixels. Default 22 — the compact size the
		 *  social-proof row reads cleanly at. */
		size?: number;
		/** Border colour drawn between adjacent avatars so the
		 *  overlap reads cleanly. Defaults to the elevated bg token. */
		borderColor?: string;
	}

	const DEFAULT_SEEDS = ['augustus', 'cassandra', 'nero', 'livia'] as const;

	const {
		seeds = DEFAULT_SEEDS,
		size = 22,
		borderColor = 'var(--bg-elevated, var(--bg-surface))'
	}: Props = $props();

	// Stable per-seed hue in the 0..359 range. Pattern matches the
	// landing-side helper byte-for-byte so cards reused across surfaces
	// land on the identical colour.
	const hueFor = (s: string): number => {
		if (s.length < 2) {
			return s.charCodeAt(0) * 31;
		}

		return (s.charCodeAt(0) * 31 + s.charCodeAt(1)) % 360;
	};

	const overlap = $derived(Math.round(size * 0.36));
</script>

<div class="seeded-avatar-stack" aria-hidden="true">
	{#each seeds as s, i (s)}
		<span
			style:width="{size}px"
			style:height="{size}px"
			style:margin-left={i === 0 ? '0' : `-${overlap}px`}
			style:z-index={seeds.length - i}
			style:border={`1.5px solid ${borderColor}`}
			style:background="linear-gradient(135deg, oklch(0.32 0.06 {hueFor(s)}), oklch(0.18 0.04 {hueFor(
				s
			)}))"
			class="seeded-avatar"
		></span>
	{/each}
</div>

<style lang="postcss">
	.seeded-avatar-stack {
		display: inline-flex;
		align-items: center;
	}

	.seeded-avatar {
		display: inline-flex;
		border-radius: var(--r-pill);
	}
</style>
