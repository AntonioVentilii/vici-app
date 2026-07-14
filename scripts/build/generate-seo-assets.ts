/**
 * generate-seo-assets — the crawler-facing surface of the SPA.
 *
 * The app ships as a single static shell (`adapter-static` with an
 * `index.html` fallback and `ssr = false`), so every URL serves identical
 * HTML: crawlers and link unfurlers never see a market's question. This
 * script runs as the second `predeploy` step (after `npm run build`, see
 * `juno.config.ts`) and emits into `build/`:
 *
 *   - `sitemap.xml` — the public static routes, one URL per visible
 *     market, and the category topic page(s), so search engines discover
 *     the catalog at all.
 *   - ONE per-market copy of the built shell at `m/{slug~id8}` (the
 *     keyword-carrying canonical, same param the share sheet hands out —
 *     see `$lib/utils/market-slug.utils`) with the market's
 *     title/description swapped into `<title>`, the description meta, the
 *     canonical link and the OG/Twitter tags, a per-market JSON-LD block,
 *     plus `window.__viciSeriesId` so the `/m/[id]` route resolves the
 *     market without a catalog lookup.
 *   - ONE topic page per revealed category at `predictions/{slug}` (v1:
 *     World Cup only, derived from the committed decks — the tag index is
 *     admin-gated and unreadable by this anonymous script). It carries
 *     category-level keywords ("prediction market world cup"), the live
 *     active-market count, and `CollectionPage` + `ItemList` JSON-LD.
 *
 * Exactly one page per market, deliberately: every emitted file is staged,
 * committed AND deleted again per deploy, and the satellite recomputes the
 * asset certification tree across all assets on those bulk operations —
 * deleting ~6k staged assets exceeded the IC's 40B-instruction message
 * limit (see junobuild/juno#2263; deploy applied, cleanup failed). The
 * handful of topic pages stay well inside that budget; the plain-id routes
 * (`/markets/{id}`, `/m/{id}`) intentionally get no copies.
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
 * previously deployed market page and the sitemap. The one soft dependency
 * is live odds: a slow/unreachable clearing canister must never fail a
 * deploy, so per-market odds reads degrade to "no odds clause", never a
 * throw.
 */
import type { _SERVICE as ClearingService, LimitOrder } from '$declarations/clearing/clearing';
import { idlFactory as clearingIdlFactory } from '$declarations/clearing/clearing.idl.js';
import type { _SERVICE as RegistryService, Series } from '$declarations/registry/registry';
import { idlFactory as registryIdlFactory } from '$declarations/registry/registry.idl.js';
import { CLEARING_CANISTER_ID, REGISTRY_CANISTER_ID } from '$lib/constants/canisters.constants';
import { TOPIC_SLUG_BY_TAG } from '$lib/constants/market-tags.constants';
import {
	normalizeWcQuestion,
	WC_QUESTION_REVEAL_MS
} from '$lib/constants/wc-market-schedule.constants';
import { marketShareParam } from '$lib/utils/market-slug.utils';
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

// Bounded fan-out for the per-market odds reads: enough to keep the deploy
// step quick over a few hundred markets, low enough not to hammer the
// clearing canister with one burst.
const ODDS_CONCURRENCY = 8;

// Mirrors the market-detail `<svelte:head>` title (`market.detail.head_suffix`).
const TITLE_SUFFIX = ' | Vici Social Markets';

// Meta descriptions get truncated by search engines around this length;
// cutting at a word boundary keeps the snippet clean.
const DESCRIPTION_MAX_LENGTH = 160;

// Registry descriptions are often a terse one-liner ("Both-to-score
// market") — the brand tail turns the snippet into a call to action AND
// seeds the "prediction market" keyword into the crawler-facing meta (the
// phrase never appears in the rendered UI, only here in the head layer).
const DESCRIPTION_TAIL = 'Live community odds on the Vici prediction market.';

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

/**
 * The plain-text meta description: the (truncated) registry blurb, an
 * optional live-odds sentence, then the brand/keyword tail. Returns raw
 * text — callers HTML-escape it for meta attributes and pass it verbatim
 * into JSON-LD.
 */
