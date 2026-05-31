// Deterministic character-face avatar generator. A seed string maps to a
// stable set of traits (skin, hair colour, hair style, expression, an
// optional accessory trait, and a background palette), which then render
// to a flat-plane SVG portrait. The same seed always produces the same
// face — pure, client-only, no I/O.
//
// The face is built from filled planes only (no live DOM access), so the
// component mounts the returned string via {@html ...}, mirroring the
// FlowArt artwork helpers.

// ── Trait catalogs ────────────────────────────────────────────────────

interface Skin {
	id: string;
	base: string;
	shade: string;
	light: string;
}

interface BgPalette {
	id: string;
	a: string;
	b: string;
	accent: string;
}

export interface ViciAvatarParts {
	seed: string;
	skin: Skin;
	hairColor: string;
	hairStyle: string;
	expression: string;
	trait: string;
	bg: BgPalette;
}

const SKINS: readonly Skin[] = [
	{ id: 'porc', base: '#F1C9A5', shade: '#D9A77D', light: '#FBE0C8' },
	{ id: 'tan', base: '#D9A77D', shade: '#A87B53', light: '#EFC5A1' },
	{ id: 'bronze', base: '#B0805A', shade: '#7E5536', light: '#CFA079' },
	{ id: 'mahog', base: '#7A5236', shade: '#4F3220', light: '#9C6E4D' },
	{ id: 'umber', base: '#4D3320', shade: '#2D1D13', light: '#7A5236' }
];

const HAIR_COLORS: readonly string[] = ['#1A1410', '#3B2618', '#7A4623', '#C9A66B', '#8C8579'];

const HAIR_STYLES: readonly string[] = [
	'crop',
	'short',
	'side',
	'wavy',
	'bun',
	'long',
	'curls',
	'buzz',
	'bowl',
	'undercut'
];

const EXPRESSIONS: readonly string[] = [
	'joyful',
	'focused',
	'smug',
	'skeptical',
	'confident',
	'cool'
];

const TRAITS: readonly string[] = [
	'none',
	'tortoise-glasses',
	'gold-hoop',
	'silver-streak',
	'long-hair',
	'vici-cap'
];

const BG_PALETTES: readonly BgPalette[] = [
	{ id: 'sage', a: '#5A7A56', b: '#3C5538', accent: '#E2B842' },
	{ id: 'steel', a: '#3F4654', b: '#272D38', accent: '#E2B842' },
	{ id: 'rust', a: '#9C3A2E', b: '#6E2820', accent: '#E2B842' },
	{ id: 'olive', a: '#7A6B2E', b: '#54481E', accent: '#E2B842' },
	{ id: 'royal', a: '#2E3F7C', b: '#1F2A54', accent: '#E2B842' },
	{ id: 'plum', a: '#5C3470', b: '#3F2350', accent: '#E2B842' }
];

// ── Seeded picks (deterministic from string) ──────────────────────────
//
// A dedicated 32-bit FNV-1a variant lives here rather than reusing the
// shared `fnv1a32`: the trait mapping must stay byte-stable against this
// exact mixing constant, so the avatar surface owns its own hash to keep
// the seed → face contract independent of any future hash-util change.

const hash = (str: string): number => {
	let h = 2166136261;

	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}

	return h >>> 0;
};

// Index helper: maps a hash to a slot in a catalog. Standard `(arr, n)`
// shape, so `prefer-object-params` is relaxed here as it is for the
// other small math-style helpers in this codebase.
// eslint-disable-next-line local-rules/prefer-object-params
const pick = <T>(arr: readonly T[], h: number): T => arr[h % arr.length];

/**
 * Maps a seed string to a stable set of avatar traits. The same seed
 * always yields the same parts.
 */
export const generateFromSeed = (seed: string): ViciAvatarParts => {
	const s = String(seed);

	return {
		seed: s,
		skin: pick(SKINS, hash(`${s}·skin`)),
		hairColor: pick(HAIR_COLORS, hash(`${s}·hair-color`)),
		hairStyle: pick(HAIR_STYLES, hash(`${s}·hair-style`)),
		expression: pick(EXPRESSIONS, hash(`${s}·expr`)),
		trait: pick(TRAITS, hash(`${s}·trait`)),
		bg: pick(BG_PALETTES, hash(`${s}·bg`))
	};
};

// ── SVG renderer ──────────────────────────────────────────────────────
// 100×100 viewBox. Filled planes only, no strokes on the face itself.

const EYEBROW_ANGLE: Record<string, number> = {
	joyful: 0,
	focused: -2,
	smug: -3,
	skeptical: 5,
	confident: 0,
	cool: -1
};

