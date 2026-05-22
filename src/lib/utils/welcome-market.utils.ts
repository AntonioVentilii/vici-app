// Helpers for the public `/welcome` landing surfaces. These are NOT
// real market data — the landing grid needs plausible-looking numbers
// for static fixtures, and two separate components were each rolling
// their own seeded counter. Centralised here so the seeding strategy
// (and any future tuning) lives in one place.

/**
 * Deterministic faux caller count for a demo market. Same `id`
 * always yields the same number, so re-renders are stable. `base`
 * is the floor, `span` is the additive range. `whichChar` picks
 * which character of the id seeds the hash — `first` keeps the
 * grid-card spread wide; `last` is used by FlowFeature to get a
 * tighter band for the active-deck demo.
 */
export const previewCallerCount = ({
	id,
	base,
	span,
	whichChar = 'last',
	multiplier = 137
}: {
	id: string;
	base: number;
	span: number;
	whichChar?: 'first' | 'last';
	multiplier?: number;
}): number => {
	const charIndex = whichChar === 'first' ? 0 : id.length - 1;
	const seed = id.charCodeAt(charIndex);

	return base + ((seed * multiplier) % span);
};
