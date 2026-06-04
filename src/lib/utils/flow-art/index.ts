// Flow Mode generative artwork — public entry point.
//
// Six per-category visual languages (macro / crypto / sports /
// politics / tech / culture) plus the WC editorial system, × three
// states (neutral / won / lost). Same `(category, seed, state)`
// triplet always renders the identical composition; the seed flows
// through a FNV-1a hash + mulberry32 PRNG so output is byte-stable
// across reloads.
//
// Returns SVG strings — components mount via {@html ...}. No DOM
// access, no I/O — pure helper.

import { PAL } from '$lib/constants/flow-art-palettes.constants';
import { renderCrypto } from '$lib/utils/flow-art/renderers/crypto';
import { renderCulture } from '$lib/utils/flow-art/renderers/culture';
import { renderMacro } from '$lib/utils/flow-art/renderers/macro';
import { renderPolitics } from '$lib/utils/flow-art/renderers/politics';
import { renderSports } from '$lib/utils/flow-art/renderers/sports';
import { renderTech } from '$lib/utils/flow-art/renderers/tech';
import { hashStr, makeRng } from '$lib/utils/flow-art/rng';
import { bgRect, frameInset, svgClose, svgOpen, svgOpenWC } from '$lib/utils/flow-art/svg';
import {
	FLOW_ART_CATEGORIES,
	FLOW_ART_CATEGORY_SET,
	type FlowArtCategory,
	type FlowArtRenderOptions,
	type RenderArgs
} from '$lib/utils/flow-art/types';
import { renderWC } from '$lib/utils/flow-art/wc/render';

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

export { flowArtViewBox } from '$lib/utils/flow-art/svg';
export { FLOW_ART_CATEGORIES, FLOW_ART_CATEGORY_SET } from '$lib/utils/flow-art/types';
export type {
	FlowArtCategory,
	FlowArtPalette,
	FlowArtRenderOptions,
	FlowArtState,
	FlowArtTheme
} from '$lib/utils/flow-art/types';