const EYE_SHAPE: Record<string, string> = {
	joyful: 'M0,0 A8,5 0 1,1 0.1,0 Z',
	focused: 'M0,0 A8,5.5 0 1,1 0.1,0 Z',
	smug: 'M0,0 A8,4 0 1,1 0.1,0 Z',
	skeptical: 'M0,0 A8,3.5 0 1,1 0.1,0 Z',
	confident: 'M0,0 A8,5 0 1,1 0.1,0 Z',
	cool: 'M0,0 A8,3 0 1,1 0.1,0 Z'
};

const MOUTH_SHAPE: Record<string, string> = {
	joyful: 'M37,68 Q50,80 63,68 L63,72 Q50,86 37,72 Z',
	focused: 'M42,72 Q50,74 58,72 L58,75 Q50,77 42,75 Z',
	smug: 'M40,70 Q52,72 60,68 L60,71 Q52,75 40,73 Z',
	skeptical: 'M40,72 Q50,68 60,72 L60,75 Q50,71 40,75 Z',
	confident: 'M38,68 Q50,76 62,68 L62,71 Q50,79 38,71 Z',
	cool: 'M40,72 L60,72 L60,75 L40,75 Z'
};

const HAIR: Record<string, string> = {
	crop: 'M22,30 Q22,18 50,16 Q78,18 78,30 L78,38 Q60,32 50,32 Q40,32 22,38 Z',
	short: 'M20,32 Q20,16 50,14 Q80,16 80,32 L80,42 L70,38 L60,36 L50,35 L40,36 L30,38 L20,42 Z',
	side: 'M22,32 Q22,16 50,14 Q78,16 80,30 L82,44 L72,38 L62,42 Q55,34 50,34 Q35,34 22,42 Z',
	wavy: 'M22,30 Q26,18 38,18 Q44,12 50,16 Q56,12 62,18 Q74,18 78,30 L78,42 Q70,36 60,40 Q50,32 40,40 Q30,36 22,42 Z',
	bun: 'M28,28 Q30,16 50,14 Q70,16 72,28 L74,38 Q60,34 50,34 Q40,34 26,38 Z M48,8 A6,6 0 1,0 52,8 Z',
	long: 'M20,32 Q20,14 50,12 Q80,14 80,32 L82,68 L72,64 L72,42 Q60,38 50,38 Q40,38 28,42 L28,64 L18,68 Z',
	curls:
		'M22,32 Q24,16 38,18 Q44,12 50,14 Q56,12 62,18 Q76,16 78,32 Q72,28 68,32 Q62,26 56,32 Q50,26 44,32 Q38,26 32,32 Q28,28 22,32 Z',
	buzz: 'M28,32 Q28,22 50,20 Q72,22 72,32 L72,36 Q60,33 50,33 Q40,33 28,36 Z',
	bowl: 'M20,34 Q22,14 50,12 Q78,14 80,34 L78,38 Q60,34 50,34 Q40,34 22,38 Z',
	undercut: 'M30,30 Q32,14 50,12 Q68,14 70,30 L72,40 Q60,34 50,34 Q40,34 28,40 Z'
};

const renderTrait = ({
	trait,
	eyeY,
	hairColor
}: {
	trait: string;
	eyeY: number;
	hairColor: string;
}): string => {
	switch (trait) {
		case 'tortoise-glasses':
			return `<g>
				<ellipse cx="38" cy="${eyeY}" rx="10" ry="7" fill="none" stroke="#4A2F1A" stroke-width="2.5"/>
				<ellipse cx="62" cy="${eyeY}" rx="10" ry="7" fill="none" stroke="#4A2F1A" stroke-width="2.5"/>
				<line x1="48" y1="${eyeY}" x2="52" y2="${eyeY}" stroke="#4A2F1A" stroke-width="2.5"/>
				<ellipse cx="38" cy="${eyeY - 1}" rx="3" ry="2" fill="#6B3A1F" opacity="0.6"/>
				<ellipse cx="62" cy="${eyeY + 1}" rx="3" ry="2" fill="#6B3A1F" opacity="0.6"/>
			</g>`;
		case 'gold-hoop':
			return `<circle cx="74" cy="60" r="3" fill="none" stroke="#E2B842" stroke-width="1.5"/>`;
		case 'silver-streak':
			return `<path d="M28,18 Q34,16 38,20 L38,32 Q34,28 28,30 Z" fill="#C9C0B0"/>`;
		case 'long-hair':
			return `<path d="M16,34 L16,82 Q20,84 24,82 L24,46 Q28,42 30,40 Z M84,34 L84,82 Q80,84 76,82 L76,46 Q72,42 70,40 Z" fill="${hairColor}"/>`;
		case 'vici-cap':
			return `<g>
				<path d="M22,28 Q22,14 50,12 Q78,14 78,28 L78,32 Q50,28 22,32 Z" fill="#E2B842"/>
				<text x="50" y="24" text-anchor="middle" font-family="Georgia,serif" font-size="8" font-weight="700" font-style="italic" fill="#28201E">V</text>
				<rect x="20" y="32" width="60" height="3" fill="#B68B1F"/>
			</g>`;
		default:
			return '';
	}
};

