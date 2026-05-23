/**
 * Disallow hardcoded user-visible text inside `.svelte` files that have
 * already opted in to i18n (i.e. that import `$lib/utils/i18n.utils`).
 *
 * Rationale
 * ---------
 * The repo has a typed i18n layer (`t({ locale, key, params })` from
 * `$lib/utils/i18n.utils`). Once a component imports it, every other
 * user-visible string in that component should go through `t(...)` too
 * — otherwise it ships in English to every locale.
 *
 * We deliberately scope this rule to files that already import
 * `i18n.utils` so it doesn't drown the long tail of untranslated
 * components in noise. New components that opt in get full enforcement;
 * legacy ones can be paid down incrementally.
 *
 * See `docs/ai/frontend/i18n.md` for the full workflow.
 *
 * Heuristics
 * ----------
 * Inside `.svelte` files that import `i18n.utils`, walk the AST and flag
 * any `SvelteText` node whose trimmed value contains 4 or more
 * consecutive letters. That catches words and sentences while ignoring:
 *   - Whitespace / template indentation.
 *   - Numbers, punctuation, currency symbols, emoji.
 *   - Short ticker / brand tokens (`BTC`, `ICP`, `OK`, `GO`, …).
 *   - Anything inside `<script>` / `<style>` blocks.
 *
 * Attribute literals (`aria-label="Close"`) are intentionally NOT
 * flagged by this rule — they live in a different node type
 * (`SvelteLiteral`) and a per-attribute allowlist would be needed to
 * keep noise down. They're covered by code review and the i18n.md
 * checklist for now.
 */
'use strict';

const I18N_UTILS_PATH = '$lib/utils/i18n.utils';
const LETTER_RUN = /[A-Za-zÀ-ÖØ-öø-ÿ]{4,}/;
const SKIP_PARENT_TYPES = new Set(['SvelteScriptElement', 'SvelteStyleElement']);

const walkSvelteText = ({ ast, onMatch }) => {
	const visit = ({ node, ancestors }) => {
		if (node === null || typeof node !== 'object' || typeof node.type !== 'string') {
			return;
		}

		if (ancestors.some((ancestor) => SKIP_PARENT_TYPES.has(ancestor.type))) {
			return;
		}

		if (node.type === 'SvelteText') {
			const raw = typeof node.value === 'string' ? node.value : '';

			if (raw.trim().length > 0 && LETTER_RUN.test(raw)) {
				onMatch({ node, raw });
			}

			return;
		}

		const nextAncestors = ancestors.concat(node);

		for (const key of Object.keys(node)) {
			if (key === 'parent' || key === 'loc' || key === 'range') {
				continue;
			}

			const child = node[key];

			if (Array.isArray(child)) {
				for (const item of child) {
					visit({ node: item, ancestors: nextAncestors });
				}

				continue;
			}

			if (child !== null && typeof child === 'object' && typeof child.type === 'string') {
				visit({ node: child, ancestors: nextAncestors });
			}
		}
	};

	visit({ node: ast, ancestors: [] });
};

module.exports = {
	meta: {
		type: 'suggestion',
		docs: {
			description:
				'Disallow hardcoded user-visible text in .svelte files that already import $lib/utils/i18n.utils.',
			category: 'i18n',
			recommended: false
		},
		messages: {
			bareText:
				'Hardcoded text "{{snippet}}" — route it through t({ locale: $localeStore, key }) from $lib/utils/i18n.utils, and add the key to every catalog under src/lib/constants/messages/. See docs/ai/frontend/i18n.md.'
		},
		schema: []
	},

	create: (context) => {
		const filename =
			typeof context.filename === 'string'
				? context.filename
				: typeof context.getFilename === 'function'
					? context.getFilename()
					: '';

		if (!filename.endsWith('.svelte')) {
			return {};
		}

		let importsI18n = false;

		return {
			ImportDeclaration: (node) => {
				if (node.source && node.source.value === I18N_UTILS_PATH) {
					importsI18n = true;
				}
			},

			'Program:exit': () => {
				if (!importsI18n) {
					return;
				}

				const sourceCode =
					context.sourceCode ??
					(typeof context.getSourceCode === 'function' ? context.getSourceCode() : null);

				if (sourceCode === null || sourceCode === undefined) {
					return;
				}

				walkSvelteText({
					ast: sourceCode.ast,
					onMatch: ({ node, raw }) => {
						const trimmed = raw.trim();
						const snippet = trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed;

						context.report({
							node,
							messageId: 'bareText',
							data: { snippet }
						});
					}
				});
			}
		};
	}
};
