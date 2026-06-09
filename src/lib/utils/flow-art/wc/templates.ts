// WC per-market artwork — resolver-driven scene templates.
//
// Two deterministic compositions matched to the prototype artwork
// briefs, drawn in the same blocky editorial register as the curated
// recipes (compose `WcHelpers`, fixed-ink figures over a palette-token
// backdrop). Each takes a per-render `Rng` (seeded off the market id by
// the caller) so the same market always renders the same scene while
// tiny details (motion-line spread, lunge offset) vary between markets.
//
//   kit-clash       — "Two blocky kit figures clashing … motion lines,
//                      {A}-colours vs {B}-colours". Two busts angled
//                      toward each other, each in its nation's kit, with
//                      speed lines sweeping between them.
//   qualify-bracket — "Forward bracket arrow / open door with the {A}
//                      crest-block — {A}-colours". A single nation
//                      crest-block advancing through a forward bracket
//                      arrow.
//
// Coordinate space is the WC band's 280×100 (see `wc/render.ts`).

import type { WCKit } from '$lib/constants/flow-art-wc.constants';
import type { Rng } from '$lib/utils/flow-art/types';
import type { WcHelpers } from '$lib/utils/flow-art/wc/helpers';
import type { WcResolvedTemplate } from '$lib/utils/flow-art/wc/resolve-template';

// Pick a readable ink for a face/figure plane sitting on a kit colour.
// The figure layer uses fixed inks (see `wcFace`) so this only tunes
// the kit shadow — a darker shade of the primary so a light kit (cream
// / white) doesn't get a near-black shadow plane.
const shadeDown = (hex: string): string => {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex);

	if (!m) {
		return '#1F1A14';
	}

	const n = parseInt(m[1], 16);
	const r = Math.round(((n >> 16) & 0xff) * 0.62);
	const g = Math.round(((n >> 8) & 0xff) * 0.62);
	const b = Math.round((n & 0xff) * 0.62);

	return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
};

// kit-clash — two angled busts, each in its nation kit, motion lines
// sweeping between them. The figures lean toward each other; a thin
// diagonal split backdrop separates the two colour worlds.
const kitClash = ({
	h,
	g,
	teamA,
	teamB
}: {
	h: WcHelpers;
	g: Rng;
	teamA: WCKit;
	teamB: WCKit;
}): string => {
	const { p } = h;

	// Backdrop — a hard diagonal splitting A's world (left) from B's
	// (right), washed by the palette base so it recolours per theme.
	let s = `<rect width="280" height="100" fill="${p.bg}"/>`;
	s += `<polygon points="0,0 150,0 110,100 0,100" fill="${teamA.primary}" opacity="0.30"/>`;
	s += `<polygon points="150,0 280,0 280,100 110,100" fill="${teamB.primary}" opacity="0.30"/>`;
	s += `<rect width="280" height="100" fill="${p.base}" opacity="0.34"/>`;

	// Motion lines sweeping across the seam between the two figures.
	const lineCount = g.int(4, 6);

	for (let i = 0; i < lineCount; i++) {
		const y = 30 + i * (40 / lineCount) + g.range(-2, 2);
		const x1 = 96 + g.range(-6, 4);
		const x2 = 184 + g.range(-4, 6);
		s += `<line x1="${x1.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${(y + g.range(-3, 3)).toFixed(1)}" stroke="${p.fg}" stroke-width="0.6" opacity="0.32"/>`;
	}

	// Left figure (team A) leaning right; right figure (team B) leaning
	// left — a small rotation toward the seam sells the "lunging past"
	// clash without a bespoke figure pose.
	s += `<g transform="rotate(6 92 56)">`;
	s += h.wcFace({
		cx: 92,
		cy: 48,
		skin: g.pick(['umber', 'olive', 'almond', 'sand', 'bronze', 'mahog'] as const),
		hair: g.pick(['jet', 'charcoal', 'brown', 'auburn', 'blonde'] as const),
		hairStyle: g.pick(['short', 'curly', 'cap'] as const),
		shirt: teamA.primary,
		shirtShadow: shadeDown(teamA.primary),
		stripe: teamA.secondary,
		emotion: 'focus'
	});
	s += `</g>`;

	s += `<g transform="rotate(-6 188 56)">`;
	s += h.wcFace({
		cx: 188,
		cy: 48,
		skin: g.pick(['umber', 'olive', 'almond', 'sand', 'bronze', 'mahog'] as const),
		hair: g.pick(['jet', 'charcoal', 'brown', 'auburn', 'blonde'] as const),
		hairStyle: g.pick(['short', 'curly', 'cap'] as const),
		shirt: teamB.primary,
		shirtShadow: shadeDown(teamB.primary),
		stripe: teamB.secondary,
		emotion: 'anticipation'
	});
	s += `</g>`;

	// Ball at the seam, low, where the two lunges meet.
	s += h.ballProp({ cx: 140, cy: 78, r: 6 });

	return s;
};

