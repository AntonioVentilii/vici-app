// Flow Mode generative artwork — deterministic SVG marks per market.
//
// Six per-category visual languages (macro / crypto / sports /
// politics / tech / culture) × three states (neutral / won / lost).
// Same `(category, marketId, state)` triplet always renders the
// identical composition; the seed flows through a FNV-1a hash +
// mulberry32 PRNG so output is byte-stable across reloads.
//
// Returns SVG strings — components mount via {@html ...}. No DOM
// access, no I/O — pure helper.

export type FlowArtCategory = 'macro' | 'crypto' | 'sports' | 'politics' | 'tech' | 'culture';

export type FlowArtState = 'neutral' | 'won' | 'lost';

export const FLOW_ART_CATEGORIES: readonly FlowArtCategory[] = [
	'macro',
	'crypto',
	'sports',
	'politics',
	'tech',
	'culture'
] as const;

export const FLOW_ART_STATES: readonly FlowArtState[] = ['neutral', 'won', 'lost'] as const;

export interface FlowArtPalette {
	bg: string;
	base: string;
	ink: string;
	accent: string;
	hot: string;
	dim: string;
	fg: string;
	// `culture` is the only category whose palette ships an additional
	// six-colour ink set. All other categories leave it undefined.
	inks?: readonly string[];
}

type CategoryPalettes = Record<FlowArtState, FlowArtPalette>;

export interface FlowArtRenderOptions {
	category: FlowArtCategory;
	// Stable per-market seed. Pass `market.id` (or any deterministic
	// string / number — strings are FNV-1a hashed first).
	seed: string | number;
	state?: FlowArtState;
	// Output viewBox is always 0 0 100 100; `size` controls the
	// rendered width / height attributes (px). Spec checks 80 / 140 / 220.
	size?: number;
	// When true, draws an additional inset stroke frame inside the
	// composition. Off by default; FlowCard layers a separate frame.
	frame?: boolean;
}

// =============================================================
//   Hash + PRNG
// =============================================================

const hashStr = (s: string): number => {
	let h = 0x811c9dc5;

	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) | 0;
	}

	return h >>> 0;
};