const composeDescription = ({
	plain,
	yesProbability
}: {
	plain: string;
	yesProbability?: number;
}): string => {
	const base = truncateAtWord(plain);
	const sentences: string[] = [];

	if (base.length > 0) {
		sentences.push(/[.!?…]$/.test(base) ? base : `${base}.`);
	}

	if (nonNullish(yesProbability)) {
		sentences.push(`Community odds: Yes ${Math.round(yesProbability * 100)}%.`);
	}

	sentences.push(DESCRIPTION_TAIL);

	return sentences.join(' ');
};

/**
 * Serialises a schema.org object into a `<script type="application/ld+json">`
 * tag. `</` is escaped so a stray value can never close the script early.
 */
const jsonLdScript = (data: unknown): string =>
	`<script type="application/ld+json">${JSON.stringify(data).replaceAll('</', '<\\/')}</script>`;

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

const isWcMarket = ({
	title,
	wcDeckTitles
}: {
	title: string;
	wcDeckTitles: Set<string>;
}): boolean => wcDeckTitles.has(normalizeWcQuestion(title));

const listAllSeries = async (registry: ActorSubclass<RegistryService>): Promise<Series[]> => {
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
 * Current YES probability (0..1) from the resting order book, mirroring the
 * FE's `calculateMarketStats` / `calculateProbability` in
 * `$lib/utils/market.utils`: best-bid/best-ask mid when both sides exist,
 * the single side when one-sided, `undefined` when the book is empty (never
 * a 0.5 placeholder). NO orders are flipped to the YES perspective the same
 * way the live UI does.
 */
const midYesProbability = (orders: LimitOrder[]): number | undefined => {
	const bidPrices: number[] = [];
	const askPrices: number[] = [];

	for (const order of orders) {
		const side = 'Buy' in order.side ? 'BUY' : 'SELL';
		const outcomeId = fromNullable(order.outcome_id) ?? 'YES';
		const rawPrice = Number(order.price.decimal.value) / 10 ** Number(order.price.decimal.decimals);

		if (outcomeId === 'YES') {
			(side === 'BUY' ? bidPrices : askPrices).push(rawPrice);
		} else if (outcomeId === 'NO') {
			// Flip the binary opposite to the YES perspective (mirrors the live
			// UI); any other outcome is categorical and irrelevant to a Yes %.
			(side === 'BUY' ? askPrices : bidPrices).push(1 - rawPrice);
		}
	}

	const bestBid = bidPrices.length > 0 ? Math.max(...bidPrices) : undefined;
	const bestAsk = askPrices.length > 0 ? Math.min(...askPrices) : undefined;

	if (nonNullish(bestBid) && nonNullish(bestAsk)) {
		return (bestBid + bestAsk) / 2;
	}

	return bestBid ?? bestAsk;
};

/**
 * Reads one market's current YES probability. Soft by contract: any clearing
 * error degrades to `undefined` (no odds clause) rather than failing the
 * deploy — odds are a nice-to-have on top of the always-present title/desc.
 */
const fetchYesProbability = async ({
	clearing,
	seriesId
}: {
	clearing: ActorSubclass<ClearingService>;
	seriesId: string;
}): Promise<number | undefined> => {
	try {
		const orders = await clearing.list_orders({ series_id: toNullable(seriesId) });

		return midYesProbability(orders);
	} catch (err) {
		// Soft dependency: swallow and fall through to "no odds" (returns
		// undefined) rather than fail the deploy — odds are optional garnish.
		console.warn(`[seo-assets] odds read failed for ${seriesId}; emitting page without odds.`, err);
	}
};

const mapWithConcurrency = async <T, R>({
	items,
	limit,
	fn
}: {
	items: T[];
	limit: number;
	fn: (item: T) => Promise<R>;
}): Promise<R[]> => {
	const results: R[] = new Array(items.length);
	let next = 0;

	const worker = async (): Promise<void> => {
		for (;;) {
			const index = next++;

			if (index >= items.length) {
				return;
			}

			results[index] = await fn(items[index]);
		}
	};

	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

	return results;
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
	const matches = html.match(new RegExp(pattern, 'g'))?.length ?? 0;

	if (matches !== 1) {
		throw new Error(
			`SEO shell contract broken: ${label} matched ${matches} times in build/index.html (expected exactly 1)`
		);
	}

	// Replacement via callback so `$…` sequences in market text stay literal.
	return html.replace(pattern, () => replacement);
};

/**
 * Rewrites the head tags of the built shell for one crawler-facing page.
 * `ogType` is `article` for a single market, `website` for a topic page.
 */
const renderShell = ({
	shell,
	titleText,
	descriptionText,
	canonicalUrl,
	ogType
}: {
	shell: string;
	titleText: string;
	descriptionText: string;
	canonicalUrl: string;
	ogType: 'article' | 'website';
}): string => {
	const safeTitle = escapeHtml(collapseWhitespace(titleText));
	const safeDescription = escapeHtml(descriptionText);
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
			replacement: `<meta property="og:type" content="${ogType}" />`,
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

// Series ids and share params are used as path segments under `build/` — a
// separator, a `..` or any other unexpected character in one could make
// `join` escape the build directory or collide with another generated page.
// `~` is the slug/id separator of `marketShareParam`.
const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const SAFE_SHARE_PARAM_PATTERN = /^[A-Za-z0-9_~-]+$/;

/**
 * Appends the per-page extras (JSON-LD, and for markets the `__viciSeriesId`
 * hint) just before `</head>`. Each fragment keeps `</head>` intact so the
 * single-match contract holds if this is chained.
 */
const injectHeadExtras = ({ html, fragments }: { html: string; fragments: string[] }): string =>
	replaceOnce({
		html,
		pattern: /<\/head>/,
		replacement: `${fragments.join('\n\t\t')}</head>`,
		label: 'head close tag'
	});

const writePage = ({ relativeDir, html }: { relativeDir: string; html: string }) => {
	const dir = join(BUILD_DIR, relativeDir);

	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, 'index.html'), html, 'utf8');
};