// qualify-bracket — a single nation crest-block advancing through a
// forward bracket arrow (the "open door / forward bracket" brief). The
// crest-block is the nation's two-colour split; the arrow is drawn in
// the palette foreground so it recolours per theme.
const qualifyBracket = ({
	h,
	g,
	teamA,
	uid
}: {
	h: WcHelpers;
	g: Rng;
	teamA: WCKit;
	uid: string;
}): string => {
	const { p } = h;

	let s = `<rect width="280" height="100" fill="${p.bg}"/>`;
	s += `<rect width="280" height="100" fill="${p.base}" opacity="0.45"/>`;

	// Forward bracket — two converging rails opening toward the right,
	// suggesting a knockout bracket / an open door the team advances
	// through. Rails in palette fg so they read on any theme.
	s += `<path d="M 150 16 L 214 50 L 150 84" fill="none" stroke="${p.fg}" stroke-width="1.4" opacity="0.55"/>`;
	s += `<line x1="150" y1="50" x2="214" y2="50" stroke="${p.fg}" stroke-width="1.4" opacity="0.55"/>`;
	// Arrow head at the far end.
	s += `<polygon points="214,50 224,46 224,54" fill="${p.fg}" opacity="0.7"/>`;
	// Faint trailing rails for depth.
	s += `<line x1="124" y1="50" x2="150" y2="50" stroke="${p.fg}" stroke-width="0.8" opacity="0.30"/>`;

	// Crest-block — a rounded shield in the nation's split colours,
	// nudged left of the bracket so it reads as "entering" it.
	const cx = 78;
	const cy = 50;
	// Deterministic, render-scoped id (not random): SVG `defs` ids are
	// document-scoped, so a random id could collide across FlowArtFrames on the
	// same page and make `clip-path` reference the wrong path. `uid` is unique
	// per render.
	const crestId = `wccrest-${uid}`;
	s += `<defs><clipPath id="${crestId}"><path d="M ${cx - 22} ${cy - 26} L ${cx + 22} ${cy - 26} L ${cx + 22} ${cy + 8} Q ${cx + 22} ${cy + 26} ${cx} ${cy + 30} Q ${cx - 22} ${cy + 26} ${cx - 22} ${cy + 8} Z"/></clipPath></defs>`;
	s += `<g clip-path="url(#${crestId})">`;
	s += `<rect x="${cx - 22}" y="${cy - 26}" width="44" height="56" fill="${teamA.primary}"/>`;
	s += `<polygon points="${cx - 22},${cy - 26} ${cx + 22},${cy - 26} ${cx + 22},${cy + 30} Z" fill="${teamA.secondary}"/>`;
	s += `</g>`;
	// Crest outline.
	s += `<path d="M ${cx - 22} ${cy - 26} L ${cx + 22} ${cy - 26} L ${cx + 22} ${cy + 8} Q ${cx + 22} ${cy + 26} ${cx} ${cy + 30} Q ${cx - 22} ${cy + 26} ${cx - 22} ${cy + 8} Z" fill="none" stroke="${p.fg}" stroke-width="0.8" opacity="0.5"/>`;
	// A small star/pip on the crest for a touch of detail (varies in y).
	const pipY = cy - 10 + g.range(-3, 3);
	s += `<circle cx="${cx}" cy="${pipY.toFixed(1)}" r="3" fill="${p.bg}" opacity="0.55"/>`;

	return s;
};

/**
 * Render a resolved WC template into an SVG body fragment (no document
 * wrapper). `g` is a per-market seeded `Rng`; the caller seeds it off
 * the raw market id so the scene is stable per market.
 */
export const renderWcTemplate = ({
	template,
	h,
	g,
	uid
}: {
	template: WcResolvedTemplate;
	h: WcHelpers;
	g: Rng;
	/** Per-render unique id used to scope SVG `defs` ids so they can't collide
	 *  across FlowArtFrames on the same page. */
	uid: string;
}): string => {
	if (template.templateId === 'kit-clash' && template.teamB) {
		return kitClash({ h, g, teamA: template.teamA, teamB: template.teamB });
	}

	if (template.templateId === 'qualify-bracket') {
		return qualifyBracket({ h, g, teamA: template.teamA, uid });
	}

	// Unreachable for the implemented ids; an empty string lets the
	// caller fall through to its generic fallback rather than crash.
	return '';
};
