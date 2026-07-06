/**
 * generate-seo-assets — the crawler-facing surface of the SPA.
 *
 * The app ships as a single static shell (`adapter-static` with an
 * `index.html` fallback and `ssr = false`), so every URL serves identical
 * HTML: crawlers and link unfurlers never see a market's question. This
 * script runs as the second `predeploy` step (after `npm run build`, see
 * `juno.config.ts`) and emits into `build/`:
 *
 *   - `sitemap.xml` — the public static routes plus one URL per visible
 *     market, so search engines discover the catalog at all.
 *   - `markets/{id}/index.html` and `m/{id}/index.html` — copies of the
 *     built shell with the market's title/description swapped into
 *     `<title>`, the description meta, the canonical link and the
 *     OG/Twitter tags. The share alias (`/m/{id}`) canonicalizes to
 *     `/markets/{id}` so the two never compete in search.
 *
 * Contract with `src/app.html`: the head tags rewritten here must keep
 * matching the patterns below — the script hard-fails when a pattern stops
 * matching, so an app.html refactor can't silently strip the SEO layer.
 *
 * Visibility mirrors the live feed: only markets attributed to the Vici
 * engine, and World-Cup markets only once the release schedule
 * (`$lib/constants/wc-market-schedule.constants`) has revealed them. WC
 * membership is derived from the committed deck files (the same
 * title-keyed source that registered the markets), not from Juno tags, so
 * the script needs no satellite access. An unrevealed market must never
 * leak here: its question would be public before its Show Date.
 *
 * Failure is fatal by design: `hosting deploy --prune` deletes any asset
 * missing from `build/`, so a silently-degraded run would wipe every
 * previously deployed market page and the sitemap.
 */
import type { _SERVICE, Series } from '$declarations/registry/registry';
import { idlFactory } from '$declarations/registry/registry.idl.js';
import { REGISTRY_CANISTER_ID } from '$lib/constants/canisters.constants';
import {
	normalizeWcQuestion,
	WC_QUESTION_REVEAL_MS
} from '$lib/constants/wc-market-schedule.constants';
import { fromNullable, isNullish, nonNullish, toNullable } from '@dfinity/utils';
import { Actor, HttpAgent, type ActorSubclass } from '@icp-sdk/core/agent';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = join(SCRIPT_DIR, '..', '..', 'build');
const DATA_DIR = join(SCRIPT_DIR, '..', 'data');

const PROD_ORIGIN = 'https://vici.market';
const IC_HOST = 'https://icp-api.io';
const ENGINE_ID = process.env.VICI_ENGINE_ID ?? 'eng_0';
const PAGE_SIZE = 200n;

// Mirrors the market-detail `<svelte:head>` title (`market.detail.head_suffix`).
const TITLE_SUFFIX = ' | Vici Social Markets';

// Meta descriptions get truncated by search engines around this length;
// cutting at a word boundary keeps the snippet clean.
const DESCRIPTION_MAX_LENGTH = 160;

// Registry descriptions are often a terse one-liner ("Both-to-score
// market") — the brand tail turns the snippet into a call to action.
const DESCRIPTION_TAIL = 'Live community odds on Vici.';

// The committed decks that registered the World-Cup catalog (matched BY
// TITLE, like every deck pipeline step). Titles present here but absent
// from the release schedule are not-yet-curated and must stay hidden.
const WC_DECK_FILES = ['markets.deck-2026.json', 'markets.deck-2026-wc-r32.json'];

const escapeHtml = (value: string): string =>
	value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');

const collapseWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const truncateAtWord = (value: string): string => {
	const collapsed = collapseWhitespace(value);

	if (collapsed.length <= DESCRIPTION_MAX_LENGTH) {
		return collapsed;
	}

	const cut = collapsed.slice(0, DESCRIPTION_MAX_LENGTH);
	const lastSpace = cut.lastIndexOf(' ');

	return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`;
};

const composeDescription = (plain: string): string => {
	const base = truncateAtWord(plain);

	if (base.length === 0) {
		return DESCRIPTION_TAIL;
	}

	return `${/[.!?…]$/.test(base) ? base : `${base}.`} ${DESCRIPTION_TAIL}`;
};

const loadWcDeckTitles = (): Set<string> => {
	const titles = new Set<string>();

	for (const file of WC_DECK_FILES) {
		const rows: unknown = JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8'));

		if (!Array.isArray(rows)) {
			throw new Error(`Deck file ${file} is not a JSON array`);
		}

		for (const row of rows) {
			const { title } = row as Record<string, unknown>;

			if (typeof title === 'string' && title.length > 0) {
				titles.add(normalizeWcQuestion(title));
			}
		}
	}

	return titles;
};

/**
 * Replicates the FE reveal gate without Juno tag access: a title on the
 * release schedule is visible from its Show Date; a title known only to the
 * WC decks is not-yet-curated and stays hidden; anything else is a non-WC
 * market and passes through.
 */
const isMarketVisible = ({
	title,
	wcDeckTitles,
	nowMs
}: {
	title: string;
	wcDeckTitles: Set<string>;
	nowMs: number;
}): boolean => {
	const key = normalizeWcQuestion(title);
	const revealMs = WC_QUESTION_REVEAL_MS.get(key);

	if (nonNullish(revealMs)) {
		return nowMs >= revealMs;
	}

	return !wcDeckTitles.has(key);
};

const listAllSeries = async (registry: ActorSubclass<_SERVICE>): Promise<Series[]> => {
	const all: Series[] = [];
	let cursor: string | undefined = undefined;

	for (;;) {
		const page = await registry.list_series({
			cursor: toNullable(cursor),
			limit: toNullable(PAGE_SIZE)
		});

		all.push(...page.items);

		const next = fromNullable(page.next_cursor);

		if (isNullish(next) || page.items.length === 0) {
			return all;
		}

		cursor = next;
	}
};

/**
 * Replaces exactly one occurrence, or throws: a pattern that stops matching
 * means `src/app.html` drifted from the contract documented up top, and a
 * silent no-op here would ship brand-generic meta on every market page.
 */
const replaceOnce = ({
	html,
	pattern,
	replacement,
	label
}: {
	html: string;
	pattern: RegExp;
	replacement: string;
	label: string;
}): string => {
	if (!pattern.test(html)) {
		throw new Error(`SEO shell contract broken: ${label} not found in build/index.html`);
	}

	// Replacement via callback so `$…` sequences in market text stay literal.
	return html.replace(pattern, () => replacement);
};

const renderMarketShell = ({
	shell,
	title,
	description,
	canonicalUrl
}: {
	shell: string;
	title: string;
	description: string;
	canonicalUrl: string;
}): string => {
	const safeTitle = escapeHtml(collapseWhitespace(title));
	const safeDescription = escapeHtml(composeDescription(description));
	const fullTitle = `${safeTitle}${TITLE_SUFFIX}`;

	// Bounded patterns only: `[^<]` / `[^>]` cannot cross a tag boundary, so
	// a stray mention of a tag elsewhere in the shell (e.g. inside a comment)
	// can never make a pattern swallow neighbouring head tags.
	const replacements: { pattern: RegExp; replacement: string; label: string }[] = [
		{
			pattern: /<title>[^<]*<\/title>/,
			replacement: `<title>${fullTitle}</title>`,
			label: 'title tag'
		},
		{
			pattern: /<meta\s+name="description"[^>]*>/,
			replacement: `<meta name="description" content="${safeDescription}" />`,
			label: 'description meta'
		},
		{
			pattern: /<link\s+rel="canonical"[^>]*>/,
			replacement: `<link rel="canonical" href="${canonicalUrl}" />`,
			label: 'canonical link'
		},
		{
			pattern: /<meta\s+property="og:type"[^>]*>/,
			replacement: `<meta property="og:type" content="article" />`,
			label: 'og:type'
		},
		{
			pattern: /<meta\s+property="og:url"[^>]*>/,
			replacement: `<meta property="og:url" content="${canonicalUrl}" />`,
			label: 'og:url'
		},
		{
			pattern: /<meta\s+property="og:title"[^>]*>/,
			replacement: `<meta property="og:title" content="${fullTitle}" />`,
			label: 'og:title'
		},
		{
			pattern: /<meta\s+property="og:description"[^>]*>/,
			replacement: `<meta property="og:description" content="${safeDescription}" />`,
			label: 'og:description'
		},
		{
			pattern: /<meta\s+name="twitter:title"[^>]*>/,
			replacement: `<meta name="twitter:title" content="${fullTitle}" />`,
			label: 'twitter:title'
		},
		{
			pattern: /<meta\s+name="twitter:description"[^>]*>/,
			replacement: `<meta name="twitter:description" content="${safeDescription}" />`,
			label: 'twitter:description'
		}
	];

	return replacements.reduce(
		(html, { pattern, replacement, label }) => replaceOnce({ html, pattern, replacement, label }),
		shell
	);
};

const writePage = ({ relativeDir, html }: { relativeDir: string; html: string }) => {
	const dir = join(BUILD_DIR, relativeDir);

	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, 'index.html'), html, 'utf8');
};

const renderSitemap = (marketIds: string[]): string => {
	const staticPaths = ['/', '/about', '/welcome'];
	const paths = [...staticPaths, ...marketIds.map((id) => `/markets/${encodeURIComponent(id)}`)];

	const urls = paths
		.map((path) => `\t<url><loc>${escapeHtml(`${PROD_ORIGIN}${path}`)}</loc></url>`)
		.join('\n');

	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
};

const main = async () => {
	// E2E runs deploy against the emulator satellite — no mainnet registry
	// there, and no crawler either.
	if (process.env.JUNO_EMULATOR === 'true') {
		console.log('[seo-assets] JUNO_EMULATOR=true — skipping SEO asset generation.');

		return;
	}

	const shell = readFileSync(join(BUILD_DIR, 'index.html'), 'utf8');
	const wcDeckTitles = loadWcDeckTitles();

	const agent = await HttpAgent.create({ host: IC_HOST });
	const registry = Actor.createActor<_SERVICE>(idlFactory, {
		agent,
		canisterId: REGISTRY_CANISTER_ID
	});

	const series = await listAllSeries(registry);
	const viciSeries = series.filter((s) => fromNullable(s.engine_id) === ENGINE_ID);

	const nowMs = Date.now();
	const visible = viciSeries.filter(({ title }) => isMarketVisible({ title, wcDeckTitles, nowMs }));

	if (visible.length === 0) {
		throw new Error(
			`No visible markets found (fetched ${series.length} series, ${viciSeries.length} for engine ${ENGINE_ID}) — refusing to emit an empty SEO surface.`
		);
	}

	for (const market of visible) {
		const id = market.series_id;
		const canonicalUrl = `${PROD_ORIGIN}/markets/${encodeURIComponent(id)}`;
		const html = renderMarketShell({
			shell,
			title: market.title,
			description: market.description.plain,
			canonicalUrl
		});

		writePage({ relativeDir: join('markets', id), html });
		// The share alias serves the same head but canonicalizes to the
		// detail route, so unfurlers show the question while search
		// consolidates on one URL.
		writePage({ relativeDir: join('m', id), html });
	}

	const sortedIds = visible.map(({ series_id }) => series_id).sort();

	writeFileSync(join(BUILD_DIR, 'sitemap.xml'), renderSitemap(sortedIds), 'utf8');

	const hidden = viciSeries.length - visible.length;

	console.log(
		`[seo-assets] ${visible.length} market pages (×2 routes) + sitemap.xml written; ${hidden} unrevealed markets withheld; ${series.length - viciSeries.length} non-${ENGINE_ID} series ignored.`
	);
};

await main();
