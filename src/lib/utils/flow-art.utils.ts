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

import type { Theme } from '$lib/stores/theme.store';
import { fnv1a32 } from '$lib/utils/hash.utils';

export type FlowArtCategory =
	| 'macro'
	| 'crypto'
	| 'sports'
	| 'politics'
	| 'tech'
	| 'culture'
	| 'wc';

export type FlowArtState = 'neutral' | 'won' | 'lost';
// FlowArt's palette dimension is keyed by the app-wide `Theme` union;
// re-export under a domain alias so existing call sites read naturally.
export type FlowArtTheme = Theme;

/**
 * Canonical category set used for random category assignment when a
 * market has no admin-tagged category. `wc` is intentionally excluded
 * — it's a tentpole-only language and must be opt-in via an explicit
 * `category: 'wc'` (typically driven by the FeaturedEvent abstraction).
 */
export const FLOW_ART_CATEGORIES: readonly Exclude<FlowArtCategory, 'wc'>[] = [
	'macro',
	'crypto',
	'sports',
	'politics',
	'tech',
	'culture'
] as const;

/**
 * Pre-built lookup set for `FLOW_ART_CATEGORIES` plus the opt-in `wc`
 * tentpole. Three Flow surfaces (FlowCard, FlowMode, market-signals)
 * need to test whether an arbitrary string is a known category —
 * exporting the Set once avoids each consumer rebuilding it on module
 * load.
 */
export const FLOW_ART_CATEGORY_SET: ReadonlySet<string> = new Set<FlowArtCategory>([
	...FLOW_ART_CATEGORIES,
	'wc'
]);

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
type ThemePalettes = Record<FlowArtTheme, Partial<CategoryPalettes> & { neutral: FlowArtPalette }>;