const mulberry32 = (seed: number): (() => number) => {
	let a = seed >>> 0;

	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

interface Rng {
	r: () => number;
	range: (lo: number, hi: number) => number;
	pick: <T>(arr: readonly T[]) => T;
	int: (lo: number, hi: number) => number;
	chance: (p: number) => boolean;
}

// Renderer protocol — every category renderer takes the same args
// so the dispatch table types cleanly. Object form (vs positional) per
// the repo's `prefer-object-params` convention.
//
// `uid` is a stable per-render suffix appended to every SVG `<defs>`
// id (gradients, filters, etc.) so multiple FlowArtFrames on the same
// document never collide on `url(#mwash)` lookups. Derived from the
// hash of `${category}::${seed}::${state}` so identical inputs reuse
// the same uid (the renderer is still deterministic).
interface RenderArgs {
	rng: Rng;
	p: FlowArtPalette;
	state: FlowArtState;
	uid: string;
}

const makeRng = (seed: string | number): Rng => {
	const r = mulberry32(typeof seed === 'string' ? hashStr(seed) : seed);

	// `prefer-object-params` is intentionally relaxed for `range` and
	// `int` here — positional `(lo, hi)` is the standard PRNG / math
	// signature and is called thousands of times across the six
	// category renderers. An object form would hurt readability and
	// generate per-call allocations on every random draw.
	return {
		r,
		// eslint-disable-next-line local-rules/prefer-object-params
		range: (lo, hi) => lo + r() * (hi - lo),
		pick: (arr) => arr[Math.floor(r() * arr.length)],
		// eslint-disable-next-line local-rules/prefer-object-params
		int: (lo, hi) => lo + Math.floor(r() * (hi - lo + 1)),
		chance: (p) => r() < p
	};
};

// =============================================================
//   Palettes — six categories × three states
// =============================================================

const PAL: Record<FlowArtCategory, CategoryPalettes> = {
	macro: {
		neutral: {
			bg: '#0E1422',
			base: '#1B2742',
			ink: '#2D3E66',
			accent: '#E2B842',
			hot: '#7EB6FF',
			dim: '#3A4C70',
			fg: '#F2ECDC'
		},
		won: {
			bg: '#15203A',
			base: '#23355E',
			ink: '#3C5793',
			accent: '#FFD06A',
			hot: '#A8CFFF',
			dim: '#5A78B5',
			fg: '#FFF6E1'
		},
		lost: {
			bg: '#10131A',
			base: '#1C212B',
			ink: '#2C3340',
			accent: '#6E6A5C',
			hot: '#4A5366',
			dim: '#22272F',
			fg: '#9C9890'
		}
	},
	crypto: {
		neutral: {
			bg: '#0A0A12',
			base: '#1A0E2E',
			ink: '#3D1F66',
			accent: '#6FFFB3',
			hot: '#A86FFF',
			dim: '#0E1224',
			fg: '#F2ECDC'
		},
		won: {
			bg: '#0C1018',
			base: '#1E1338',
			ink: '#5430A0',
			accent: '#92FFC8',
			hot: '#C99CFF',
			dim: '#16193A',
			fg: '#F4FFE7'
		},
		lost: {
			bg: '#0D0D11',
			base: '#1A1A20',
			ink: '#2A2A33',
			accent: '#4F4F58',
			hot: '#3D3D45',
			dim: '#15151A',
			fg: '#888A8E'
		}
	},
	sports: {
		neutral: {
			bg: '#1A0F0B',
			base: '#3A1A0F',
			ink: '#9F2A1A',
			accent: '#FF6B2C',
			hot: '#FFB066',
			dim: '#5A2418',
			fg: '#FAEEDB'
		},
		won: {
			bg: '#241510',
			base: '#5C2415',
			ink: '#D43820',
			accent: '#FF8744',
			hot: '#FFCE85',
			dim: '#8B3624',
			fg: '#FFF4DD'
		},
		lost: {
			bg: '#16110E',
			base: '#2B221E',
			ink: '#3F342E',
			accent: '#7A6453',
			hot: '#5C4E43',
			dim: '#352A24',
			fg: '#A89E92'
		}
	},
	politics: {
		neutral: {
			bg: '#0E1426',
			base: '#1E2C4D',
			ink: '#345285',
			accent: '#F2ECDC',
			hot: '#6F1C20',
			dim: '#2A3A60',
			fg: '#F2ECDC'
		},
		won: {
			bg: '#14213D',
			base: '#28406B',
			ink: '#4F73AB',
			accent: '#FFE1A8',
			hot: '#A6332E',
			dim: '#3B548C',
			fg: '#FFF8E1'
		},
		lost: {
			bg: '#0E1018',
			base: '#1B1F2A',
			ink: '#2C313E',
			accent: '#A4A096',
			hot: '#3D2A2C',
			dim: '#22262F',
			fg: '#9B978D'
		}
	},
	tech: {
		neutral: {
			bg: '#0E1116',
			base: '#1F242B',
			ink: '#3E4854',
			accent: '#4D8BFF',
			hot: '#ECF1F8',
			dim: '#262B33',
			fg: '#ECF1F8'
		},
		won: {
			bg: '#101620',
			base: '#1F2A3C',
			ink: '#3D5072',
			accent: '#6FA5FF',
			hot: '#FFFFFF',
			dim: '#2A3344',
			fg: '#FFFFFF'
		},
		lost: {
			bg: '#0D0F12',
			base: '#191C21',
			ink: '#2A2D32',
			accent: '#454953',
			hot: '#5E626A',
			dim: '#1E2126',
			fg: '#94989F'
		}
	},
	culture: {
		neutral: {
			bg: '#16110C',
			base: '#2A1F18',
			ink: '#6F4E2F',
			accent: '#E2B842',
			hot: '#C24A3D',
			dim: '#3B2C20',
			fg: '#F2ECDC',
			inks: ['#E2B842', '#C24A3D', '#7EB6FF', '#B49CFF', '#6FE0B6', '#FF8A4C']
		},
		won: {
			bg: '#1C160F',
			base: '#34281D',
			ink: '#8C6238',
			accent: '#FFD06A',
			hot: '#E25A47',
			dim: '#4D3A29',
			fg: '#FFF6E1',
			inks: ['#FFD06A', '#E25A47', '#A8CFFF', '#C99CFF', '#92FFC8', '#FFB066']
		},
		lost: {
			bg: '#12100D',
			base: '#1F1B16',
			ink: '#3B342B',
			accent: '#7C7368',
			hot: '#5C5249',
			dim: '#28241E',
			fg: '#A29C92',
			inks: ['#7C7368', '#5C5249', '#6E6A5C', '#928876', '#827870', '#A29C92']
		}
	}
};

// =============================================================
//   Helpers
// =============================================================

const deg = (d: number): number => (d * Math.PI) / 180;
// Standard math-helper signature `(a, b, t)` — `prefer-object-params`
// relaxed since `lerp` is called dozens of times per render and an
// object form would obscure the math.
// eslint-disable-next-line local-rules/prefer-object-params
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const svgOpen = (size: number): string =>
	`<svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" shape-rendering="geometricPrecision">`;

const svgClose = (): string => `</svg>`;

const bgRect = (p: FlowArtPalette): string => `<rect width="100" height="100" fill="${p.bg}"/>`;

const frameInset = ({ p, state }: { p: FlowArtPalette; state: FlowArtState }): string => {
	const stroke = state === 'won' ? p.accent : p.dim;
	const op = state === 'won' ? 0.45 : 0.2;

	return `<rect x="2" y="2" width="96" height="96" rx="6" fill="none" stroke="${stroke}" stroke-opacity="${op}" stroke-width="0.5"/>`;
};

// =============================================================
//   Category renderers
// =============================================================

// MACRO — concentric rings + horizontal atmospheric planes.
const renderMacro = ({ rng, p, state, uid }: RenderArgs): string => {
	const focals: ReadonlyArray<readonly [number, number]> = [
		[33, 38],
		[66, 38],
		[33, 66],
		[66, 66]
	];
	const [fx, fy] = focals[rng.int(0, focals.length - 1)];
	const ringCount = rng.int(3, 6);
	const maxR = rng.range(38, 52);
	const minR = rng.range(6, 11);

	const planeCount = rng.int(2, 3);
	const planes: { y: number; op: number; skew: number }[] = [];

	for (let i = 0; i < planeCount; i++) {
		const y = rng.range(15, 90);
		const op = rng.range(0.08, 0.18);
		const skew = rng.range(-3, 3);
		planes.push({ y, op, skew });
	}

	let s = '';
	s += `<defs>
      <radialGradient id="mwash-${uid}" cx="${fx}%" cy="${fy - 8}%" r="80%">
        <stop offset="0%" stop-color="${p.base}" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="${p.bg}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="mglow-${uid}" cx="50%" cy="50%" r="55%">
        <stop offset="0%" stop-color="${p.accent}" stop-opacity="${state === 'won' ? 0.65 : 0.35}"/>
        <stop offset="55%" stop-color="${p.accent}" stop-opacity="0.05"/>
        <stop offset="100%" stop-color="${p.accent}" stop-opacity="0"/>
      </radialGradient>
    </defs>`;
	s += `<rect width="100" height="100" fill="url(#mwash-${uid})"/>`;

	planes.forEach((pl) => {
		s += `<rect x="-5" y="${pl.y}" width="110" height="0.9" fill="${p.ink}" opacity="${pl.op}" transform="rotate(${pl.skew} 50 ${pl.y})"/>`;
	});

	for (let i = 0; i < ringCount; i++) {
		const r = lerp(minR, maxR, i / Math.max(1, ringCount - 1));
		const startA = rng.range(-30, 30);
		const sweepA = rng.range(140, 320);
		const x1 = fx + r * Math.cos(deg(startA));
		const y1 = fy + r * Math.sin(deg(startA));
		const x2 = fx + r * Math.cos(deg(startA + sweepA));
		const y2 = fy + r * Math.sin(deg(startA + sweepA));
		const largeArc = sweepA > 180 ? 1 : 0;
		const sw = i === ringCount - 1 ? 0.7 : 0.4;
		const stroke = i === ringCount - 1 ? p.hot : p.ink;
		const op = lerp(0.85, 0.3, i / ringCount);
		s += `<path d="M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}" stroke="${stroke}" stroke-width="${sw}" fill="none" opacity="${op}"/>`;
	}

	const fr = rng.range(14, 22);
	s += `<circle cx="${fx}" cy="${fy}" r="${fr}" fill="url(#mglow-${uid})"/>`;
	s += `<circle cx="${fx}" cy="${fy}" r="${fr}" fill="none" stroke="${p.accent}" stroke-width="${state === 'won' ? 1.0 : 0.7}" opacity="${state === 'won' ? 0.95 : 0.85}"/>`;
	s += `<circle cx="${fx}" cy="${fy}" r="${state === 'won' ? 2.6 : 1.6}" fill="${p.accent}" opacity="${state === 'won' ? 1 : 0.9}"/>`;

	if (state === 'lost') {
		s += `<line x1="${fx - fr - 4}" y1="${fy + fr / 2}" x2="${fx + fr + 4}" y2="${fy - fr / 2}" stroke="${p.bg}" stroke-width="2.4" opacity="0.85"/>`;
		s += `<rect width="100" height="100" fill="${p.bg}" opacity="0.32"/>`;
	} else if (state === 'won') {
		s += `<line x1="0" y1="${fy + 18}" x2="100" y2="${fy - 18}" stroke="${p.accent}" stroke-width="0.4" opacity="0.55"/>`;
	}

	return s;
};

// CRYPTO — angular shards + neon seam.
const renderCrypto = ({ rng, p, state, uid }: RenderArgs): string => {
	const shardCount = rng.int(3, 5);
	const cx = rng.range(40, 60);
	const cy = rng.range(40, 60);
	let s = '';
	s += `<defs>
      <linearGradient id="cgrad-${uid}" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="${p.base}" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="${p.bg}" stop-opacity="0.4"/>
      </linearGradient>
    </defs>`;
	s += `<rect width="100" height="100" fill="url(#cgrad-${uid})"/>`;

	for (let i = 0; i < 12; i++) {
		const y = i * 10 + rng.range(-3, 3);
		s += `<line x1="-10" y1="${y}" x2="110" y2="${y - 20}" stroke="${p.ink}" stroke-width="0.3" opacity="0.18"/>`;
	}

	const shards: { pts: [number, number][]; hot: boolean }[] = [];

	for (let i = 0; i < shardCount; i++) {
		const angle0 = rng.range(0, 360);
		const r0 = rng.range(12, 28);
		const px = cx + r0 * Math.cos(deg(angle0));
		const py = cy + r0 * Math.sin(deg(angle0));
		const verts = rng.int(3, 5);
		const radius = rng.range(8, 22);
		const pts: [number, number][] = [];
		const angOff = rng.range(0, 360);

		for (let v = 0; v < verts; v++) {
			const a = angOff + (360 / verts) * v + rng.range(-25, 25);
			const r = radius * rng.range(0.6, 1.0);
			pts.push([px + r * Math.cos(deg(a)), py + r * Math.sin(deg(a))]);
		}

		shards.push({ pts, hot: i === 0 });
	}

	shards.forEach((sh) => {
		const fill = sh.hot ? p.ink : p.base;
		const stroke = sh.hot ? p.accent : p.ink;
		const op = sh.hot ? 0.95 : 0.78;
		const path = `M ${sh.pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ')} Z`;
		s += `<path d="${path}" fill="${fill}" opacity="${op}" stroke="${stroke}" stroke-width="${sh.hot ? 1.0 : 0.5}" stroke-linejoin="miter"/>`;
	});

	const seamAngle = rng.range(-30, 60);
	const seamLen = rng.range(28, 46);
	const sx1 = cx - (seamLen / 2) * Math.cos(deg(seamAngle));
	const sy1 = cy - (seamLen / 2) * Math.sin(deg(seamAngle));
	const sx2 = cx + (seamLen / 2) * Math.cos(deg(seamAngle));
	const sy2 = cy + (seamLen / 2) * Math.sin(deg(seamAngle));
	s += `<line x1="${sx1}" y1="${sy1}" x2="${sx2}" y2="${sy2}" stroke="${p.accent}" stroke-width="${state === 'won' ? 1.1 : 0.7}" opacity="${state === 'won' ? 1 : 0.92}" stroke-linecap="round"/>`;
	s += `<line x1="${sx1}" y1="${sy1}" x2="${sx2}" y2="${sy2}" stroke="${p.accent}" stroke-width="${state === 'won' ? 4 : 2.6}" opacity="0.18" stroke-linecap="round"/>`;
	s += `<circle cx="${sx2}" cy="${sy2}" r="${state === 'won' ? 1.7 : 1.2}" fill="${p.accent}"/>`;

	s += `<polygon points="${(cx + 30).toFixed(1)},${(cy - 22).toFixed(1)} ${(cx + 36).toFixed(1)},${(cy - 18).toFixed(1)} ${(cx + 33).toFixed(1)},${(cy - 12).toFixed(1)}" fill="${p.hot}" opacity="${state === 'won' ? 0.7 : 0.5}"/>`;

	if (state === 'lost') {
		for (let i = 0; i < 10; i++) {
			const x = rng.range(15, 85);
			const y = rng.range(15, 85);
			const a = rng.range(0, 360);
			const l = rng.range(4, 10);
			s += `<line x1="${x}" y1="${y}" x2="${x + l * Math.cos(deg(a))}" y2="${y + l * Math.sin(deg(a))}" stroke="${p.dim}" stroke-width="0.4" opacity="0.7"/>`;
		}

		s += `<rect width="100" height="100" fill="${p.bg}" opacity="0.35"/>`;
	}

	return s;
};

// SPORTS — chevron motion.
const renderSports = ({ rng, p, state, uid }: RenderArgs): string => {
	let s = '';
	s += `<defs>
      <linearGradient id="swash-${uid}" x1="0" x2="1" y1="0.5" y2="0.5">
        <stop offset="0%" stop-color="${p.bg}" stop-opacity="1"/>
        <stop offset="100%" stop-color="${p.base}" stop-opacity="1"/>
      </linearGradient>
    </defs>`;
	s += `<rect width="100" height="100" fill="url(#swash-${uid})"/>`;

	const strokeAngle = rng.range(-25, 5);

	for (let i = 0; i < 8; i++) {
		const y = i * 14 + rng.range(-4, 4);
		const len = rng.range(35, 75);
		const x = rng.range(-10, 30);
		s += `<rect x="${x}" y="${y}" width="${len}" height="1" fill="${p.hot}" opacity="${rng.range(0.1, 0.22)}" transform="rotate(${strokeAngle} ${x + len / 2} ${y})"/>`;
	}

	const dir = rng.pick<{ p1: [number, number]; p2: [number, number]; p3: [number, number] }>([
		{ p1: [12, 80], p2: [50, 22], p3: [88, 80] },
		{ p1: [12, 22], p2: [50, 78], p3: [88, 22] },
		{ p1: [82, 12], p2: [22, 50], p3: [82, 88] },
		{ p1: [18, 12], p2: [78, 50], p3: [18, 88] }
	]);

	const offset = rng.range(8, 14);

	for (let t = 2; t >= 1; t--) {
		const o = t * offset;
		const trailDir = dir.p1[0] < dir.p2[0] ? -1 : 1;
		const sx = trailDir * (dir.p1[0] === dir.p3[0] ? 0 : o);
		const sy = dir.p1[1] === dir.p3[1] ? -o : 0;
		const op = 0.18 / t;
		const sw = 1.3 / t;
		s += `<path d="M ${dir.p1[0] + sx} ${dir.p1[1] + sy} L ${dir.p2[0] + sx} ${dir.p2[1] + sy} L ${dir.p3[0] + sx} ${dir.p3[1] + sy}" stroke="${p.accent}" stroke-width="${sw}" fill="none" opacity="${op}" stroke-linecap="round" stroke-linejoin="round"/>`;
	}

	s += `<path d="M ${dir.p1[0]} ${dir.p1[1]} L ${dir.p2[0]} ${dir.p2[1]} L ${dir.p3[0]} ${dir.p3[1]}" stroke="${p.accent}" stroke-width="${state === 'won' ? 3.2 : 2.4}" fill="none" opacity="${state === 'won' ? 1 : 0.95}" stroke-linecap="round" stroke-linejoin="round"/>`;
	s += `<circle cx="${dir.p2[0]}" cy="${dir.p2[1]}" r="${state === 'won' ? 2.6 : 1.8}" fill="${p.fg}" opacity="${state === 'won' ? 1 : 0.85}"/>`;

	if (state === 'won') {
		for (let i = 0; i < 14; i++) {
			const x = rng.range(0, 100);
			const y = rng.range(0, 100);
			s += `<circle cx="${x}" cy="${y}" r="${rng.range(0.3, 0.8)}" fill="${p.hot}" opacity="${rng.range(0.3, 0.55)}"/>`;
		}
	} else if (state === 'lost') {
		s += `<line x1="${dir.p2[0] - 4}" y1="${dir.p2[1] - 1}" x2="${dir.p2[0] + 4}" y2="${dir.p2[1] + 1}" stroke="${p.bg}" stroke-width="1.6" opacity="1"/>`;
		s += `<rect width="100" height="100" fill="${p.bg}" opacity="0.30"/>`;
	}

	return s;
};

// POLITICS — colonnade architecture.
const renderPolitics = ({ rng, p, state, uid }: RenderArgs): string => {
	let s = '';
	const cols = rng.int(5, 9);
	const lintelY = rng.range(18, 28);
	const baseY = rng.range(80, 90);
	const focalCol = rng.int(0, cols - 1);

	s += `<defs>
      <linearGradient id="pwash-${uid}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="${p.bg}" stop-opacity="1"/>
        <stop offset="100%" stop-color="${p.base}" stop-opacity="1"/>
      </linearGradient>
    </defs>`;
	s += `<rect width="100" height="100" fill="url(#pwash-${uid})"/>`;

	s += `<ellipse cx="50" cy="${(lintelY + baseY) / 2}" rx="42" ry="22" fill="${p.ink}" opacity="0.18"/>`;

	s += `<rect x="8" y="${lintelY - 2}" width="84" height="1.8" fill="${p.accent}" opacity="0.55"/>`;
	s += `<rect x="10" y="${lintelY}" width="80" height="3.5" fill="${p.ink}" opacity="0.78"/>`;
	s += `<rect x="11" y="${lintelY + 3.5}" width="78" height="0.6" fill="${p.dim}" opacity="0.9"/>`;

	s += `<rect x="6" y="${baseY}" width="88" height="2" fill="${p.ink}" opacity="0.85"/>`;
	s += `<rect x="4" y="${baseY + 2}" width="92" height="1.2" fill="${p.accent}" opacity="0.40"/>`;

	const colSpan = 80;
	const colStart = 10;
	const colW = (colSpan - 6) / cols;

	for (let i = 0; i < cols; i++) {
		const xMid = colStart + colW * (i + 0.5);
		const isFocal = i === focalCol;
		const w = isFocal ? colW * 0.65 : colW * 0.45;
		const x = xMid - w / 2;
		const y1 = lintelY + 4;
		const y2 = baseY - 1;
		s += `<rect x="${x}" y="${y1}" width="${w}" height="${y2 - y1}" fill="${isFocal ? p.accent : p.dim}" opacity="${isFocal ? (state === 'won' ? 0.95 : 0.85) : 0.78}"/>`;
		s += `<rect x="${x - 0.6}" y="${y1}" width="${w + 1.2}" height="1.2" fill="${p.ink}" opacity="0.95"/>`;
		s += `<rect x="${x - 0.6}" y="${y2 - 1.2}" width="${w + 1.2}" height="1.2" fill="${p.ink}" opacity="0.95"/>`;

		if (!isFocal) {
			s += `<line x1="${x + w * 0.5}" y1="${y1 + 2}" x2="${x + w * 0.5}" y2="${y2 - 2}" stroke="${p.bg}" stroke-width="0.25" opacity="0.6"/>`;
		}
	}

	const fxMid = colStart + colW * (focalCol + 0.5);

	if (state !== 'lost') {
		s += `<circle cx="${fxMid}" cy="${lintelY - 4}" r="${state === 'won' ? 2.4 : 1.6}" fill="${p.hot}" opacity="${state === 'won' ? 1 : 0.85}"/>`;
	}

	if (state === 'won') {
		s += `<rect x="10" y="${lintelY}" width="80" height="0.8" fill="${p.accent}" opacity="0.7"/>`;
	} else if (state === 'lost') {
		s += `<line x1="${fxMid - 4}" y1="${lintelY + 1}" x2="${fxMid + 4}" y2="${lintelY + 4}" stroke="${p.bg}" stroke-width="1.2"/>`;
		s += `<rect width="100" height="100" fill="${p.bg}" opacity="0.34"/>`;
	}

	return s;
};

// TECH — isometric modular block stack.
// (No `<defs>` so `uid` is unused; kept in the signature for protocol
// uniformity with the other renderers. Underscore-prefixed per the
// `@typescript-eslint/no-unused-vars` convention.)
const renderTech = ({ rng, p, state, uid: _uid }: RenderArgs): string => {
	let s = '';
	s += `<rect width="100" height="100" fill="${p.bg}"/>`;

	for (let r = 0; r < 10; r++) {
		for (let c = 0; c < 10; c++) {
			s += `<circle cx="${5 + c * 10}" cy="${5 + r * 10}" r="0.4" fill="${p.ink}" opacity="0.35"/>`;
		}
	}

	const ox = 50;
	const oy = 76;
	const u = 11;
	const ix: [number, number] = [u * 0.866, -u * 0.5];
	const iy: [number, number] = [-u * 0.866, -u * 0.5];
	const iz: [number, number] = [0, -u];

	// 3D-to-screen isometric projection. Positional `(x, y, z)` is the
	// standard signature for a coordinate transform; object form would
	// be unreadable in the per-vertex calls below.
	// eslint-disable-next-line local-rules/prefer-object-params
	const iso = (x: number, y: number, z: number): [number, number] => [
		ox + x * ix[0] + y * iy[0] + z * iz[0],
		oy + x * ix[1] + y * iy[1] + z * iz[1]
	];

	const ptStr = (pts: ReadonlyArray<readonly [number, number]>): string =>
		pts.map((pp) => pp.map((n) => n.toFixed(2)).join(',')).join(' ');

	// `(x, y, z)` mirrors the iso-coordinate signature; the trailing
	// `hot` flag toggles the focal-block treatment. Positional preserves
	// the parallel between the call sites (`drawBox(b.x, b.y, z, isHot)`)
	// and the coordinate transform.
	// eslint-disable-next-line local-rules/prefer-object-params
	const drawBox = (x: number, y: number, z: number, hot: boolean): void => {
		const tA = iso(x, y, z + 1);
		const tB = iso(x + 1, y, z + 1);
		const tC = iso(x + 1, y + 1, z + 1);
		const tD = iso(x, y + 1, z + 1);
		const rA = iso(x + 1, y, z + 1);
		const rB = iso(x + 1, y, z);
		const rC = iso(x + 1, y + 1, z);
		const rD = iso(x + 1, y + 1, z + 1);
		const lA = iso(x, y + 1, z + 1);
		const lB = iso(x, y + 1, z);
		const lC = iso(x + 1, y + 1, z);
		const lD = iso(x + 1, y + 1, z + 1);
		const stroke = p.hot;
		const sw = 0.4;

		if (hot) {
			s += `<polygon points="${ptStr([tA, tB, tC, tD])}" fill="${p.accent}" opacity="${state === 'won' ? 0.95 : 0.85}" stroke="${stroke}" stroke-width="${sw}"/>`;
			s += `<polygon points="${ptStr([rA, rB, rC, rD])}" fill="${p.accent}" opacity="0.55" stroke="${stroke}" stroke-width="${sw}"/>`;
			s += `<polygon points="${ptStr([lA, lB, lC, lD])}" fill="${p.accent}" opacity="0.70" stroke="${stroke}" stroke-width="${sw}"/>`;
		} else {
			s += `<polygon points="${ptStr([tA, tB, tC, tD])}" fill="${p.ink}" opacity="0.95" stroke="${stroke}" stroke-width="${sw}"/>`;
			s += `<polygon points="${ptStr([rA, rB, rC, rD])}" fill="${p.base}" opacity="0.95" stroke="${stroke}" stroke-width="${sw}"/>`;
			s += `<polygon points="${ptStr([lA, lB, lC, lD])}" fill="${p.dim}" opacity="0.95" stroke="${stroke}" stroke-width="${sw}"/>`;
		}
	};

	const footprint: { x: number; y: number; h: number }[] = [];
	const colsX = rng.int(2, 3);
	const colsY = rng.int(2, 3);

	for (let xi = 0; xi < colsX; xi++) {
		for (let yi = 0; yi < colsY; yi++) {
			const h = rng.int(0, 3);

			if (h > 0) {
				footprint.push({
					x: xi - Math.floor(colsX / 2),
					y: yi - Math.floor(colsY / 2),
					h
				});
			}
		}
	}

	let focal: { x: number; y: number; h: number } | null = null;
	let maxH = 0;
	footprint.forEach((b) => {
		if (b.h > maxH) {
			maxH = b.h;
			focal = b;
		}
	});

	footprint.sort((a, b) => a.y - b.y || a.x - b.x);
	footprint.forEach((b) => {
		for (let z = 0; z < b.h; z++) {
			const isHot = b === focal && z === b.h - 1;
			drawBox(b.x, b.y, z, isHot);
		}
	});

	if (state === 'won') {
		if (focal) {
			const fb: { x: number; y: number; h: number } = focal;
			const [px, py] = iso(fb.x + 0.5, fb.y + 0.5, fb.h);
			s += `<circle cx="${px}" cy="${py - 1}" r="6" fill="none" stroke="${p.accent}" stroke-width="0.6" opacity="0.6"/>`;
			s += `<circle cx="${px}" cy="${py - 1}" r="2.4" fill="${p.fg}" opacity="0.85"/>`;
		}
	} else if (state === 'lost') {
		for (let i = 0; i < 6; i++) {
			const y = rng.range(20, 80);
			const h = rng.range(1, 2.4);
			const dx = rng.range(-4, 4);
			s += `<rect x="${0 + dx}" y="${y}" width="100" height="${h}" fill="${p.bg}" opacity="0.9"/>`;
		}

		s += `<rect width="100" height="100" fill="${p.bg}" opacity="0.30"/>`;
	}

	return s;
};

// CULTURE — ink blobs on warm paper.
const renderCulture = ({ rng, p, state, uid }: RenderArgs): string => {
	let s = '';
	s += `<defs>
      <radialGradient id="cugrad-${uid}" cx="50%" cy="40%" r="70%">
        <stop offset="0%" stop-color="${p.base}" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="${p.bg}" stop-opacity="1"/>
      </radialGradient>
    </defs>`;
	s += `<rect width="100" height="100" fill="url(#cugrad-${uid})"/>`;

	for (let i = 0; i < 60; i++) {
		const x = rng.range(0, 100);
		const y = rng.range(0, 100);
		s += `<circle cx="${x}" cy="${y}" r="${rng.range(0.15, 0.45)}" fill="${p.ink}" opacity="${rng.range(0.1, 0.25)}"/>`;
	}

	// Culture is the only category that requires the extended six-colour
	// ink set; fall back to accent if it's missing (defensive — shouldn't
	// happen for `culture` per PAL definition above).
	const inks = p.inks ?? [p.accent];
	const blobCount = rng.int(1, 2);
	const colorA = inks[rng.int(0, inks.length - 1)];
	const colorB = inks[rng.int(0, inks.length - 1)];
	const colors = [colorA, colorB];

	for (let b = 0; b < blobCount; b++) {
		const cx = rng.range(28, 72);
		const cy = rng.range(30, 65);
		const baseR = rng.range(18, 28);
		const wobble = rng.range(0.18, 0.4);
		const verts = rng.int(12, 18);
		const startA = rng.range(0, 360);
		const pts: [number, number][] = [];

		for (let v = 0; v < verts; v++) {
			const a = startA + (360 / verts) * v;
			const r = baseR * (1 - wobble + 2 * wobble * rng.r());
			pts.push([cx + r * Math.cos(deg(a)), cy + r * Math.sin(deg(a))]);
		}

		let path = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;

		for (let i = 0; i < pts.length; i++) {
			const next = pts[(i + 1) % pts.length];
			const mid: [number, number] = [(pts[i][0] + next[0]) / 2, (pts[i][1] + next[1]) / 2];
			path += ` Q ${pts[i][0].toFixed(2)} ${pts[i][1].toFixed(2)} ${mid[0].toFixed(2)} ${mid[1].toFixed(2)}`;
		}

		path += ' Z';
		const fillCol = colors[b % colors.length];
		const op = state === 'won' ? 0.9 : 0.78;
		s += `<path d="${path}" fill="${fillCol}" opacity="${op}"/>`;
		s += `<path d="${path}" fill="none" stroke="${p.ink}" stroke-width="0.5" opacity="0.45"/>`;
	}

	const markCount = rng.int(6, 14);

	for (let i = 0; i < markCount; i++) {
		const x = rng.range(8, 92);
		const y = rng.range(8, 92);
		const r = rng.range(0.6, 1.8);
		const col = colors[rng.int(0, 1)];
		s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}" opacity="${rng.range(0.55, 0.85)}"/>`;
	}

	const sx = rng.range(15, 35);
	const sy = rng.range(72, 86);
	const ex = sx + rng.range(20, 40);
	const ey = sy + rng.range(-12, 8);
	const cxp = (sx + ex) / 2 + rng.range(-12, 12);
	const cyp = (sy + ey) / 2 + rng.range(-12, 12);
	s += `<path d="M ${sx} ${sy} Q ${cxp} ${cyp} ${ex} ${ey}" fill="none" stroke="${p.fg}" stroke-width="${rng.range(0.8, 1.6)}" opacity="0.78" stroke-linecap="round"/>`;

	if (state === 'won') {
		const haloX = rng.range(38, 62);
		const haloY = rng.range(38, 58);
		s += `<circle cx="${haloX}" cy="${haloY}" r="34" fill="${p.accent}" opacity="0.10"/>`;
		s += `<circle cx="${haloX}" cy="${haloY}" r="18" fill="${p.accent}" opacity="0.12"/>`;
	} else if (state === 'lost') {
		for (let i = 0; i < 8; i++) {
			const x = rng.range(20, 80);
			s += `<line x1="${x}" y1="${rng.range(20, 50)}" x2="${x}" y2="${rng.range(55, 85)}" stroke="${p.bg}" stroke-width="0.6" opacity="0.8"/>`;
		}

		s += `<rect width="100" height="100" fill="${p.bg}" opacity="0.34"/>`;
	}

	return s;
};