const renderSitemap = ({ paths, lastmod }: { paths: string[]; lastmod: string }): string => {
	const staticPaths = ['/', '/about', '/welcome'];

	const urls = [...staticPaths, ...paths]
		.map(
			(path) =>
				`\t<url><loc>${escapeHtml(`${PROD_ORIGIN}${path}`)}</loc><lastmod>${lastmod}</lastmod></url>`
		)
		.join('\n');

	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
};

interface EmittedMarket {
	title: string;
	canonicalUrl: string;
}

const buildMarketJsonLd = ({
	title,
	descriptionText,
	canonicalUrl
}: {
	title: string;
	descriptionText: string;
	canonicalUrl: string;
}): string =>
	jsonLdScript({
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'WebPage',
				'@id': `${canonicalUrl}#webpage`,
				url: canonicalUrl,
				name: `${collapseWhitespace(title)}${TITLE_SUFFIX}`,
				description: descriptionText,
				isPartOf: { '@id': `${PROD_ORIGIN}/#website` },
				keywords: `prediction market, ${collapseWhitespace(title)}, community odds, forecast`
			},
			{
				'@type': 'BreadcrumbList',
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'VICI', item: `${PROD_ORIGIN}/` },
					{ '@type': 'ListItem', position: 2, name: collapseWhitespace(title), item: canonicalUrl }
				]
			}
		]
	});

