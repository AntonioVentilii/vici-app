<script lang="ts">
	/**
	 * Verbatim port of the prototype's `LandingAvatarStack`
	 * (`landing.jsx:639-658`). Four overlapping circles seeded from
	 * `augustus / cassandra / nero / livia` — same seeds as the
	 * prototype.
	 */
	const seeds = ['augustus', 'cassandra', 'nero', 'livia'] as const;

	const hueFor = (s: string): number => (s.charCodeAt(0) * 31 + s.charCodeAt(1)) % 360;
</script>

<div style="display:inline-flex;">
	{#each seeds as s, i (s)}
		<span
			style="
				margin-left: {i === 0 ? '0' : '-8px'};
				z-index: {4 - i};
				width: 22px; height: 22px; border-radius: 999px;
				display: inline-flex; align-items: center; justify-content: center;
				font-size: 9px; font-weight: 700; color: var(--fg);
				border: 1.5px solid var(--bg-elevated);
				background: linear-gradient(135deg, oklch(0.32 0.06 {hueFor(s)}), oklch(0.18 0.04 {hueFor(s)}));
			"
		>
			{s.slice(0, 2).toUpperCase()}
		</span>
	{/each}
</div>