/**
 * Renders a deterministic face to an SVG string sized to `size`.
 * Filled planes plus an optional accessory trait keyed off the parts.
 */
export const renderViciAvatar = ({
	parts,
	size
}: {
	parts: ViciAvatarParts;
	size: number;
}): string => {
	const { skin, hairColor, hairStyle, expression, trait, bg } = parts;

	const eyeY = expression === 'cool' ? 52 : 50;
	const eyebrowAngle = EYEBROW_ANGLE[expression] ?? 0;
	const eyeShape = EYE_SHAPE[expression];
	const mouthShape = MOUTH_SHAPE[expression];
	const hairPath = HAIR[hairStyle] ?? HAIR.short;

	// Cool expression swaps the eyes for a flat shade band.
	const sunglasses =
		expression === 'cool'
			? `<rect x="28" y="46" width="44" height="10" rx="5" fill="#1A1A1A"/>
				<rect x="28" y="50" width="44" height="2" fill="#333" opacity="0.6"/>`
			: '';

	const eyes =
		expression !== 'cool'
			? `<g transform="translate(38, ${eyeY})">
					<path d="${eyeShape}" fill="#FFFFFF" transform="translate(-4,-2.5) scale(1, 0.9)"/>
					<circle cx="0" cy="0" r="2.2" fill="#0E0D0B"/>
					<circle cx="-0.6" cy="-0.6" r="0.8" fill="#FFFFFF"/>
				</g>
				<g transform="translate(62, ${eyeY})">
					<path d="${eyeShape}" fill="#FFFFFF" transform="translate(-4,-2.5) scale(1, 0.9)"/>
					<circle cx="0" cy="0" r="2.2" fill="#0E0D0B"/>
					<circle cx="-0.6" cy="-0.6" r="0.8" fill="#FFFFFF"/>
				</g>`
			: sunglasses;

	const hairBack =
		trait === 'long-hair' || hairStyle === 'long'
			? `<path d="${hairPath}" fill="${hairColor}"/>`
			: '';

	return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
		<rect width="100" height="100" fill="${bg.a}"/>
		<polygon points="0,0 100,0 100,40 0,80" fill="${bg.b}" opacity="0.5"/>
		<polygon points="60,0 100,0 100,30" fill="#FFFFFF" opacity="0.08"/>
		<circle cx="18" cy="76" r="6" fill="${bg.accent}" opacity="0.7"/>
		${hairBack}
		<path d="M28,36 Q28,28 36,26 L64,26 Q72,28 72,36 L74,58 Q70,72 60,80 L40,80 Q30,72 26,58 Z" fill="${skin.base}"/>
		<path d="M62,46 Q72,42 72,56 Q70,68 62,72 Z" fill="${skin.light}" opacity="0.55"/>
		<path d="M28,52 Q26,66 36,76 L42,78 Q34,66 32,52 Z" fill="${skin.shade}" opacity="0.45"/>
		<path d="M46,58 L50,64 L54,58 L50,62 Z" fill="${skin.shade}" opacity="0.7"/>
		<path d="${hairPath}" fill="${hairColor}"/>
		<g transform="translate(38, 42) rotate(${eyebrowAngle})">
			<rect x="-5" y="0" width="10" height="2" rx="1" fill="${hairColor}"/>
		</g>
		<g transform="translate(62, 42) rotate(${-eyebrowAngle})">
			<rect x="-5" y="0" width="10" height="2" rx="1" fill="${hairColor}"/>
		</g>
		${eyes}
		<path d="${mouthShape}" fill="#2A1612"/>
		<path d="${mouthShape}" fill="#9C5044" transform="translate(0, 0.5) scale(0.95)"/>
		${renderTrait({ trait, eyeY, hairColor })}
	</svg>`;
};

/**
 * Convenience: seed → ready-to-mount SVG string. Pure and deterministic.
 */
export const viciAvatarSvg = ({ seed, size }: { seed: string; size: number }): string =>
	renderViciAvatar({ parts: generateFromSeed(seed), size });