const buildTopicPage = ({
	shell,
	slug,
	categoryName,
	markets
}: {
	shell: string;
	slug: string;
	categoryName: string;
	markets: EmittedMarket[];
}): string => {
	const canonicalUrl = `${PROD_ORIGIN}/predictions/${slug}`;
	const titleText = `${categoryName} Prediction Market — Live Community Odds`;
	const descriptionText = `Predict ${categoryName} outcomes on Vici — ${markets.length} live prediction markets with real-time community odds. Forecast, build a reputation, and earn XP.`;

	const jsonLd = jsonLdScript({
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'CollectionPage',
				'@id': `${canonicalUrl}#webpage`,
				url: canonicalUrl,
				name: `${categoryName} predictions${TITLE_SUFFIX}`,
				description: descriptionText,
				isPartOf: { '@id': `${PROD_ORIGIN}/#website` },
				keywords: `${categoryName.toLowerCase()} prediction market, prediction market ${categoryName.toLowerCase()}, ${categoryName.toLowerCase()} odds, community odds`
			},
			{
				'@type': 'BreadcrumbList',
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'VICI', item: `${PROD_ORIGIN}/` },
					{
						'@type': 'ListItem',
						position: 2,
						name: `${categoryName} predictions`,
						item: canonicalUrl
					}
				]
			},
			{
				'@type': 'ItemList',
				itemListElement: markets.map((market, index) => ({
					'@type': 'ListItem',
					position: index + 1,
					url: market.canonicalUrl,
					name: collapseWhitespace(market.title)
				}))
			}
		]
	});

	const withHead = renderShell({
		shell,
		titleText,
		descriptionText,
		canonicalUrl,
		ogType: 'website'
	});

	return injectHeadExtras({ html: withHead, fragments: [jsonLd] });
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
	const registry = Actor.createActor<RegistryService>(registryIdlFactory, {
		agent,
		canisterId: REGISTRY_CANISTER_ID
	});
	const clearing = Actor.createActor<ClearingService>(clearingIdlFactory, {
		agent,
		canisterId: CLEARING_CANISTER_ID
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

	// Live YES odds per market, fetched with bounded concurrency. Soft: a
	// clearing failure yields `undefined` and the page ships without odds.
	const oddsByIndex = await mapWithConcurrency({
		items: visible,
		limit: ODDS_CONCURRENCY,
		fn: (market) => fetchYesProbability({ clearing, seriesId: market.series_id })
	});

	const sitemapPaths: string[] = [];
	const wcEmitted: EmittedMarket[] = [];

	visible.forEach((market, index) => {
		const id = market.series_id;

		if (!SAFE_ID_PATTERN.test(id)) {
			throw new Error(`Refusing to use series id as a path segment: ${JSON.stringify(id)}`);
		}

		const shareParam = marketShareParam({ title: market.title, seriesId: id });

		if (!SAFE_SHARE_PARAM_PATTERN.test(shareParam)) {
			throw new Error(
				`Refusing to use share param as a path segment: ${JSON.stringify(shareParam)}`
			);
		}

		// The slugged share URL is the sole emitted page and the canonical: it
		// is what the share sheet hands out, the only variant whose URL
		// carries the question's keywords, and the only URL the sitemap lists.
		const canonicalUrl = `${PROD_ORIGIN}/m/${shareParam}`;
		const descriptionText = composeDescription({
			plain: market.description.plain,
			yesProbability: oddsByIndex[index]
		});

		const withHead = renderShell({
			shell,
			titleText: market.title,
			descriptionText,
			canonicalUrl,
			ogType: 'article'
		});
		const html = injectHeadExtras({
			html: withHead,
			fragments: [
				`<script>window.__viciSeriesId = ${JSON.stringify(id)};</script>`,
				buildMarketJsonLd({ title: market.title, descriptionText, canonicalUrl })
			]
		});

		writePage({ relativeDir: join('m', shareParam), html });
		sitemapPaths.push(`/m/${shareParam}`);

		if (isWcMarket({ title: market.title, wcDeckTitles })) {
			wcEmitted.push({ title: market.title, canonicalUrl });
		}
	});

	// Category topic page — v1 ships World Cup only (deck-derived; the tag
	// index this anonymous script would need for the other tags is
	// admin-gated). Skipped when nothing is revealed yet.
	if (wcEmitted.length > 0) {
		const slug = TOPIC_SLUG_BY_TAG.wc;

		writePage({
			relativeDir: join('predictions', slug),
			html: buildTopicPage({ shell, slug, categoryName: 'World Cup', markets: wcEmitted })
		});
		sitemapPaths.push(`/predictions/${slug}`);
	}

	const lastmod = new Date(nowMs).toISOString().slice(0, 10);
	writeFileSync(
		join(BUILD_DIR, 'sitemap.xml'),
		renderSitemap({ paths: [...sitemapPaths].sort(), lastmod }),
		'utf8'
	);

	const hidden = viciSeries.length - visible.length;

	console.log(
		`[seo-assets] ${visible.length} market pages + ${wcEmitted.length > 0 ? '1 topic page + ' : ''}sitemap.xml written; ${hidden} unrevealed markets withheld; ${series.length - viciSeries.length} non-${ENGINE_ID} series ignored.`
	);
};

await main();