export interface FlowArtRenderOptions {
	category: FlowArtCategory;
	// Stable per-market seed. Pass `market.id` (or any deterministic
	// string / number — strings are FNV-1a hashed first).
	seed: string | number;
	state?: FlowArtState;
	theme?: FlowArtTheme;
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

const hashStr = fnv1a32;

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
	// Original render seed (typically a market id). Renderers that
	// need to pin specific markets to specific outputs (e.g. WC kits
	// per nation) read this; everything else stays seed-derived via
	// `rng`.
	seed: string | number;
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
//   Palettes — six categories × theme × state
// =============================================================

const PAL: Record<FlowArtCategory, ThemePalettes> = {
	macro: {
		dark: {
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
		light: {
			neutral: {
				bg: '#F2ECDC',
				base: '#E2D8BA',
				ink: '#3D5A85',
				accent: '#B68B1F',
				hot: '#2A6FDB',
				dim: '#B5C0D2',
				fg: '#0E0D0B'
			}
		},
		peach: {
			neutral: {
				bg: '#FFE5D0',
				base: '#F4C0A8',
				ink: '#8C3E50',
				accent: '#B68B1F',
				hot: '#D14B72',
				dim: '#C99080',
				fg: '#3D2419'
			}
		}
	},
	crypto: {
		dark: {
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
		light: {
			neutral: {
				bg: '#EFEAE0',
				base: '#DBD0B8',
				ink: '#5A2E94',
				accent: '#2BA178',
				hot: '#7A4FB8',
				dim: '#C5B6D6',
				fg: '#0E0D0B'
			}
		},
		peach: {
			neutral: {
				bg: '#FBDDD9',
				base: '#F0B8B2',
				ink: '#6A2F70',
				accent: '#1E8C68',
				hot: '#A0589E',
				dim: '#C99592',
				fg: '#3D2419'
			}
		}
	},
	sports: {
		dark: {
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
		light: {
			neutral: {
				bg: '#F8EBD7',
				base: '#EDD7B0',
				ink: '#B5462C',
				accent: '#D04F1A',
				hot: '#FF8744',
				dim: '#DBAA8C',
				fg: '#0E0D0B'
			}
		},
		peach: {
			neutral: {
				bg: '#FFDDC4',
				base: '#F4B58A',
				ink: '#9F3520',
				accent: '#C04014',
				hot: '#FF6E2F',
				dim: '#D69875',
				fg: '#3D2419'
			}
		}
	},
	politics: {
		dark: {
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
		light: {
			neutral: {
				bg: '#F2ECDC',
				base: '#E2D8BA',
				ink: '#2D4570',
				accent: '#6F1C20',
				hot: '#1D365C',
				dim: '#B5C0D2',
				fg: '#0E0D0B'
			}
		},
		peach: {
			neutral: {
				bg: '#FFE0D5',
				base: '#F4BCAC',
				ink: '#642B57',
				accent: '#8E2F50',
				hot: '#522074',
				dim: '#D2918E',
				fg: '#3D2419'
			}
		}
	},
	tech: {
		dark: {
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
		light: {
			neutral: {
				bg: '#EDEDE6',
				base: '#DCDBD3',
				ink: '#2D3B4D',
				accent: '#2A6FDB',
				hot: '#0E0D0B',
				dim: '#B0B8C2',
				fg: '#0E0D0B'
			}
		},
		peach: {
			neutral: {
				bg: '#FCE2D5',
				base: '#F2BFAA',
				ink: '#4F2F70',
				accent: '#7A48B8',
				hot: '#9070D6',
				dim: '#C8A5A8',
				fg: '#3D2419'
			}
		}
	},
	culture: {
		dark: {
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
		},
		light: {
			neutral: {
				bg: '#F5EBD2',
				base: '#E8D9B0',
				ink: '#7A4A1F',
				accent: '#B68B1F',
				hot: '#B5462C',
				dim: '#C9B589',
				fg: '#0E0D0B',
				inks: ['#B68B1F', '#B5462C', '#2A6FDB', '#7A4FB8', '#2BA178', '#D04F1A']
			}
		},
		peach: {
			neutral: {
				bg: '#FFE5CC',
				base: '#F4BC95',
				ink: '#7C3D2C',
				accent: '#B68B1F',
				hot: '#C73D60',
				dim: '#D6A87E',
				fg: '#3D2419',
				inks: ['#B68B1F', '#C73D60', '#7A48B8', '#C04014', '#642B57', '#7C3D2C']
			}
		}
	},
	// World Cup — pitch green base with chalk-line architecture + gold
	// accent. Tentpole-only: emitted exclusively when a market belongs
	// to the active FeaturedEvent (see `FLOW_ART_CATEGORIES`, which
	// excludes `wc` so the random fallback never selects it).
	wc: {
		dark: {
			neutral: {
				bg: '#0E2A1A',
				base: '#143A24',
				ink: '#2A6A42',
				accent: '#E2B842',
				hot: '#F2ECDC',
				dim: '#1E4A30',
				fg: '#F2ECDC'
			},
			won: {
				bg: '#143F26',
				base: '#1B5532',
				ink: '#3B8A56',
				accent: '#FFD06A',
				hot: '#FFFFFF',
				dim: '#266A40',
				fg: '#FFF6E1'
			},
			lost: {
				bg: '#10231A',
				base: '#1A2E22',
				ink: '#2A3D30',
				accent: '#7C7368',
				hot: '#5C5249',
				dim: '#1C2A22',
				fg: '#9C9890'
			}
		},
		light: {
			neutral: {
				bg: '#E8F0DC',
				base: '#D2E0BC',
				ink: '#1F5F38',
				accent: '#B68B1F',
				hot: '#B5462C',
				dim: '#A6BE8C',
				fg: '#0E0D0B'
			}
		},
		peach: {
			neutral: {
				bg: '#FFE5CC',
				base: '#F4D5B8',
				ink: '#1F5F38',
				accent: '#B68B1F',
				hot: '#C04014',
				dim: '#D6B5A0',
				fg: '#3D2419'
			}
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

// WC uses a wider 280×100 viewBox so the editorial figure system can
// span the full-bleed artwork band edge-to-edge. `slice` fill keeps
// the band tight to its container without empty letterboxing.
const svgOpenWC = (size: number): string => {
	const h = Math.round((size * 100) / 280);

	return `<svg viewBox="0 0 280 100" width="${size}" height="${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" shape-rendering="geometricPrecision">`;
};

/**
 * Public viewBox dimensions per category. Default categories render
 * into a square 100×100 viewBox; `wc` uses a wider 280×100 band so
 * the figure system spans full-bleed. `FlowArtFrame` reads this to
 * size its host element with the correct aspect ratio.
 */
export const flowArtViewBox = (category: FlowArtCategory): { width: number; height: number } =>
	category === 'wc' ? { width: 280, height: 100 } : { width: 100, height: 100 };

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

// ---- WC figure system — mode-independent constants ----------
// Figure colors are intentionally NOT palette-derived so
// the editorial figure layer reads identically across dark / light /
// peach themes. That's why `boostOpacities` skips WC (it would
// over-saturate these fixed inks against light backdrops).

const WC_SKIN: Record<string, { base: string; shadow: string; high: string }> = {
	umber: { base: '#9C6E45', shadow: '#6E4A2A', high: '#C0916A' },
	olive: { base: '#A78657', shadow: '#7A5E37', high: '#C9A879' },
	almond: { base: '#B98968', shadow: '#86603F', high: '#D4A988' },
	mahog: { base: '#6E4A2A', shadow: '#4A2F18', high: '#8E6238' },
	sand: { base: '#C99F75', shadow: '#9C7250', high: '#E0BC95' },
	bronze: { base: '#7E5638', shadow: '#553820', high: '#9E7558' }
};

const WC_HAIR = {
	jet: '#1A1410',
	charcoal: '#2A211A',
	brown: '#3E2C20',
	auburn: '#5A2F1E',
	blonde: '#A98E60',
	gray: '#7E7A75'
} as const;

type WCHairStyle = 'short' | 'curly' | 'mohawk' | 'cap' | 'bun' | 'bald';

type WCEmotion = 'joy' | 'focus' | 'anticipation' | 'dread' | 'defeat' | 'playful';

// Kit / costume colours referenced by the curated recipes. Mirrors the
// nation jerseys (Brazil canary, Spain scarlet, France royal, Argentina
// celeste, USA away cream) plus the neutral wardrobe (dark, suit, ref)
// and the metallic gold used by the trophy / boot props.
const WC_SHIRT = {
	brazil: '#FFD800',
	spain: '#C8102E',
	france: '#0055A4',
	arg: '#75AADB',
	usaR: '#C8102E',
	usaW: '#F2ECDC',
	dark: '#2A211A',
	suit: '#1F2A3A',
	gold: '#E2B842',
	cream: '#F2ECDC',
	stripeBlue: '#0A3161',
	ref: '#2D2D2D',
	jersey: '#3E5A38'
} as const;

// Per-nation scene data for the featured-event advancement markets
// (`wc-br-r16`, `wc-it-r16`, …). These ids are app-specific (ISO-3166
// alpha-2 per nation) and never matched a hand-authored `recipes` key,
// so they used to fall to the generic figure. Each entry pairs the
// nation's flag colours + flag layout with a home-kit colour and a
// figure trait set — reusing the same backdrop / face vocabulary as the
// curated recipes — so every nation card renders a distinct, flag-true
// scene. Keyed by lowercased alpha-2 code; the renderer resolves any
// `wc-{cc}-*` seed against this table before the generic fallback.
type WCFlagLayout = 'horiz' | 'vert' | 'diag';

interface WCNation {
	c1: string;
	c2: string;
	c3: string;
	layout: WCFlagLayout;
	shirt: string;
	shadow: string;
	skin: keyof typeof WC_SKIN;
	hair: keyof typeof WC_HAIR;
	hairStyle: WCHairStyle;
}

const WC_NATIONS: Record<string, WCNation> = {
	// Favourites — kits + figure traits mirror the curated winner recipes.
	br: {
		c1: '#FFD800',
		c2: '#0F8C3A',
		c3: '#0033A0',
		layout: 'diag',
		shirt: WC_SHIRT.brazil,
		shadow: '#C4A300',
		skin: 'umber',
		hair: 'jet',
		hairStyle: 'short'
	}, // Brazil
	es: {
		c1: '#C8102E',
		c2: '#F1BF00',
		c3: '#C8102E',
		layout: 'horiz',
		shirt: WC_SHIRT.spain,
		shadow: '#8A0E20',
		skin: 'almond',
		hair: 'brown',
		hairStyle: 'short'
	}, // Spain
	fr: {
		c1: '#0055A4',
		c2: '#F2ECDC',
		c3: '#EF4135',
		layout: 'vert',
		shirt: WC_SHIRT.france,
		shadow: '#003A78',
		skin: 'sand',
		hair: 'auburn',
		hairStyle: 'short'
	}, // France
	ar: {
		c1: '#75AADB',
		c2: '#F2ECDC',
		c3: '#75AADB',
		layout: 'horiz',
		shirt: WC_SHIRT.arg,
		shadow: '#5189B8',
		skin: 'olive',
		hair: 'brown',
		hairStyle: 'curly'
	}, // Argentina
	// Tier two.
	en: {
		c1: '#F2ECDC',
		c2: '#C8102E',
		c3: '#F2ECDC',
		layout: 'horiz',
		shirt: '#F2ECDC',
		shadow: '#C2BBA8',
		skin: 'sand',
		hair: 'brown',
		hairStyle: 'short'
	}, // England
	de: {
		c1: '#000000',
		c2: '#DD0000',
		c3: '#FFCE00',
		layout: 'horiz',
		shirt: '#F2ECDC',
		shadow: '#C2BBA8',
		skin: 'sand',
		hair: 'blonde',
		hairStyle: 'short'
	}, // Germany
	pt: {
		c1: '#046A38',
		c2: '#DA291C',
		c3: '#FFE05A',
		layout: 'vert',
		shirt: '#DA291C',
		shadow: '#8E1A12',
		skin: 'almond',
		hair: 'brown',
		hairStyle: 'short'
	}, // Portugal
	nl: {
		c1: '#AE1C28',
		c2: '#F2ECDC',
		c3: '#21468B',
		layout: 'horiz',
		shirt: '#EE7700',
		shadow: '#A85200',
		skin: 'sand',
		hair: 'blonde',
		hairStyle: 'short'
	}, // Netherlands
	be: {
		c1: '#000000',
		c2: '#FAE042',
		c3: '#ED2939',
		layout: 'vert',
		shirt: '#ED2939',
		shadow: '#A01825',
		skin: 'sand',
		hair: 'brown',
		hairStyle: 'short'
	}, // Belgium
	it: {
		c1: '#008C45',
		c2: '#F2ECDC',
		c3: '#CD212A',
		layout: 'vert',
		shirt: '#0066B2',
		shadow: '#003F73',
		skin: 'almond',
		hair: 'charcoal',
		hairStyle: 'short'
	}, // Italy
	hr: {
		c1: '#C8102E',
		c2: '#F2ECDC',
		c3: '#171796',
		layout: 'horiz',
		shirt: '#C8102E',
		shadow: '#8A0E20',
		skin: 'sand',
		hair: 'brown',
		hairStyle: 'short'
	}, // Croatia
	uy: {
		c1: '#7BAFD4',
		c2: '#F2ECDC',
		c3: '#7BAFD4',
		layout: 'horiz',
		shirt: '#5CBFEB',
		shadow: '#3E8CB0',
		skin: 'olive',
		hair: 'brown',
		hairStyle: 'short'
	}, // Uruguay
	us: {
		c1: '#C8102E',
		c2: '#F2ECDC',
		c3: '#0A3161',
		layout: 'horiz',
		shirt: WC_SHIRT.usaW,
		shadow: '#B0A480',
		skin: 'bronze',
		hair: 'brown',
		hairStyle: 'cap'
	}, // USA
	ma: {
		c1: '#C1272D',
		c2: '#006233',
		c3: '#C1272D',
		layout: 'horiz',
		shirt: '#C1272D',
		shadow: '#7E191D',
		skin: 'bronze',
		hair: 'jet',
		hairStyle: 'short'
	}, // Morocco
	jp: {
		c1: '#F2ECDC',
		c2: '#BC002D',
		c3: '#F2ECDC',
		layout: 'horiz',
		shirt: '#0A1A6B',
		shadow: '#06104A',
		skin: 'almond',
		hair: 'jet',
		hairStyle: 'short'
	}, // Japan
	sn: {
		c1: '#00853F',
		c2: '#FDEF42',
		c3: '#E31B23',
		layout: 'vert',
		shirt: '#00853F',
		shadow: '#005A2A',
		skin: 'mahog',
		hair: 'jet',
		hairStyle: 'short'
	} // Senegal
};

// Cap brim + cap-band reference colors used inside `wcFace` so the
// hair-style="cap" branch reads naturally.
const WC_CAP_DARK = '#2A211A';
const WC_CAP_BAND = WC_HAIR.charcoal;

// Composes a 4–6-plane bust portrait around an anchor (cx, cy).
// Hair drawn behind face plane for cleaner silhouette; jaw and ears
// drawn after the face plane. Expression layer (brows + eyes +
// mouth) reads at small sizes via stroke weights tuned for the
// 280×100 viewBox. All `<g class="wc-figure">` so future CSS
// keyframes can target it without per-part selectors.
const wcFace = ({
	cx,
	cy,
	skin,
	hair,
	hairStyle,
	shirt,
	shirtShadow = '#1F1A14',
	stripe,
	emotion
}: {
	cx: number;
	cy: number;
	skin: keyof typeof WC_SKIN;
	hair: keyof typeof WC_HAIR;
	hairStyle: WCHairStyle;
	shirt: string;
	shirtShadow?: string;
	stripe?: string;
	emotion: WCEmotion;
}): string => {
	const sk = WC_SKIN[skin] ?? WC_SKIN.umber;
	const hairColor = WC_HAIR[hair] ?? WC_HAIR.brown;
	const headW = 16;
	const headH = 14;

	let m = `<g class="wc-figure">`;

	// Shoulders (full bust) — drawn first behind the head, then
	// shadow plane, optional national-kit shoulder stripe, collar.
	m += `<polygon points="${cx - 30},${cy + 18} ${cx + 30},${cy + 18} ${cx + 40},${cy + 58} ${cx - 40},${cy + 58}" fill="${shirt}"/>`;
	m += `<polygon points="${cx},${cy + 18} ${cx + 30},${cy + 18} ${cx + 40},${cy + 58} ${cx},${cy + 58}" fill="${shirtShadow}" opacity="0.45"/>`;

	if (stripe) {
		m += `<polygon points="${cx - 10},${cy + 18} ${cx - 4},${cy + 18} ${cx - 2},${cy + 58} ${cx - 14},${cy + 58}" fill="${stripe}" opacity="0.85"/>`;
	}

	m += `<polygon points="${cx - 7},${cy + 16} ${cx + 7},${cy + 16} ${cx + 5},${cy + 22} ${cx - 5},${cy + 22}" fill="${sk.base}"/>`;

	// Hair — six styles; `bald` is intentionally a no-op.
	if (hairStyle === 'short') {
		m += `<polygon points="${cx - headW - 1},${cy - headH - 2} ${cx + headW + 1},${cy - headH - 2} ${cx + headW + 2},${cy - 2} ${cx - headW - 2},${cy - 2}" fill="${hairColor}"/>`;
	} else if (hairStyle === 'curly') {
		m += `<path d="M ${cx - headW - 3} ${cy - 2} Q ${cx - headW - 3} ${cy - headH - 8} ${cx} ${cy - headH - 6} Q ${cx + headW + 3} ${cy - headH - 8} ${cx + headW + 3} ${cy - 2} Z" fill="${hairColor}"/>`;
	} else if (hairStyle === 'mohawk') {
		m += `<polygon points="${cx - headW},${cy - 2} ${cx - headW},${cy - headH - 1} ${cx + headW},${cy - headH - 1} ${cx + headW},${cy - 2}" fill="${hairColor}" opacity="0.85"/>`;
		m += `<polygon points="${cx - 3},${cy - headH - 1} ${cx + 3},${cy - headH - 1} ${cx + 4},${cy - headH - 8} ${cx - 4},${cy - headH - 8}" fill="${hairColor}"/>`;
	} else if (hairStyle === 'cap') {
		m += `<polygon points="${cx - headW - 2},${cy - headH + 2} ${cx + headW + 2},${cy - headH + 2} ${cx + headW + 4},${cy - 3} ${cx - headW - 4},${cy - 3}" fill="${WC_CAP_DARK}"/>`;
		m += `<rect x="${cx - headW - 6}" y="${cy - 3}" width="${headW * 2 + 12}" height="2" fill="${WC_CAP_BAND}"/>`;
	} else if (hairStyle === 'bun') {
		m += `<polygon points="${cx - headW - 1},${cy - headH - 2} ${cx + headW + 1},${cy - headH - 2} ${cx + headW + 2},${cy + 10} ${cx - headW - 2},${cy + 10}" fill="${hairColor}" opacity="0.95"/>`;
		m += `<circle cx="${cx + headW + 4}" cy="${cy - headH - 4}" r="4" fill="${hairColor}"/>`;
	}

	// Face plane + shadow (right half) + cheek highlight (left) +
	// jaw trapezoid + ears.
	m += `<polygon points="${cx - headW},${cy - headH} ${cx + headW},${cy - headH} ${cx + headW - 1},${cy + headH - 2} ${cx - headW + 1},${cy + headH - 2}" fill="${sk.base}"/>`;
	m += `<polygon points="${cx},${cy - headH} ${cx + headW},${cy - headH} ${cx + headW - 1},${cy + headH - 2} ${cx},${cy + headH - 2}" fill="${sk.shadow}" opacity="0.55"/>`;
	m += `<polygon points="${cx - headW},${cy - 2} ${cx - headW + 5},${cy - 2} ${cx - headW + 4},${cy + 8} ${cx - headW},${cy + 8}" fill="${sk.high}" opacity="0.65"/>`;
	m += `<polygon points="${cx - headW + 1},${cy + headH - 2} ${cx + headW - 1},${cy + headH - 2} ${cx + headW - 3},${cy + headH + 4} ${cx - headW + 3},${cy + headH + 4}" fill="${sk.shadow}"/>`;
	m += `<rect x="${cx - headW - 1.5}" y="${cy - 1}" width="2" height="5" fill="${sk.shadow}"/>`;
	m += `<rect x="${cx + headW - 0.5}" y="${cy - 1}" width="2" height="5" fill="${sk.shadow}" opacity="0.7"/>`;

	// Expression layer — brows, eyes, mouth, all in #0E0D0B for max
	// contrast on the editorial figure regardless of theme.
	const eyeY = cy - 2;
	const mouthY = cy + 6;
	const eyeL = cx - 6;
	const eyeR = cx + 6;
	const browInk = '#0E0D0B';

	// Brows
	if (emotion === 'joy' || emotion === 'playful') {
		m += `<line x1="${eyeL - 3}" y1="${eyeY - 4}" x2="${eyeL + 3}" y2="${eyeY - 3.5}" stroke="${browInk}" stroke-width="0.9" stroke-linecap="round"/>`;
		m += `<line x1="${eyeR - 3}" y1="${eyeY - 3.5}" x2="${eyeR + 3}" y2="${eyeY - 4}" stroke="${browInk}" stroke-width="0.9" stroke-linecap="round"/>`;
	} else if (emotion === 'focus' || emotion === 'anticipation') {
		m += `<line x1="${eyeL - 3}" y1="${eyeY - 3.5}" x2="${eyeL + 3}" y2="${eyeY - 3.5}" stroke="${browInk}" stroke-width="1" stroke-linecap="round"/>`;
		m += `<line x1="${eyeR - 3}" y1="${eyeY - 3.5}" x2="${eyeR + 3}" y2="${eyeY - 3.5}" stroke="${browInk}" stroke-width="1" stroke-linecap="round"/>`;
	} else if (emotion === 'dread' || emotion === 'defeat') {
		m += `<line x1="${eyeL - 3}" y1="${eyeY - 3}" x2="${eyeL + 3}" y2="${eyeY - 4.5}" stroke="${browInk}" stroke-width="1" stroke-linecap="round"/>`;
		m += `<line x1="${eyeR - 3}" y1="${eyeY - 4.5}" x2="${eyeR + 3}" y2="${eyeY - 3}" stroke="${browInk}" stroke-width="1" stroke-linecap="round"/>`;
	}

	// Eyes
	if (emotion === 'joy') {
		m += `<path d="M ${eyeL - 2.5} ${eyeY} Q ${eyeL} ${eyeY - 1.5} ${eyeL + 2.5} ${eyeY}" stroke="${browInk}" stroke-width="1" fill="none" stroke-linecap="round"/>`;
		m += `<path d="M ${eyeR - 2.5} ${eyeY} Q ${eyeR} ${eyeY - 1.5} ${eyeR + 2.5} ${eyeY}" stroke="${browInk}" stroke-width="1" fill="none" stroke-linecap="round"/>`;
	} else if (emotion === 'dread') {
		m += `<ellipse cx="${eyeL}" cy="${eyeY}" rx="1.6" ry="1.8" fill="#F2ECDC"/>`;
		m += `<ellipse cx="${eyeR}" cy="${eyeY}" rx="1.6" ry="1.8" fill="#F2ECDC"/>`;
		m += `<circle cx="${eyeL}" cy="${eyeY + 0.2}" r="0.8" fill="${browInk}"/>`;
		m += `<circle cx="${eyeR}" cy="${eyeY + 0.2}" r="0.8" fill="${browInk}"/>`;
	} else if (emotion === 'playful') {
		m += `<path d="M ${eyeL - 2.5} ${eyeY} Q ${eyeL} ${eyeY - 1.5} ${eyeL + 2.5} ${eyeY}" stroke="${browInk}" stroke-width="1" fill="none" stroke-linecap="round"/>`;
		m += `<circle cx="${eyeR}" cy="${eyeY}" r="1.3" fill="${browInk}"/>`;
	} else if (emotion === 'defeat') {
		m += `<path d="M ${eyeL - 2.5} ${eyeY + 0.5} Q ${eyeL} ${eyeY + 2} ${eyeL + 2.5} ${eyeY + 0.5}" stroke="${browInk}" stroke-width="1" fill="none" stroke-linecap="round"/>`;
		m += `<path d="M ${eyeR - 2.5} ${eyeY + 0.5} Q ${eyeR} ${eyeY + 2} ${eyeR + 2.5} ${eyeY + 0.5}" stroke="${browInk}" stroke-width="1" fill="none" stroke-linecap="round"/>`;
	} else {
		m += `<circle cx="${eyeL}" cy="${eyeY}" r="1.1" fill="${browInk}"/>`;
		m += `<circle cx="${eyeR}" cy="${eyeY}" r="1.1" fill="${browInk}"/>`;
	}

	// Mouth
	if (emotion === 'joy') {
		m += `<path d="M ${cx - 5} ${mouthY} Q ${cx} ${mouthY + 4} ${cx + 5} ${mouthY}" stroke="${browInk}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
	} else if (emotion === 'focus' || emotion === 'anticipation') {
		m += `<line x1="${cx - 3}" y1="${mouthY + 1}" x2="${cx + 3}" y2="${mouthY + 1}" stroke="${browInk}" stroke-width="1.1" stroke-linecap="round"/>`;
	} else if (emotion === 'dread') {
		m += `<ellipse cx="${cx}" cy="${mouthY + 1}" rx="2" ry="2.5" fill="${browInk}"/>`;
	} else if (emotion === 'defeat') {
		m += `<path d="M ${cx - 4} ${mouthY + 2} Q ${cx} ${mouthY - 1} ${cx + 4} ${mouthY + 2}" stroke="${browInk}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
	} else if (emotion === 'playful') {
		m += `<path d="M ${cx - 4} ${mouthY + 1} Q ${cx + 1} ${mouthY + 3} ${cx + 5} ${mouthY - 1}" stroke="${browInk}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
	}

	m += `</g>`;

	return m;
};

// ---- WC — Faceted Editorial system (curated, per market) -----
// Coordinate space is 280×100 (slice fill) — the wide full-bleed
// artwork band on the front of WC cards.
//
// Two layers:
//   Figure layer  — fixed colours (skin / hair / kit) that read on
//                   any mode background, drawn by `wcFace`.
//   Background    — palette-token backdrops that recolour per
//                   dark / light / peach theme.
//
// Each tentpole WC market id maps to a curated composition in
// `recipes` { backdrop + figure params + foreign word (top-right)
// + emotion tag (bottom-right) }. Any id without a recipe (e.g. the
// onboarding advancement markets `wc-it-r16`) falls back to a
// generic pitch-perspective + centred figure + ball scene, so new
// markets never crash and always carry a character.
//
// `bgSpotlight` and `bgBunting` carry CSS class hooks
// (`wc-spot wc-spot-left/right` and `wc-cnf wc-cnf-${i}`) and the
// figure wraps in `<g class="wc-figure">`. The matching keyframes
// live in `FlowArtFrame.svelte` and respect `prefers-reduced-motion`.
const renderWC = ({ p, state, uid, seed }: RenderArgs): string => {
	// === BACKGROUND HELPERS ===================================
	// Each backdrop fills the full 280×100 band. Palette tokens
	// (`p.bg` / `p.base` / `p.ink` / `p.fg` / `p.hot`) recolour per
	// theme; the flag trios passed in are fixed national colours.
	const bgFlagDiag = ({ c1, c2, c3 }: { c1: string; c2: string; c3: string }): string =>
		`<rect width="280" height="100" fill="${p.base}"/>` +
		`<polygon points="-20,120 90,0 120,0 0,120" fill="${c1}" opacity="0.78"/>` +
		`<polygon points="90,0 120,0 30,120 0,120" fill="${c2}" opacity="0.88"/>` +
		`<polygon points="120,0 280,0 280,40 60,40" fill="${c3}" opacity="0.18"/>`;

	const bgFlagHoriz = ({ c1, c2, c3 }: { c1: string; c2: string; c3: string }): string =>
		`<rect x="0" y="0" width="280" height="33" fill="${c1}" opacity="0.85"/>` +
		`<rect x="0" y="33" width="280" height="34" fill="${c2}" opacity="0.95"/>` +
		`<rect x="0" y="67" width="280" height="33" fill="${c3}" opacity="0.85"/>`;

	const bgFlagVert = ({ c1, c2, c3 }: { c1: string; c2: string; c3: string }): string =>
		`<rect x="0" y="0" width="93.3" height="100" fill="${c1}" opacity="0.9"/>` +
		`<rect x="93.3" y="0" width="93.4" height="100" fill="${c2}" opacity="0.9"/>` +
		`<rect x="186.7" y="0" width="93.3" height="100" fill="${c3}" opacity="0.9"/>`;

	const bgCircle = ({
		color,
		cx = 200,
		cy = 50,
		r = 60
	}: {
		color: string;
		cx?: number;
		cy?: number;
		r?: number;
	}): string =>
		`<rect width="280" height="100" fill="${p.bg}"/>` +
		`<rect width="280" height="100" fill="${p.base}" opacity="0.55"/>` +
		`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="0.85"/>` +
		`<circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="none" stroke="${color}" stroke-width="0.5" opacity="0.40"/>`;

	const bgPerspective = (color: string): string => {
		let m = `<rect width="280" height="100" fill="${p.bg}"/>`;
		m += `<polygon points="0,100 280,100 200,40 80,40" fill="${p.base}" opacity="0.65"/>`;

		// Eight floor lines converging toward the back, then four
		// receding crossbars to anchor depth.
		for (let i = 0; i < 8; i++) {
			const t = i / 7;
			const x1 = t * 280;
			const x2 = 80 + t * 120;
			m += `<line x1="${x1.toFixed(1)}" y1="100" x2="${x2.toFixed(1)}" y2="40" stroke="${color}" stroke-width="0.4" opacity="0.35"/>`;
		}

		for (let i = 0; i < 4; i++) {
			const y = 50 + i * 12;
			const xL = 100 - (y - 40) * 0.2;
			const xR = 180 + (y - 40) * 0.2;
			m += `<line x1="${xL}" y1="${y}" x2="${xR}" y2="${y}" stroke="${color}" stroke-width="0.3" opacity="0.30"/>`;
		}

		return m;
	};

	const bgSpotlight = ({ c1, c2 }: { c1: string; c2: string }): string =>
		`<rect width="280" height="100" fill="${p.bg}"/>` +
		// Two spotlight cones from the top — classes drive the CSS sweep.
		`<polygon class="wc-spot wc-spot-left" points="50,-10 80,-10 130,100 30,100" fill="${c1}" opacity="0.15"/>` +
		`<polygon class="wc-spot wc-spot-right" points="200,-10 230,-10 250,100 150,100" fill="${c2}" opacity="0.15"/>` +
		`<rect width="280" height="100" fill="${p.base}" opacity="0.35"/>`;

	const bgBunting = ({ c1, c2, c3 }: { c1: string; c2: string; c3: string }): string => {
		let m = `<rect width="280" height="100" fill="${p.bg}"/>`;
		m += `<rect x="0" y="62" width="280" height="38" fill="${p.base}" opacity="0.55"/>`;
		// Bunting string + triangular flags.
		m += `<path d="M 0 18 Q 140 26 280 18" fill="none" stroke="${p.fg}" stroke-width="0.4" opacity="0.55"/>`;
		const cols = [c1, c2, c3];

		for (let i = 0; i < 12; i++) {
			const t = i / 11;
			const x = t * 280;
			const y = 18 + Math.sin(t * Math.PI) * 5;
			const c = cols[i % cols.length];
			// `% 10` keeps the stagger class in range — `FlowArtFrame`
			// only defines `.wc-cnf-0`…`.wc-cnf-9` delay hooks, so the
			// 11th/12th shards reuse an existing offset rather than
			// falling back to the unstaggered base animation.
			m += `<path class="wc-cnf wc-cnf-${i % 10}" d="M ${x - 5} ${y} L ${x + 5} ${y} L ${x} ${y + 10} Z" fill="${c}" opacity="${0.78 + (i % 2) * 0.15}"/>`;
		}

		return m;
	};

	const bgStands = (stripe: string): string => {
		let m = `<rect width="280" height="100" fill="${p.bg}"/>`;

		// Stadium tiers.
		for (let i = 0; i < 6; i++) {
			m += `<rect x="-4" y="${10 + i * 6}" width="290" height="3" fill="${p.base}" opacity="${0.55 - i * 0.05}"/>`;
		}

		// Tiny crowd dots.
		for (let r = 0; r < 5; r++) {
			for (let c = 0; c < 28; c++) {
				m += `<circle cx="${4 + c * 10}" cy="${10.5 + r * 6}" r="0.6" fill="${stripe}" opacity="${0.35 + (r % 2) * 0.18}"/>`;
			}
		}

		// Low pitch line.
		m += `<rect x="0" y="46" width="280" height="54" fill="${p.ink}" opacity="0.30"/>`;
		m += `<line x1="0" y1="74" x2="280" y2="74" stroke="${p.fg}" stroke-width="0.4" opacity="0.30"/>`;

		return m;
	};

	const bgTV = (color: string): string =>
		`<rect width="280" height="100" fill="${p.bg}"/>` +
		// Big TV frame on the right.
		`<rect x="142" y="14" width="124" height="72" rx="3" fill="${p.ink}" opacity="0.92"/>` +
		`<rect x="142" y="14" width="124" height="72" rx="3" fill="none" stroke="${color}" stroke-width="0.6" opacity="0.55"/>` +
		// 'replay' grid inside.
		`<line x1="146" y1="64" x2="262" y2="64" stroke="${p.hot}" stroke-width="0.4" opacity="0.55"/>` +
		`<line x1="190" y1="20" x2="190" y2="84" stroke="${color}" stroke-width="0.5" stroke-dasharray="2 2" opacity="0.9"/>` +
		// VAR pill.
		`<rect x="142" y="14" width="34" height="9" fill="#D04444" opacity="0.95"/>` +
		`<text x="159" y="20.5" text-anchor="middle" font-family="ui-monospace,monospace" font-size="6" font-weight="800" fill="#F2ECDC">VAR</text>`;

	const bgPropose = (accentRing: string): string => {
		let m = `<rect width="280" height="100" fill="${p.bg}"/>`;
		m += `<rect x="0" y="55" width="280" height="45" fill="${p.base}" opacity="0.6"/>`;
		m += `<line x1="0" y1="68" x2="280" y2="68" stroke="${p.fg}" stroke-width="0.4" opacity="0.30"/>`;

		// Floating hearts.
		for (let i = 0; i < 5; i++) {
			const x = 30 + i * 56;
			const y = 24 + (i % 2) * 8;
			m += `<path d="M ${x} ${y + 4} C ${x - 4} ${y - 2} ${x - 8} ${y + 2} ${x} ${y + 8} C ${x + 8} ${y + 2} ${x + 4} ${y - 2} ${x} ${y + 4} Z" fill="${accentRing}" opacity="0.70"/>`;
		}

		return m;
	};

	// === FOCAL PROPS (scene-specific accents) =================
	const trophyIcon = ({
		cx,
		cy,
		scale = 1
	}: {
		cx: number;
		cy: number;
		scale?: number;
	}): string => {
		const sx = (x: number): number => cx + x * scale;
		const sy = (y: number): number => cy + y * scale;
		const gradId = `wctrophy-${uid}`;
		let m = `<defs><linearGradient id="${gradId}" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="${WC_SHIRT.gold}"/><stop offset="100%" stop-color="#A87D14"/></linearGradient></defs>`;
		// Cup.
		m += `<path d="M ${sx(-8)} ${sy(-10)} Q ${sx(-9)} ${sy(-3)} ${sx(-5)} ${sy(4)} Q ${sx(-3)} ${sy(8)} ${sx(-4)} ${sy(10)} L ${sx(-7)} ${sy(15)} L ${sx(7)} ${sy(15)} L ${sx(4)} ${sy(10)} Q ${sx(3)} ${sy(8)} ${sx(5)} ${sy(4)} Q ${sx(9)} ${sy(-3)} ${sx(8)} ${sy(-10)} Z" fill="url(#${gradId})"/>`;
		// Base.
		m += `<rect x="${sx(-9)}" y="${sy(15)}" width="${18 * scale}" height="${3 * scale}" fill="${WC_SHIRT.gold}"/>`;
		m += `<rect x="${sx(-11)}" y="${sy(18)}" width="${22 * scale}" height="${3.5 * scale}" fill="${WC_SHIRT.gold}" opacity="0.85"/>`;

		return m;
	};

	const goldenBoot = ({
		cx,
		cy,
		scale = 1
	}: {
		cx: number;
		cy: number;
		scale?: number;
	}): string => {
		const sx = (x: number): number => cx + x * scale;
		const sy = (y: number): number => cy + y * scale;
		let m = `<path d="M ${sx(-15)} ${sy(0)} Q ${sx(-18)} ${sy(-6)} ${sx(-8)} ${sy(-10)} L ${sx(8)} ${sy(-12)} Q ${sx(16)} ${sy(-12)} ${sx(18)} ${sy(-5)} L ${sx(18)} ${sy(2)} Q ${sx(18)} ${sy(8)} ${sx(10)} ${sy(8)} L ${sx(-10)} ${sy(10)} Q ${sx(-16)} ${sy(10)} ${sx(-15)} ${sy(0)} Z" fill="${WC_SHIRT.gold}"/>`;

		// Laces.
		for (let i = 0; i < 4; i++) {
			m += `<line x1="${sx(-6 + i * 5)}" y1="${sy(-7)}" x2="${sx(-6 + i * 5)}" y2="${sy(-2)}" stroke="#A87D14" stroke-width="0.5"/>`;
		}

		// Studs.
		for (let i = 0; i < 4; i++) {
			m += `<circle cx="${sx(-4 + i * 5)}" cy="${sy(11)}" r="0.7" fill="${p.bg}" opacity="0.8"/>`;
		}

		return m;
	};

	const redCardProp = ({ cx, cy, rot = -16 }: { cx: number; cy: number; rot?: number }): string =>
		`<g transform="rotate(${rot} ${cx} ${cy})">` +
		`<rect x="${cx - 7}" y="${cy - 10}" width="14" height="20" fill="#D04444"/>` +
		`<rect x="${cx - 7}" y="${cy - 10}" width="14" height="20" fill="none" stroke="#0E0D0B" stroke-width="0.4" opacity="0.5"/>` +
		`</g>`;

	const ringProp = ({ cx, cy }: { cx: number; cy: number }): string =>
		`<ellipse cx="${cx}" cy="${cy}" rx="8" ry="8" fill="none" stroke="${WC_SHIRT.gold}" stroke-width="2" opacity="0.95"/>` +
		`<path d="M ${cx} ${cy - 12} L ${cx + 3} ${cy - 9} L ${cx} ${cy - 6} L ${cx - 3} ${cy - 9} Z" fill="${WC_SHIRT.gold}"/>`;

	const scissorsProp = ({ cx, cy }: { cx: number; cy: number }): string =>
		`<circle cx="${cx - 5}" cy="${cy - 2}" r="2.5" fill="none" stroke="${p.fg}" stroke-width="0.8"/>` +
		`<circle cx="${cx + 5}" cy="${cy + 4}" r="2.5" fill="none" stroke="${p.fg}" stroke-width="0.8"/>` +
		`<line x1="${cx - 3}" y1="${cy - 1}" x2="${cx + 6}" y2="${cy + 9}" stroke="${p.fg}" stroke-width="1"/>` +
		`<line x1="${cx + 3}" y1="${cy + 3}" x2="${cx - 6}" y2="${cy + 11}" stroke="${p.fg}" stroke-width="1"/>`;

	const ballProp = ({ cx, cy, r = 6 }: { cx: number; cy: number; r?: number }): string => {
		let m = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#F2ECDC"/>`;
		m += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#0E0D0B" stroke-width="0.4"/>`;

		for (let i = 0; i < 6; i++) {
			const a = (i * 60 * Math.PI) / 180;
			const px = cx + Math.cos(a) * (r * 0.55);
			const py = cy + Math.sin(a) * (r * 0.55);
			m += `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="${r * 0.2}" fill="#0E0D0B"/>`;
		}

		m += `<circle cx="${cx}" cy="${cy}" r="${r * 0.2}" fill="#0E0D0B"/>`;

		return m;
	};

	// === RECIPES (curated compositions) =====================
	// Each key is a WC market id → a fully deterministic scene
	// (backdrop + figure + optional prop), ported 1:1 from the
	// prototype's hand-authored table so every tentpole / prop /
	// advancement market renders its own composition rather than the
	// generic fallback. The figure's `emotion` drives its expression.
	// (The prototype's caption pill is a no-op there and is omitted.)
	const recipes: Record<string, () => string> = {
		// ─── CLASSIC ─────────────────────────────────────────────
		'wc-winner-brazil': () =>
			bgFlagDiag({ c1: '#FFD800', c2: '#0F8C3A', c3: '#0033A0' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'umber',
				hair: 'jet',
				hairStyle: 'short',
				shirt: WC_SHIRT.brazil,
				shirtShadow: '#C4A300',
				emotion: 'joy'
			}) +
			trophyIcon({ cx: 220, cy: 56, scale: 0.9 }),

		'wc-winner-spain': () =>
			bgFlagHoriz({ c1: '#C8102E', c2: '#F1BF00', c3: '#C8102E' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'almond',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.spain,
				shirtShadow: '#8A0E20',
				emotion: 'focus'
			}),

		'wc-winner-france': () =>
			bgFlagVert({ c1: '#0055A4', c2: '#F2ECDC', c3: '#EF4135' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'sand',
				hair: 'auburn',
				hairStyle: 'short',
				shirt: WC_SHIRT.france,
				shirtShadow: '#003A78',
				emotion: 'focus'
			}),

		'wc-winner-argentina': () =>
			bgFlagHoriz({ c1: '#75AADB', c2: '#F2ECDC', c3: '#75AADB' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'olive',
				hair: 'brown',
				hairStyle: 'curly',
				shirt: WC_SHIRT.arg,
				shirtShadow: '#5189B8',
				emotion: 'anticipation'
			}),

		'wc-golden-boot': () =>
			bgCircle({ color: WC_SHIRT.gold, cx: 200, cy: 50, r: 55 }) +
			wcFace({
				cx: 110,
				cy: 44,
				skin: 'mahog',
				hair: 'jet',
				hairStyle: 'short',
				shirt: WC_SHIRT.dark,
				shirtShadow: '#100B07',
				emotion: 'focus'
			}) +
			goldenBoot({ cx: 220, cy: 60, scale: 1.0 }),

		'wc-usa-quarter': () => {
			// Stars-and-stripes hosted variant — bg striped + canton + bracket dot
			let m = '';
			m += `<rect width="280" height="100" fill="${p.base}"/>`;

			for (let i = 0; i < 7; i++) {
				m += `<rect x="0" y="${i * 14.3}" width="280" height="${14.3 * 0.5}" fill="${i % 2 ? '#C8102E' : '#F2ECDC'}" opacity="0.78"/>`;
			}

			m += `<rect x="0" y="0" width="120" height="50" fill="#0A3161" opacity="0.95"/>`;

			// tiny stars
			for (let r = 0; r < 5; r++) {
				for (let c = 0; c < 9; c++) {
					m += `<circle cx="${10 + c * 12}" cy="${6 + r * 9}" r="0.9" fill="#F2ECDC" opacity="0.85"/>`;
				}
			}

			return (
				m +
				wcFace({
					cx: 190,
					cy: 50,
					skin: 'bronze',
					hair: 'brown',
					hairStyle: 'cap',
					shirt: WC_SHIRT.usaW,
					shirtShadow: '#B0A480',
					stripe: '#C8102E',
					emotion: 'joy'
				})
			);
		},

		'wc-over-3-final': () =>
			bgPerspective(WC_SHIRT.cream) +
			wcFace({
				cx: 80,
				cy: 50,
				skin: 'olive',
				hair: 'gray',
				hairStyle: 'short',
				shirt: WC_SHIRT.jersey,
				shirtShadow: '#1F3A1A',
				emotion: 'dread'
			}) +
			ballProp({ cx: 180, cy: 56, r: 7 }) +
			ballProp({ cx: 212, cy: 38, r: 5 }) +
			ballProp({ cx: 234, cy: 64, r: 5 }) +
			ballProp({ cx: 258, cy: 50, r: 4 }),

		'wc-german-out-group': () =>
			bgFlagHoriz({ c1: '#000000', c2: '#DD0000', c3: '#FFCE00' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'sand',
				hair: 'blonde',
				hairStyle: 'short',
				shirt: WC_SHIRT.dark,
				shirtShadow: '#100B07',
				emotion: 'defeat'
			}),

		// ─── PLAYFUL ─────────────────────────────────────────────
		'wc-neymar-dive': () =>
			bgSpotlight({ c1: WC_SHIRT.gold, c2: WC_SHIRT.cream }) +
			wcFace({
				cx: 140,
				cy: 50,
				skin: 'almond',
				hair: 'brown',
				hairStyle: 'mohawk',
				shirt: WC_SHIRT.brazil,
				shirtShadow: '#C4A300',
				emotion: 'playful'
			}),

		'wc-player-haircut': () =>
			bgCircle({ color: WC_SHIRT.gold, cx: 70, cy: 50, r: 50 }) +
			wcFace({
				cx: 160,
				cy: 44,
				skin: 'umber',
				hair: 'jet',
				hairStyle: 'mohawk',
				shirt: WC_SHIRT.dark,
				shirtShadow: '#100B07',
				emotion: 'playful'
			}) +
			scissorsProp({ cx: 220, cy: 50 }),

		'wc-trophy-drop': () =>
			bgPerspective(WC_SHIRT.cream) +
			wcFace({
				cx: 110,
				cy: 46,
				skin: 'bronze',
				hair: 'auburn',
				hairStyle: 'short',
				shirt: WC_SHIRT.cream,
				shirtShadow: '#B0A480',
				emotion: 'dread'
			}) +
			(() => {
				// falling rotated trophy + bounce dots
				let m = `<g transform="rotate(28 200 56)">`;
				m += trophyIcon({ cx: 200, cy: 56, scale: 0.75 });
				m += `</g>`;

				for (let i = 0; i < 5; i++) {
					const a = -140 + i * 18;
					const r = 18;
					const x = 200 + Math.cos((a * Math.PI) / 180) * r;
					const y = 84 + Math.sin((a * Math.PI) / 180) * r;
					m += `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="0.8" fill="${WC_SHIRT.gold}" opacity="0.85"/>`;
				}

				return m;
			})(),

		'wc-coach-stands': () =>
			bgStands('#7E7A75') +
			wcFace({
				cx: 110,
				cy: 50,
				skin: 'sand',
				hair: 'gray',
				hairStyle: 'short',
				shirt: WC_SHIRT.suit,
				shirtShadow: '#0E1626',
				emotion: 'defeat'
			}) +
			redCardProp({ cx: 170, cy: 36, rot: -16 }),

		'wc-pitch-propose': () =>
			bgPropose(WC_SHIRT.gold) +
			wcFace({
				cx: 110,
				cy: 50,
				skin: 'almond',
				hair: 'brown',
				hairStyle: 'curly',
				shirt: WC_SHIRT.france,
				shirtShadow: '#003A78',
				emotion: 'joy'
			}) +
			ringProp({ cx: 210, cy: 52 }),

		'wc-var-final': () =>
			bgTV(WC_SHIRT.gold) +
			wcFace({
				cx: 60,
				cy: 50,
				skin: 'mahog',
				hair: 'charcoal',
				hairStyle: 'short',
				shirt: WC_SHIRT.ref,
				shirtShadow: '#0E0D0B',
				emotion: 'focus'
			}),

		'wc-celebration': () =>
			bgCircle({ color: WC_SHIRT.gold, cx: 70, cy: 50, r: 50 }) +
			wcFace({
				cx: 150,
				cy: 46,
				skin: 'umber',
				hair: 'jet',
				hairStyle: 'short',
				shirt: WC_SHIRT.dark,
				shirtShadow: '#100B07',
				emotion: 'joy'
			}) +
			goldenBoot({ cx: 214, cy: 58, scale: 0.9 }),

		// ─── BETA V1.4 MARQUEE (hand-authored for the 50-card expansion) ───
		// Host opener — Mexican tricolor, jubilant home figure, ball at feet.
		'wc-host-mex-opener': () =>
			bgFlagVert({ c1: '#006847', c2: '#F2ECDC', c3: '#CE1126' }) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'bronze',
				hair: 'jet',
				hairStyle: 'short',
				shirt: '#006847',
				shirtShadow: '#00432E',
				emotion: 'joy'
			}) +
			ballProp({ cx: 222, cy: 62, r: 6 }),

		// USA on home soil — stars-and-stripes canton, focused host figure.
		'wc-usa-r16': () => {
			let m = `<rect width="280" height="100" fill="${p.base}"/>`;

			for (let i = 0; i < 7; i++) {
				m += `<rect x="0" y="${i * 14.3}" width="280" height="${14.3 * 0.5}" fill="${i % 2 ? '#C8102E' : '#F2ECDC'}" opacity="0.78"/>`;
			}

			m += `<rect x="0" y="0" width="120" height="50" fill="#0A3161" opacity="0.95"/>`;

			for (let r = 0; r < 5; r++) {
				for (let c = 0; c < 9; c++) {
					m += `<circle cx="${10 + c * 12}" cy="${6 + r * 9}" r="0.9" fill="#F2ECDC" opacity="0.85"/>`;
				}
			}

			return (
				m +
				wcFace({
					cx: 190,
					cy: 50,
					skin: 'bronze',
					hair: 'brown',
					hairStyle: 'cap',
					shirt: WC_SHIRT.usaW,
					shirtShadow: '#B0A480',
					stripe: '#C8102E',
					emotion: 'focus'
				})
			);
		},

		// Germany redemption — black/red/gold bands, determined figure.
		'wc-germany-advance': () =>
			bgFlagHoriz({ c1: '#000000', c2: '#DD0000', c3: '#FFCE00' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'sand',
				hair: 'blonde',
				hairStyle: 'short',
				shirt: '#F2ECDC',
				shirtShadow: '#C2BBA8',
				emotion: 'focus'
			}),

		// Portugal talisman — green/red vertical, anticipation, ball ready.
		'wc-portugal-goal-grp': () =>
			bgFlagVert({ c1: '#046A38', c2: '#046A38', c3: '#DA291C' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'almond',
				hair: 'jet',
				hairStyle: 'short',
				shirt: '#A4123F',
				shirtShadow: '#6E0C2A',
				emotion: 'anticipation'
			}) +
			ballProp({ cx: 224, cy: 60, r: 6 }),

		// France QF — tricolore, composed figure, ball.
		'wc-france-qf': () =>
			bgFlagVert({ c1: '#0055A4', c2: '#F2ECDC', c3: '#EF4135' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'sand',
				hair: 'auburn',
				hairStyle: 'short',
				shirt: WC_SHIRT.france,
				shirtShadow: '#003A78',
				emotion: 'focus'
			}) +
			ballProp({ cx: 232, cy: 62, r: 6 }),

		// Brazil QF — diagonal canary/green/blue, joyful figure.
		'wc-brazil-qf': () =>
			bgFlagDiag({ c1: '#FFD800', c2: '#0F8C3A', c3: '#0033A0' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'umber',
				hair: 'jet',
				hairStyle: 'short',
				shirt: WC_SHIRT.brazil,
				shirtShadow: '#C4A300',
				emotion: 'anticipation'
			}) +
			ballProp({ cx: 230, cy: 64, r: 6 }),

		// Argentina QF — sky-blue/white bands, hopeful figure.
		'wc-argentina-qf': () =>
			bgFlagHoriz({ c1: '#75AADB', c2: '#F2ECDC', c3: '#75AADB' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'olive',
				hair: 'brown',
				hairStyle: 'curly',
				shirt: WC_SHIRT.arg,
				shirtShadow: '#5189B8',
				emotion: 'anticipation'
			}) +
			ballProp({ cx: 232, cy: 62, r: 6 }),

		// Host in the final — golden spotlight, trophy looming, lone host figure.
		'wc-host-in-final': () =>
			bgSpotlight({ c1: WC_SHIRT.gold, c2: WC_SHIRT.cream }) +
			wcFace({
				cx: 96,
				cy: 50,
				skin: 'bronze',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.usaW,
				shirtShadow: '#B0A480',
				stripe: '#C8102E',
				emotion: 'anticipation'
			}) +
			trophyIcon({ cx: 208, cy: 52, scale: 0.95 }),

		// Final on penalties — broadcast TV frame, ball on the spot, ref focus.
		'wc-final-penalties': () =>
			bgTV(WC_SHIRT.gold) +
			wcFace({
				cx: 64,
				cy: 50,
				skin: 'mahog',
				hair: 'charcoal',
				hairStyle: 'short',
				shirt: WC_SHIRT.ref,
				shirtShadow: '#0E0D0B',
				emotion: 'dread'
			}) +
			ballProp({ cx: 206, cy: 70, r: 6 }),

		// First-time champion — bunting + trophy raised, pure joy.
		'wc-first-time-winner': () =>
			bgBunting({ c1: WC_SHIRT.gold, c2: '#FF6B6B', c3: '#6FE0B6' }) +
			wcFace({
				cx: 120,
				cy: 48,
				skin: 'almond',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.dark,
				shirtShadow: '#100B07',
				emotion: 'joy'
			}) +
			trophyIcon({ cx: 208, cy: 52, scale: 1.0 }),

		// ─── BETA V1.4 EXPANSION II (50 new pre-tournament + prop cards) ───
		'wc-ball-viral': () =>
			bgFlagVert({ c1: '#046A38', c2: '#046A38', c3: '#DA291C' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'sand',
				hair: 'jet',
				hairStyle: 'short',
				shirt: '#A4123F',
				shirtShadow: '#6E0C2A',
				emotion: 'focus'
			}),
		'wc-captain-change': () =>
			bgFlagHoriz({ c1: '#75AADB', c2: '#F2ECDC', c3: '#75AADB' }) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'olive',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.arg,
				shirtShadow: '#5189B8',
				stripe: WC_SHIRT.gold,
				emotion: 'anticipation'
			}),
		'wc-squad-snub': () =>
			bgFlagHoriz({ c1: '#000000', c2: '#DD0000', c3: '#FFCE00' }) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'sand',
				hair: 'blonde',
				hairStyle: 'short',
				shirt: '#F2ECDC',
				shirtShadow: '#C2BBA8',
				emotion: 'defeat'
			}),
		'wc-friendly-brazil': () =>
			bgFlagDiag({ c1: '#FFD800', c2: '#0F8C3A', c3: '#0033A0' }) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'umber',
				hair: 'jet',
				hairStyle: 'short',
				shirt: WC_SHIRT.brazil,
				shirtShadow: '#C4A300',
				emotion: 'focus'
			}) +
			ballProp({ cx: 228, cy: 62, r: 6 }),
		'wc-friendly-england': () =>
			bgFlagHoriz({ c1: '#F2ECDC', c2: '#C8102E', c3: '#F2ECDC' }) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'sand',
				hair: 'brown',
				hairStyle: 'short',
				shirt: '#F2ECDC',
				shirtShadow: '#C2BBA8',
				emotion: 'focus'
			}) +
			ballProp({ cx: 228, cy: 62, r: 6 }),
		'wc-friendly-sweep': () =>
			bgBunting({ c1: WC_SHIRT.gold, c2: '#0F8C3A', c3: '#75AADB' }) +
			wcFace({
				cx: 120,
				cy: 48,
				skin: 'almond',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.dark,
				shirtShadow: '#100B07',
				emotion: 'anticipation'
			}) +
			trophyIcon({ cx: 210, cy: 54, scale: 0.85 }),
		'wc-kit-sellout': () =>
			bgCircle({ color: WC_SHIRT.gold, cx: 196, cy: 50, r: 52 }) +
			wcFace({
				cx: 124,
				cy: 46,
				skin: 'bronze',
				hair: 'jet',
				hairStyle: 'short',
				shirt: WC_SHIRT.brazil,
				shirtShadow: '#C4A300',
				emotion: 'joy'
			}),
		'wc-injury-return': () =>
			bgFlagHoriz({ c1: '#C8102E', c2: '#F1BF00', c3: '#C8102E' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'almond',
				hair: 'jet',
				hairStyle: 'short',
				shirt: WC_SHIRT.spain,
				shirtShadow: '#8A0E20',
				emotion: 'anticipation'
			}) +
			ballProp({ cx: 232, cy: 62, r: 6 }),
		'wc-anthem-star': () =>
			bgSpotlight({ c1: WC_SHIRT.gold, c2: WC_SHIRT.cream }) +
			wcFace({
				cx: 140,
				cy: 50,
				skin: 'almond',
				hair: 'jet',
				hairStyle: 'mohawk',
				shirt: WC_SHIRT.dark,
				shirtShadow: '#100B07',
				emotion: 'joy'
			}),
		'wc-ceremony-record': () =>
			bgBunting({ c1: WC_SHIRT.gold, c2: '#FF6B6B', c3: '#6FE0B6' }) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'almond',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.cream,
				shirtShadow: '#B0A480',
				emotion: 'joy'
			}),
		'wc-lineup-teen': () =>
			bgFlagHoriz({ c1: '#F2ECDC', c2: '#C8102E', c3: '#F2ECDC' }) +
			wcFace({
				cx: 140,
				cy: 48,
				skin: 'sand',
				hair: 'brown',
				hairStyle: 'short',
				shirt: '#F2ECDC',
				shirtShadow: '#C2BBA8',
				emotion: 'anticipation'
			}) +
			ballProp({ cx: 232, cy: 62, r: 6 }),
		'wc-late-drama-grp': () =>
			bgStands('#E2B842') +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'umber',
				hair: 'jet',
				hairStyle: 'short',
				shirt: WC_SHIRT.brazil,
				shirtShadow: '#C4A300',
				emotion: 'joy'
			}) +
			ballProp({ cx: 228, cy: 60, r: 6 }),
		'wc-opening-sellout': () =>
			bgStands('#E2B842') +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'bronze',
				hair: 'brown',
				hairStyle: 'cap',
				shirt: WC_SHIRT.usaW,
				shirtShadow: '#B0A480',
				stripe: '#C8102E',
				emotion: 'joy'
			}),
		'wc-top-team-lose-open': () =>
			bgPerspective(WC_SHIRT.cream) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'almond',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.spain,
				shirtShadow: '#8A0E20',
				emotion: 'defeat'
			}),
		'wc-comeback-grp': () =>
			bgPerspective(WC_SHIRT.cream) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'olive',
				hair: 'brown',
				hairStyle: 'curly',
				shirt: WC_SHIRT.arg,
				shirtShadow: '#5189B8',
				emotion: 'joy'
			}) +
			ballProp({ cx: 228, cy: 60, r: 6 }),
		'wc-messi-goal': () =>
			bgFlagHoriz({ c1: '#75AADB', c2: '#F2ECDC', c3: '#75AADB' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'sand',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.arg,
				shirtShadow: '#5189B8',
				emotion: 'joy'
			}) +
			ballProp({ cx: 230, cy: 62, r: 6 }),
		'wc-penalty-miss-grp': () =>
			bgPerspective(WC_SHIRT.cream) +
			wcFace({
				cx: 120,
				cy: 48,
				skin: 'almond',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.dark,
				shirtShadow: '#100B07',
				emotion: 'dread'
			}) +
			ballProp({ cx: 206, cy: 70, r: 7 }),
		'wc-five-goal-game': () =>
			bgPerspective(WC_SHIRT.cream) +
			wcFace({
				cx: 78,
				cy: 50,
				skin: 'olive',
				hair: 'gray',
				hairStyle: 'short',
				shirt: WC_SHIRT.jersey,
				shirtShadow: '#1F3A1A',
				emotion: 'joy'
			}) +
			ballProp({ cx: 176, cy: 54, r: 7 }) +
			ballProp({ cx: 210, cy: 38, r: 5 }) +
			ballProp({ cx: 236, cy: 64, r: 5 }) +
			ballProp({ cx: 258, cy: 48, r: 4 }),
		'wc-veteran-goal': () =>
			bgCircle({ color: WC_SHIRT.gold, cx: 198, cy: 50, r: 50 }) +
			wcFace({
				cx: 122,
				cy: 46,
				skin: 'sand',
				hair: 'gray',
				hairStyle: 'short',
				shirt: WC_SHIRT.dark,
				shirtShadow: '#100B07',
				emotion: 'joy'
			}),
		'wc-own-goal-grp': () =>
			bgPerspective(WC_SHIRT.cream) +
			wcFace({
				cx: 120,
				cy: 48,
				skin: 'bronze',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.jersey,
				shirtShadow: '#1F3A1A',
				emotion: 'dread'
			}) +
			ballProp({ cx: 206, cy: 68, r: 6 }),
		'wc-brazil-group-perfect': () =>
			bgFlagDiag({ c1: '#FFD800', c2: '#0F8C3A', c3: '#0033A0' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'umber',
				hair: 'jet',
				hairStyle: 'short',
				shirt: WC_SHIRT.brazil,
				shirtShadow: '#C4A300',
				emotion: 'joy'
			}) +
			ballProp({ cx: 230, cy: 62, r: 6 }),
		'wc-clean-sheet-keeper': () =>
			bgStands('#7E7A75') +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'sand',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.jersey,
				shirtShadow: '#1F3A1A',
				emotion: 'focus'
			}),
		'wc-portugal-r16': () =>
			bgFlagVert({ c1: '#046A38', c2: '#046A38', c3: '#DA291C' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'almond',
				hair: 'jet',
				hairStyle: 'short',
				shirt: '#A4123F',
				shirtShadow: '#6E0C2A',
				emotion: 'anticipation'
			}) +
			ballProp({ cx: 228, cy: 60, r: 6 }),
		'wc-netherlands-r16': () =>
			bgFlagHoriz({ c1: '#AE1C28', c2: '#F2ECDC', c3: '#21468B' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'sand',
				hair: 'blonde',
				hairStyle: 'short',
				shirt: '#EA6F1E',
				shirtShadow: '#B5530F',
				emotion: 'focus'
			}),
		'wc-r32-host-exit': () =>
			bgStands('#7E7A75') +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'bronze',
				hair: 'brown',
				hairStyle: 'cap',
				shirt: WC_SHIRT.usaW,
				shirtShadow: '#B0A480',
				stripe: '#C8102E',
				emotion: 'defeat'
			}),
		'wc-r32-extra-time': () =>
			bgStands('#E2B842') +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'almond',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.dark,
				shirtShadow: '#100B07',
				emotion: 'anticipation'
			}),
		'wc-netherlands-qf': () =>
			bgFlagHoriz({ c1: '#AE1C28', c2: '#F2ECDC', c3: '#21468B' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'sand',
				hair: 'blonde',
				hairStyle: 'short',
				shirt: '#EA6F1E',
				shirtShadow: '#B5530F',
				emotion: 'anticipation'
			}) +
			ballProp({ cx: 230, cy: 62, r: 6 }),
		'wc-germany-qf': () =>
			bgFlagHoriz({ c1: '#000000', c2: '#DD0000', c3: '#FFCE00' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'sand',
				hair: 'blonde',
				hairStyle: 'short',
				shirt: '#F2ECDC',
				shirtShadow: '#C2BBA8',
				emotion: 'focus'
			}) +
			ballProp({ cx: 230, cy: 62, r: 6 }),
		'wc-r16-red-card': () =>
			bgStands('#7E7A75') +
			wcFace({
				cx: 120,
				cy: 50,
				skin: 'almond',
				hair: 'charcoal',
				hairStyle: 'short',
				shirt: WC_SHIRT.ref,
				shirtShadow: '#0E0D0B',
				emotion: 'defeat'
			}) +
			redCardProp({ cx: 186, cy: 38, rot: -14 }),
		'wc-r16-penalty-shootout': () =>
			bgPerspective(WC_SHIRT.cream) +
			wcFace({
				cx: 120,
				cy: 48,
				skin: 'mahog',
				hair: 'jet',
				hairStyle: 'short',
				shirt: WC_SHIRT.jersey,
				shirtShadow: '#1F3A1A',
				emotion: 'dread'
			}) +
			ballProp({ cx: 206, cy: 70, r: 7 }),
		'wc-africa-qf': () =>
			bgFlagHoriz({ c1: '#1F8A5B', c2: '#F2ECDC', c3: '#D4A017' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'mahog',
				hair: 'jet',
				hairStyle: 'short',
				shirt: '#1F8A5B',
				shirtShadow: '#145F3E',
				emotion: 'joy'
			}) +
			ballProp({ cx: 230, cy: 62, r: 6 }),
		'wc-asia-qf': () =>
			bgFlagHoriz({ c1: '#C8102E', c2: '#F2ECDC', c3: '#C8102E' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'almond',
				hair: 'jet',
				hairStyle: 'short',
				shirt: '#C8102E',
				shirtShadow: '#8A0E20',
				emotion: 'anticipation'
			}) +
			ballProp({ cx: 230, cy: 62, r: 6 }),
		'wc-qf-late-winner': () =>
			bgStands('#E2B842') +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'umber',
				hair: 'jet',
				hairStyle: 'short',
				shirt: WC_SHIRT.brazil,
				shirtShadow: '#C4A300',
				emotion: 'joy'
			}) +
			ballProp({ cx: 228, cy: 60, r: 6 }),
		'wc-qf-goalless-90': () =>
			bgPerspective(WC_SHIRT.cream) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'sand',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.dark,
				shirtShadow: '#100B07',
				emotion: 'focus'
			}),
		'wc-keeper-double-save': () =>
			bgPerspective(WC_SHIRT.cream) +
			wcFace({
				cx: 120,
				cy: 48,
				skin: 'sand',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.jersey,
				shirtShadow: '#1F3A1A',
				emotion: 'joy'
			}) +
			ballProp({ cx: 206, cy: 70, r: 7 }),
		'wc-europe-three-sf': () =>
			bgFlagHoriz({ c1: '#0055A4', c2: '#F2ECDC', c3: '#C8102E' }) +
			wcFace({
				cx: 120,
				cy: 48,
				skin: 'sand',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.france,
				shirtShadow: '#003A78',
				emotion: 'focus'
			}) +
			trophyIcon({ cx: 212, cy: 54, scale: 0.8 }),
		'wc-sf-comeback': () =>
			bgSpotlight({ c1: WC_SHIRT.gold, c2: WC_SHIRT.cream }) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'olive',
				hair: 'brown',
				hairStyle: 'curly',
				shirt: WC_SHIRT.arg,
				shirtShadow: '#5189B8',
				emotion: 'joy'
			}) +
			ballProp({ cx: 228, cy: 62, r: 6 }),
		'wc-final-rematch': () =>
			bgTV(WC_SHIRT.gold) +
			wcFace({
				cx: 64,
				cy: 50,
				skin: 'almond',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.dark,
				shirtShadow: '#100B07',
				emotion: 'anticipation'
			}),
		'wc-final-red-card': () =>
			bgStands('#7E7A75') +
			wcFace({
				cx: 120,
				cy: 50,
				skin: 'almond',
				hair: 'charcoal',
				hairStyle: 'short',
				shirt: WC_SHIRT.ref,
				shirtShadow: '#0E0D0B',
				emotion: 'defeat'
			}) +
			redCardProp({ cx: 188, cy: 36, rot: -16 }),
		'wc-final-extra-time': () =>
			bgSpotlight({ c1: WC_SHIRT.gold, c2: WC_SHIRT.cream }) +
			wcFace({
				cx: 120,
				cy: 48,
				skin: 'almond',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.dark,
				shirtShadow: '#100B07',
				emotion: 'dread'
			}) +
			ballProp({ cx: 208, cy: 68, r: 6 }),
		'wc-final-sub-scores': () =>
			bgBunting({ c1: WC_SHIRT.gold, c2: '#FF6B6B', c3: '#6FE0B6' }) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'almond',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.brazil,
				shirtShadow: '#C4A300',
				emotion: 'joy'
			}) +
			ballProp({ cx: 228, cy: 62, r: 6 }),
		'wc-final-captain-30': () =>
			bgSpotlight({ c1: WC_SHIRT.gold, c2: WC_SHIRT.cream }) +
			wcFace({
				cx: 120,
				cy: 48,
				skin: 'bronze',
				hair: 'gray',
				hairStyle: 'short',
				shirt: WC_SHIRT.dark,
				shirtShadow: '#100B07',
				emotion: 'joy'
			}) +
			trophyIcon({ cx: 210, cy: 52, scale: 0.95 }),
		'wc-final-attendance': () =>
			bgStands('#E2B842') +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'bronze',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.cream,
				shirtShadow: '#B0A480',
				emotion: 'joy'
			}),
		'wc-golden-glove-eur': () =>
			bgCircle({ color: WC_SHIRT.gold, cx: 198, cy: 50, r: 50 }) +
			wcFace({
				cx: 122,
				cy: 46,
				skin: 'sand',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.jersey,
				shirtShadow: '#1F3A1A',
				emotion: 'focus'
			}),
		'wc-topscorer-host': () =>
			bgCircle({ color: WC_SHIRT.gold, cx: 70, cy: 50, r: 50 }) +
			wcFace({
				cx: 150,
				cy: 46,
				skin: 'bronze',
				hair: 'brown',
				hairStyle: 'cap',
				shirt: WC_SHIRT.usaW,
				shirtShadow: '#B0A480',
				stripe: '#C8102E',
				emotion: 'focus'
			}) +
			goldenBoot({ cx: 214, cy: 58, scale: 0.95 }),
		'wc-cards-record': () =>
			bgStands('#7E7A75') +
			wcFace({
				cx: 120,
				cy: 50,
				skin: 'almond',
				hair: 'charcoal',
				hairStyle: 'short',
				shirt: WC_SHIRT.ref,
				shirtShadow: '#0E0D0B',
				emotion: 'defeat'
			}) +
			redCardProp({ cx: 180, cy: 38, rot: -12 }) +
			redCardProp({ cx: 206, cy: 40, rot: 12 }),
		'wc-goals-record': () =>
			bgPerspective(WC_SHIRT.cream) +
			wcFace({
				cx: 78,
				cy: 50,
				skin: 'umber',
				hair: 'jet',
				hairStyle: 'short',
				shirt: WC_SHIRT.brazil,
				shirtShadow: '#C4A300',
				emotion: 'joy'
			}) +
			ballProp({ cx: 176, cy: 54, r: 7 }) +
			ballProp({ cx: 212, cy: 40, r: 5 }) +
			ballProp({ cx: 240, cy: 64, r: 5 }),
		'wc-five-shootouts': () =>
			bgPerspective(WC_SHIRT.cream) +
			wcFace({
				cx: 120,
				cy: 48,
				skin: 'mahog',
				hair: 'jet',
				hairStyle: 'short',
				shirt: WC_SHIRT.jersey,
				shirtShadow: '#1F3A1A',
				emotion: 'dread'
			}) +
			ballProp({ cx: 206, cy: 70, r: 7 }),
		'wc-manager-former-winner': () =>
			bgStands('#7E7A75') +
			wcFace({
				cx: 110,
				cy: 50,
				skin: 'sand',
				hair: 'gray',
				hairStyle: 'short',
				shirt: WC_SHIRT.suit,
				shirtShadow: '#0E1626',
				emotion: 'anticipation'
			}) +
			trophyIcon({ cx: 206, cy: 52, scale: 0.85 }),
		'wc-final-most-watched': () =>
			bgTV(WC_SHIRT.gold) +
			wcFace({
				cx: 64,
				cy: 50,
				skin: 'almond',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.dark,
				shirtShadow: '#100B07',
				emotion: 'joy'
			}),

		// ── Expansion: bespoke recipes replacing the generic-pitch fallback ──
		'wc-fast-squads': () =>
			bgStands('#7E7A75') +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'sand',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.suit,
				shirtShadow: '#0E1626',
				emotion: 'focus'
			}),
		'wc-fast-friendly': () =>
			bgFlagHoriz({ c1: '#C8102E', c2: '#F2ECDC', c3: '#0A3161' }) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'bronze',
				hair: 'brown',
				hairStyle: 'cap',
				shirt: WC_SHIRT.usaW,
				shirtShadow: '#B0A480',
				stripe: '#C8102E',
				emotion: 'focus'
			}) +
			ballProp({ cx: 232, cy: 62, r: 6 }),
		'wc-fast-injury': () =>
			bgFlagVert({ c1: '#0055A4', c2: '#F2ECDC', c3: '#EF4135' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'sand',
				hair: 'auburn',
				hairStyle: 'short',
				shirt: WC_SHIRT.france,
				shirtShadow: '#003A78',
				emotion: 'focus'
			}) +
			ballProp({ cx: 232, cy: 62, r: 6 }),
		'wc-fast-kit': () =>
			bgFlagDiag({ c1: '#FFD800', c2: '#0F8C3A', c3: '#0033A0' }) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'almond',
				hair: 'brown',
				hairStyle: 'curly',
				shirt: WC_SHIRT.brazil,
				shirtShadow: '#C4A300',
				emotion: 'anticipation'
			}),
		'wc-opener-early-goal': () =>
			bgFlagVert({ c1: '#006847', c2: '#F2ECDC', c3: '#CE1126' }) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'bronze',
				hair: 'jet',
				hairStyle: 'short',
				shirt: '#006847',
				shirtShadow: '#00432E',
				emotion: 'anticipation'
			}) +
			ballProp({ cx: 228, cy: 60, r: 6 }),
		'wc-canada-md1': () =>
			bgFlagVert({ c1: '#FF0000', c2: '#F2ECDC', c3: '#FF0000' }) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'sand',
				hair: 'brown',
				hairStyle: 'short',
				shirt: '#D80621',
				shirtShadow: '#8A0010',
				emotion: 'focus'
			}) +
			ballProp({ cx: 232, cy: 62, r: 6 }),
		'wc-usa-md1': () =>
			bgFlagHoriz({ c1: '#C8102E', c2: '#F2ECDC', c3: '#0A3161' }) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'bronze',
				hair: 'brown',
				hairStyle: 'cap',
				shirt: WC_SHIRT.usaW,
				shirtShadow: '#B0A480',
				stripe: '#C8102E',
				emotion: 'focus'
			}) +
			ballProp({ cx: 232, cy: 62, r: 6 }),
		'wc-brazil-clean-md1': () =>
			bgFlagDiag({ c1: '#FFD800', c2: '#0F8C3A', c3: '#0033A0' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'umber',
				hair: 'jet',
				hairStyle: 'short',
				shirt: WC_SHIRT.brazil,
				shirtShadow: '#C4A300',
				emotion: 'focus'
			}) +
			ballProp({ cx: 230, cy: 62, r: 6 }),
		'wc-england-md1': () =>
			bgFlagHoriz({ c1: '#F2ECDC', c2: '#C8102E', c3: '#F2ECDC' }) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'sand',
				hair: 'brown',
				hairStyle: 'short',
				shirt: '#F2ECDC',
				shirtShadow: '#C2BBA8',
				emotion: 'focus'
			}) +
			ballProp({ cx: 232, cy: 62, r: 6 }),
		'wc-md1-redcard': () =>
			bgStands('#7E7A75') +
			wcFace({
				cx: 120,
				cy: 50,
				skin: 'almond',
				hair: 'charcoal',
				hairStyle: 'short',
				shirt: WC_SHIRT.ref,
				shirtShadow: '#0E0D0B',
				emotion: 'defeat'
			}) +
			redCardProp({ cx: 186, cy: 38, rot: -15 }),
		'wc-md1-hattrick': () =>
			bgPerspective(WC_SHIRT.cream) +
			wcFace({
				cx: 78,
				cy: 50,
				skin: 'umber',
				hair: 'jet',
				hairStyle: 'short',
				shirt: WC_SHIRT.jersey,
				shirtShadow: '#1F3A1A',
				emotion: 'joy'
			}) +
			ballProp({ cx: 176, cy: 54, r: 7 }) +
			ballProp({ cx: 212, cy: 40, r: 5 }) +
			ballProp({ cx: 240, cy: 64, r: 5 }),
		'wc-debutant-upset': () =>
			bgPerspective(WC_SHIRT.cream) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'mahog',
				hair: 'jet',
				hairStyle: 'short',
				shirt: WC_SHIRT.dark,
				shirtShadow: '#100B07',
				emotion: 'joy'
			}) +
			ballProp({ cx: 228, cy: 60, r: 6 }),
		'wc-argentina-2wins': () =>
			bgFlagHoriz({ c1: '#75AADB', c2: '#F2ECDC', c3: '#75AADB' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'olive',
				hair: 'brown',
				hairStyle: 'curly',
				shirt: WC_SHIRT.arg,
				shirtShadow: '#5189B8',
				emotion: 'anticipation'
			}) +
			ballProp({ cx: 232, cy: 62, r: 6 }),
		'wc-france-top-group': () =>
			bgFlagVert({ c1: '#0055A4', c2: '#F2ECDC', c3: '#EF4135' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'sand',
				hair: 'auburn',
				hairStyle: 'short',
				shirt: WC_SHIRT.france,
				shirtShadow: '#003A78',
				emotion: 'focus'
			}) +
			ballProp({ cx: 232, cy: 62, r: 6 }),
		'wc-spain-9pts': () =>
			bgFlagHoriz({ c1: '#C8102E', c2: '#F1BF00', c3: '#C8102E' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'almond',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.spain,
				shirtShadow: '#8A0E20',
				emotion: 'focus'
			}) +
			ballProp({ cx: 232, cy: 62, r: 6 }),
		'wc-group-0-0': () =>
			bgPerspective(WC_SHIRT.cream) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'sand',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.dark,
				shirtShadow: '#100B07',
				emotion: 'dread'
			}),
		'wc-late-qualify-goal': () =>
			bgStands('#E2B842') +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'almond',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.jersey,
				shirtShadow: '#1F3A1A',
				emotion: 'joy'
			}) +
			ballProp({ cx: 228, cy: 60, r: 6 }),
		'wc-hosts-all-advance': () =>
			bgFlagHoriz({ c1: '#C8102E', c2: '#F2ECDC', c3: '#0A3161' }) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'bronze',
				hair: 'brown',
				hairStyle: 'cap',
				shirt: WC_SHIRT.usaW,
				shirtShadow: '#B0A480',
				stripe: '#C8102E',
				emotion: 'joy'
			}),
		'wc-africa-2-advance': () =>
			bgFlagHoriz({ c1: '#1F8A5B', c2: '#F2ECDC', c3: '#D4A017' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'mahog',
				hair: 'jet',
				hairStyle: 'short',
				shirt: '#1F8A5B',
				shirtShadow: '#145F3E',
				emotion: 'joy'
			}) +
			ballProp({ cx: 232, cy: 62, r: 6 }),
		'wc-asia-knockouts': () =>
			bgFlagHoriz({ c1: '#C8102E', c2: '#F2ECDC', c3: '#C8102E' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'almond',
				hair: 'jet',
				hairStyle: 'short',
				shirt: '#C8102E',
				shirtShadow: '#8A0E20',
				emotion: 'anticipation'
			}) +
			ballProp({ cx: 232, cy: 62, r: 6 }),
		'wc-debutant-knockout': () =>
			bgPerspective(WC_SHIRT.cream) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'bronze',
				hair: 'jet',
				hairStyle: 'short',
				shirt: WC_SHIRT.dark,
				shirtShadow: '#100B07',
				emotion: 'joy'
			}) +
			ballProp({ cx: 228, cy: 60, r: 6 }),
		'wc-group-goals-avg': () =>
			bgPerspective(WC_SHIRT.cream) +
			wcFace({
				cx: 78,
				cy: 50,
				skin: 'olive',
				hair: 'gray',
				hairStyle: 'short',
				shirt: WC_SHIRT.jersey,
				shirtShadow: '#1F3A1A',
				emotion: 'joy'
			}) +
			ballProp({ cx: 176, cy: 54, r: 7 }) +
			ballProp({ cx: 214, cy: 42, r: 5 }) +
			ballProp({ cx: 242, cy: 64, r: 5 }),
		'wc-r32-penalties': () =>
			bgPerspective(WC_SHIRT.cream) +
			wcFace({
				cx: 120,
				cy: 48,
				skin: 'mahog',
				hair: 'jet',
				hairStyle: 'short',
				shirt: WC_SHIRT.jersey,
				shirtShadow: '#1F3A1A',
				emotion: 'dread'
			}) +
			ballProp({ cx: 206, cy: 70, r: 7 }),
		'wc-mexico-r16': () =>
			bgFlagVert({ c1: '#006847', c2: '#F2ECDC', c3: '#CE1126' }) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'bronze',
				hair: 'jet',
				hairStyle: 'short',
				shirt: '#006847',
				shirtShadow: '#00432E',
				emotion: 'anticipation'
			}) +
			ballProp({ cx: 228, cy: 60, r: 6 }),
		'wc-favorite-out-r32': () =>
			bgPerspective(WC_SHIRT.cream) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'almond',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.spain,
				shirtShadow: '#8A0E20',
				emotion: 'defeat'
			}),
		'wc-r32-comeback': () =>
			bgPerspective(WC_SHIRT.cream) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'olive',
				hair: 'brown',
				hairStyle: 'curly',
				shirt: WC_SHIRT.arg,
				shirtShadow: '#5189B8',
				emotion: 'joy'
			}) +
			ballProp({ cx: 228, cy: 60, r: 6 }),
		'wc-spain-qf': () =>
			bgFlagHoriz({ c1: '#C8102E', c2: '#F1BF00', c3: '#C8102E' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'almond',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.spain,
				shirtShadow: '#8A0E20',
				emotion: 'anticipation'
			}) +
			ballProp({ cx: 232, cy: 62, r: 6 }),
		'wc-england-qf': () =>
			bgFlagHoriz({ c1: '#F2ECDC', c2: '#C8102E', c3: '#F2ECDC' }) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'sand',
				hair: 'brown',
				hairStyle: 'short',
				shirt: '#F2ECDC',
				shirtShadow: '#C2BBA8',
				emotion: 'anticipation'
			}) +
			ballProp({ cx: 232, cy: 62, r: 6 }),
		'wc-host-in-qf': () =>
			bgFlagHoriz({ c1: '#C8102E', c2: '#F2ECDC', c3: '#0A3161' }) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'bronze',
				hair: 'brown',
				hairStyle: 'cap',
				shirt: WC_SHIRT.usaW,
				shirtShadow: '#B0A480',
				stripe: '#C8102E',
				emotion: 'anticipation'
			}),
		'wc-r16-extra-time': () =>
			bgStands('#E2B842') +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'almond',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.dark,
				shirtShadow: '#100B07',
				emotion: 'anticipation'
			}),
		'wc-qf-shootout': () =>
			bgPerspective(WC_SHIRT.cream) +
			wcFace({
				cx: 120,
				cy: 48,
				skin: 'sand',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.jersey,
				shirtShadow: '#1F3A1A',
				emotion: 'dread'
			}) +
			ballProp({ cx: 206, cy: 70, r: 7 }),
		'wc-samerica-sf': () =>
			bgFlagDiag({ c1: '#FFD800', c2: '#0F8C3A', c3: '#75AADB' }) +
			wcFace({
				cx: 140,
				cy: 44,
				skin: 'umber',
				hair: 'jet',
				hairStyle: 'short',
				shirt: WC_SHIRT.brazil,
				shirtShadow: '#C4A300',
				emotion: 'anticipation'
			}) +
			ballProp({ cx: 230, cy: 64, r: 6 }),
		'wc-all-top8-sf': () =>
			bgSpotlight({ c1: WC_SHIRT.gold, c2: WC_SHIRT.cream }) +
			wcFace({
				cx: 120,
				cy: 48,
				skin: 'almond',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.dark,
				shirtShadow: '#100B07',
				emotion: 'focus'
			}) +
			trophyIcon({ cx: 210, cy: 54, scale: 0.8 }),
		'wc-surprise-sf': () =>
			bgPerspective(WC_SHIRT.cream) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'mahog',
				hair: 'jet',
				hairStyle: 'short',
				shirt: WC_SHIRT.jersey,
				shirtShadow: '#1F3A1A',
				emotion: 'joy'
			}) +
			ballProp({ cx: 228, cy: 60, r: 6 }),
		'wc-brazil-final': () =>
			bgFlagDiag({ c1: '#FFD800', c2: '#0F8C3A', c3: '#0033A0' }) +
			wcFace({
				cx: 120,
				cy: 44,
				skin: 'umber',
				hair: 'jet',
				hairStyle: 'short',
				shirt: WC_SHIRT.brazil,
				shirtShadow: '#C4A300',
				emotion: 'anticipation'
			}) +
			trophyIcon({ cx: 214, cy: 52, scale: 0.9 }),
		'wc-eur-vs-sam-final': () =>
			bgFlagDiag({ c1: '#0055A4', c2: '#F2ECDC', c3: '#FFD800' }) +
			wcFace({
				cx: 120,
				cy: 48,
				skin: 'sand',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.france,
				shirtShadow: '#003A78',
				emotion: 'focus'
			}) +
			trophyIcon({ cx: 214, cy: 54, scale: 0.85 }),
		'wc-sf-both-90': () =>
			bgStands('#7E7A75') +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'almond',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.dark,
				shirtShadow: '#100B07',
				emotion: 'focus'
			}),
		'wc-3rd-place-goals': () =>
			bgPerspective(WC_SHIRT.cream) +
			wcFace({
				cx: 96,
				cy: 50,
				skin: 'olive',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.jersey,
				shirtShadow: '#1F3A1A',
				emotion: 'joy'
			}) +
			ballProp({ cx: 190, cy: 54, r: 7 }) +
			ballProp({ cx: 224, cy: 40, r: 5 }) +
			ballProp({ cx: 252, cy: 64, r: 5 }),
		'wc-final-1h-goal': () =>
			bgSpotlight({ c1: WC_SHIRT.gold, c2: WC_SHIRT.cream }) +
			wcFace({
				cx: 140,
				cy: 46,
				skin: 'almond',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.dark,
				shirtShadow: '#100B07',
				emotion: 'anticipation'
			}) +
			ballProp({ cx: 226, cy: 62, r: 6 }),
		'wc-golden-ball-fwd': () =>
			bgCircle({ color: WC_SHIRT.gold, cx: 198, cy: 50, r: 52 }) +
			wcFace({
				cx: 122,
				cy: 46,
				skin: 'umber',
				hair: 'jet',
				hairStyle: 'short',
				shirt: WC_SHIRT.dark,
				shirtShadow: '#100B07',
				emotion: 'focus'
			}) +
			trophyIcon({ cx: 214, cy: 54, scale: 0.7 }),
		'wc-young-player-eur': () =>
			bgCircle({ color: WC_SHIRT.gold, cx: 198, cy: 50, r: 50 }) +
			wcFace({
				cx: 124,
				cy: 46,
				skin: 'sand',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.france,
				shirtShadow: '#003A78',
				emotion: 'focus'
			}),
		'wc-topscorer-6': () =>
			bgCircle({ color: WC_SHIRT.gold, cx: 70, cy: 50, r: 50 }) +
			wcFace({
				cx: 150,
				cy: 46,
				skin: 'mahog',
				hair: 'jet',
				hairStyle: 'short',
				shirt: WC_SHIRT.dark,
				shirtShadow: '#100B07',
				emotion: 'focus'
			}) +
			goldenBoot({ cx: 214, cy: 58, scale: 0.95 }),
		'wc-new-champion-conf': () =>
			bgPerspective(WC_SHIRT.cream) +
			wcFace({
				cx: 120,
				cy: 48,
				skin: 'mahog',
				hair: 'jet',
				hairStyle: 'short',
				shirt: '#1F8A5B',
				shirtShadow: '#145F3E',
				emotion: 'joy'
			}) +
			trophyIcon({ cx: 212, cy: 54, scale: 0.85 }),
		'wc-mascot-meme': () =>
			bgFlagHoriz({ c1: '#C8102E', c2: '#F1BF00', c3: '#C8102E' }) +
			wcFace({
				cx: 120,
				cy: 44,
				skin: 'almond',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.spain,
				shirtShadow: '#8A0E20',
				emotion: 'focus'
			}) +
			trophyIcon({ cx: 214, cy: 52, scale: 0.9 }),
		'wc-pitch-invader': () =>
			bgStands('#7E7A75') +
			wcFace({
				cx: 140,
				cy: 50,
				skin: 'sand',
				hair: 'brown',
				hairStyle: 'short',
				shirt: WC_SHIRT.cream,
				shirtShadow: '#B0A480',
				emotion: 'playful'
			}) +
			ballProp({ cx: 232, cy: 64, r: 6 }),
		'wc-commentator-cry': () =>
			bgTV(WC_SHIRT.gold) +
			wcFace({
				cx: 64,
				cy: 50,
				skin: 'almond',
				hair: 'gray',
				hairStyle: 'short',
				shirt: WC_SHIRT.suit,
				shirtShadow: '#0E1626',
				emotion: 'defeat'
			})
	};

	// === FALLBACK (seed-varied) ==============================
	// Most live WC markets never match a curated `recipes` key — the
	// backend hands the frontend opaque market ids, and even the
	// hand-authored advancement markets (`wc-it-r16`, …) aren't keyed
	// here. They used to collapse onto one identical pitch-and-figure
	// scene, so every WC card looked the same (#502). Instead, compose
	// a deterministic-but-distinct scene from the seed: each market
	// picks its own backdrop, kit, figure and prop, and the same id
	// always renders the same scene. Seeded off the raw market id only
	// (not theme/state) so the composition stays stable across
	// dark / light / peach while the palette `p` still recolours it.
	const seedKey = typeof seed === 'string' ? seed : String(seed);

	const generativeFallback = (): string => {
		const g = makeRng(`wc-fallback::${seedKey}`);

		// National colour trios reused by the flag backdrops.
		const trios = [
			{ c1: '#FFD800', c2: '#0F8C3A', c3: '#0033A0' },
			{ c1: '#C8102E', c2: '#F1BF00', c3: '#C8102E' },
			{ c1: '#0055A4', c2: '#F2ECDC', c3: '#EF4135' },
			{ c1: '#75AADB', c2: '#F2ECDC', c3: '#75AADB' },
			{ c1: '#000000', c2: '#DD0000', c3: '#FFCE00' },
			{ c1: '#046A38', c2: '#F2ECDC', c3: '#C8102E' }
		];

		const backdrops: Array<() => string> = [
			() => bgPerspective(WC_SHIRT.cream),
			() => bgFlagDiag(g.pick(trios)),
			() => bgFlagHoriz(g.pick(trios)),
			() => bgFlagVert(g.pick(trios)),
			() => bgCircle({ color: WC_SHIRT.gold, cx: g.int(80, 200), cy: 50, r: g.int(48, 58) }),
			() => bgSpotlight({ c1: WC_SHIRT.gold, c2: WC_SHIRT.cream }),
			() => bgStands('#7E7A75'),
			() => bgBunting({ c1: WC_SHIRT.gold, c2: '#FF6B6B', c3: '#6FE0B6' })
		];

		// Kit + matching shadow, mirroring the curated recipes so light
		// shirts (cream) don't get a near-black shadow plane.
		const kits = [
			{ shirt: WC_SHIRT.brazil, shadow: '#C4A300' },
			{ shirt: WC_SHIRT.spain, shadow: '#8A0E20' },
			{ shirt: WC_SHIRT.france, shadow: '#003A78' },
			{ shirt: WC_SHIRT.arg, shadow: '#5189B8' },
			{ shirt: WC_SHIRT.dark, shadow: '#100B07' },
			{ shirt: WC_SHIRT.jersey, shadow: '#1F3A1A' },
			{ shirt: WC_SHIRT.suit, shadow: '#0E1626' },
			{ shirt: WC_SHIRT.cream, shadow: '#B0A480' }
		];

		// `WC_SKIN` is a `Record<string, …>`, so its key type is `string`
		// and an `as` cast here is a no-op (eslint strips it) — annotate
		// instead. `WC_HAIR` is `as const`, so it needs the assertion to
		// recover the literal union from `Object.keys`' `string[]`.
		const skins: (keyof typeof WC_SKIN)[] = Object.keys(WC_SKIN);
		const hairs = Object.keys(WC_HAIR) as (keyof typeof WC_HAIR)[];
		const hairStyles: WCHairStyle[] = ['short', 'curly', 'mohawk', 'cap', 'bun', 'bald'];
		const emotions: WCEmotion[] = ['joy', 'focus', 'anticipation', 'dread', 'defeat', 'playful'];

		// Figure to one side (or centred) so a prop has room on the far
		// side without overlapping the bust.
		const placement = g.pick(['left', 'center', 'right'] as const);
		const figCx = placement === 'left' ? 100 : placement === 'right' ? 180 : 140;
		const kit = g.pick(kits);

		let scene = g.pick(backdrops)();
		scene += wcFace({
			cx: figCx,
			cy: 48,
			skin: g.pick(skins),
			hair: g.pick(hairs),
			hairStyle: g.pick(hairStyles),
			shirt: kit.shirt,
			shirtShadow: kit.shadow,
			emotion: g.pick(emotions)
		});

		if (placement !== 'center') {
			const propCx = placement === 'left' ? 218 : 62;
			const prop = g.pick([
				() => ballProp({ cx: propCx, cy: 60, r: 6 }),
				() => trophyIcon({ cx: propCx, cy: 56, scale: 0.85 }),
				() => goldenBoot({ cx: propCx, cy: 60, scale: 0.9 }),
				() => redCardProp({ cx: propCx, cy: 40 })
			]);
			scene += prop();
		}

		return scene;
	};

	// Per-nation advancement scene — flag backdrop + home kit + figure,
	// driven by the `WC_NATIONS` table. Renders a flag-true card for the
	// featured-event markets (`wc-br-r16`, `wc-it-r16`, …) and any other
	// `wc-{cc}-*` id whose code is a known nation.
	const nationScene = (n: WCNation): string => {
		const flag = { c1: n.c1, c2: n.c2, c3: n.c3 };
		const bg =
			n.layout === 'diag'
				? bgFlagDiag(flag)
				: n.layout === 'vert'
					? bgFlagVert(flag)
					: bgFlagHoriz(flag);

		return (
			bg +
			wcFace({
				cx: 140,
				cy: 44,
				skin: n.skin,
				hair: n.hair,
				hairStyle: n.hairStyle,
				shirt: n.shirt,
				shirtShadow: n.shadow,
				emotion: 'anticipation'
			}) +
			ballProp({ cx: 232, cy: 62, r: 6 })
		);
	};

	// Resolution order: curated recipe → known nation → seed-varied
	// fallback. The nation tier only fires on non-curated ids (recipes
	// win first), so it can't shadow a hand-authored scene.
	const nationCode = /^wc-([a-z]{2})(?:-|$)/.exec(seedKey)?.[1];
	const nation = nationCode ? WC_NATIONS[nationCode] : undefined;
	const recipe = recipes[seedKey] ?? (nation ? () => nationScene(nation) : generativeFallback);

	let s = recipe();

	// Lost → desaturated veil over whichever scene fired.
	if (state === 'lost') {
		s += `<rect width="280" height="100" fill="${p.bg}" opacity="0.32"/>`;
	}

	return s;
};

