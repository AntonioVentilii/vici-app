// Per-tag chip / accent color. These are the *brand* accents the UI
// uses for tag chips, tabs, and hover affordances — NOT the same as
// the `hot` highlight inside the generative `flow-art` SVGs
// (`flow-art.utils.ts` PAL), which is palette- and state-dependent
// and intentionally diverges so the chip and the artwork read as two
// distinct moments.
//
// If you're tempted to fold this into FlowArt PAL: don't. Crypto's
// chip is brand-orange `#F7931A`; its artwork "hot" is laser-purple.
// Sports chip is mint; sports artwork hot is sunset orange. Etc. The
// only happy accident is macro (`#7EB6FF` in both).

const TAG_COLORS: Record<string, string> = {
	macro: '#7EB6FF',
	crypto: '#F7931A',
	politics: '#FF6B6B',
	tech: '#B49CFF',
	sports: '#6FE0B6',
	culture: '#FFB066'
};

export const tagColor = (tag: string): string => TAG_COLORS[tag.toLowerCase()] ?? '#E2B842';