const RENDERERS: Record<FlowArtCategory, (args: RenderArgs) => string> = {
	macro: renderMacro,
	crypto: renderCrypto,
	sports: renderSports,
	politics: renderPolitics,
	tech: renderTech,
	culture: renderCulture
};

// =============================================================
//   Public API
// =============================================================

export const renderFlowArt = ({
	category,
	seed,
	state = 'neutral',
	size = 240,
	frame = false
}: FlowArtRenderOptions): string => {
	const renderer = RENDERERS[category] ?? renderMacro;
	const pal = (PAL[category] ?? PAL.macro)[state] ?? PAL[category].neutral;
	const seedKey = `${category}::${seed}::${state}`;
	const rng = makeRng(seedKey);
	// Stable per-render suffix for SVG `<defs>` ids. Multiple
	// FlowArtFrames render simultaneously in the FlowMode deck and
	// `<defs>` ids live in the document scope — without a suffix,
	// `url(#mwash)` would resolve to the first match in the document
	// (potentially another card's gradient).
	const uid = hashStr(seedKey).toString(36);
	const body = renderer({ rng, p: pal, state, uid });
	let svg = svgOpen(size) + bgRect(pal) + body;

	if (frame) {
		svg += frameInset({ p: pal, state });
	}

	svg += svgClose();

	return svg;
};

export const flowArtPalette = ({
	category,
	state = 'neutral'
}: {
	category: FlowArtCategory;
	state?: FlowArtState;
}): FlowArtPalette => (PAL[category] ?? PAL.macro)[state];

/**
 * Resolve a `FlowArtCategory` for a market with optional admin-tagged
 * `categoryId`. When the tagged category matches one of the six
 * canonical languages, use it; otherwise hash the `seed` (typically
 * `market.id`) to deterministically pick one. Mirrors the resolution
 * FlowCard does inline so untagged markets still render artwork
 * stably across renders.
 */
export const resolveFlowArtCategory = ({
	categoryId,
	seed
}: {
	categoryId?: string | null;
	seed: string | number;
}): FlowArtCategory => {
	const canonical = (categoryId ?? '').toString().toLowerCase();

	if ((FLOW_ART_CATEGORIES as readonly string[]).includes(canonical)) {
		return canonical as FlowArtCategory;
	}

	const idx = hashStr(String(seed)) % FLOW_ART_CATEGORIES.length;

	return FLOW_ART_CATEGORIES[idx];
};