const RENDERERS: Record<FlowArtCategory, (args: RenderArgs) => string> = {
	macro: renderMacro,
	crypto: renderCrypto,
	sports: renderSports,
	politics: renderPolitics,
	tech: renderTech,
	culture: renderCulture,
	wc: renderWC
};

// =============================================================
//   Public API
// =============================================================

export const renderFlowArt = ({
	category,
	seed,
	state = 'neutral',
	theme = 'dark',
	size = 240,
	frame = false
}: FlowArtRenderOptions): string => {
	const renderer = RENDERERS[category] ?? renderMacro;
	const categoryPalettes = PAL[category] ?? PAL.macro;
	const themePalettes = categoryPalettes[theme] ?? categoryPalettes.dark;
	const pal = themePalettes[state] ?? themePalettes.neutral;
	const seedKey = `${category}::${seed}::${state}::${theme}`;
	const rng = makeRng(seedKey);
	// Stable per-render suffix for SVG `<defs>` ids. Multiple
	// FlowArtFrames render simultaneously in the FlowMode deck and
	// `<defs>` ids live in the document scope — without a suffix,
	// `url(#mwash)` would resolve to the first match in the document
	// (potentially another card's gradient).
	const uid = hashStr(seedKey).toString(36);
	const body = renderer({ rng, p: pal, state, uid, seed });

	if (category === 'wc') {
		// WC fills its own 280×100 background and is excluded from the
		// optional inset frame — its full-bleed editorial composition
		// already supplies the visual containment.
		return svgOpenWC(size) + body + svgClose();
	}

	let svg = svgOpen(size) + bgRect(pal) + body;

	if (frame) {
		svg += frameInset({ p: pal, state });
	}

	svg += svgClose();

	return svg;
};

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

	if (FLOW_ART_CATEGORY_SET.has(canonical)) {
		return canonical as FlowArtCategory;
	}

	const idx = hashStr(String(seed)) % FLOW_ART_CATEGORIES.length;

	return FLOW_ART_CATEGORIES[idx];
};
