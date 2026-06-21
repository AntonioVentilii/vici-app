import { default as svelteConfig } from '@dfinity/eslint-config-oisy-wallet/svelte';
import { default as vitestConfig } from '@dfinity/eslint-config-oisy-wallet/vitest';
import ts from 'typescript-eslint';

export default ts.config(
	...vitestConfig,
	...svelteConfig,

	{
		ignores: [
			'build/',
			'.svelte-kit/',
			'dist/',
			'static/',
			'src/declarations/',
			'.claude/worktrees/',
			// Spec asset folders carry throwaway design-source references
			// (e.g. a handover `motion-engine.js`) that aren't part of the TS
			// project; they're deleted post-merge. Not lint targets.
			'docs/ai/spec-driven-development/specs/'
		]
	},

	{
		// Build-time globals injected by vite's `define` (see `vite.config.ts`).
		languageOptions: {
			globals: {
				__APP_VERSION__: 'readonly',
				__BUILD_SHA__: 'readonly'
			}
		}
	},

	{
		rules: {
			'svelte/no-navigation-without-resolve': 'off'
		}
	},

	{
		files: ['src/**/*'],
		rules: {
			'local-rules/no-relative-imports': 'error'
		}
	},

	{
		files: ['src/**/*.svelte'],
		rules: {
			// Self-filters to .svelte files that already import $lib/utils/i18n.utils.
			// See local-rules/no-bare-svelte-text.cjs and docs/ai/frontend/i18n.md.
			// Severity is 'warn' during the i18n coverage paydown — promote to
			// 'error' once docs/ai/frontend/i18n-coverage.md is empty.
			'local-rules/no-bare-svelte-text': 'warn'
		}
	},

	{
		rules: {
			'no-restricted-syntax': [
				'error',
				{
					selector: "Literal[raw='0n']",
					message: 'Use the shared constant `ZERO` instead of `0n`.'
				},
				{
					selector: "ReturnStatement[argument.type='Identifier'][argument.name='undefined']",
					message:
						'Do not `return undefined;`. Use a bare `return;` for early exits, or in `catch` blocks let the function fall through with a comment explaining why the error is swallowed.'
				},
				{
					selector:
						"BinaryExpression[operator=/^===?$/]:matches([left.type='Identifier'][left.name='undefined'], [left.type='Literal'][left.raw='null'], [right.type='Identifier'][right.name='undefined'], [right.type='Literal'][right.raw='null'])",
					message:
						'Use `isNullish()` from `@dfinity/utils` instead of comparing against `null`/`undefined`.'
				},
				{
					selector:
						"BinaryExpression[operator=/^!==?$/]:matches([left.type='Identifier'][left.name='undefined'], [left.type='Literal'][left.raw='null'], [right.type='Identifier'][right.name='undefined'], [right.type='Literal'][right.raw='null'])",
					message:
						'Use `nonNullish()` from `@dfinity/utils` instead of comparing against `null`/`undefined`.'
				}
			]
		}
	},

	{
		rules: {
			'padding-line-between-statements': [
				'error',
				{ blankLine: 'always', prev: '*', next: 'try' },
				{ blankLine: 'always', prev: 'block-like', next: '*' },
				{ blankLine: 'always', prev: '*', next: 'block-like' },
				{ blankLine: 'always', prev: '*', next: 'return' }
			]
		}
	}
);
