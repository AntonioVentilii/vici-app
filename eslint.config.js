import { default as svelteConfig } from '@dfinity/eslint-config-oisy-wallet/svelte';
import { default as vitestConfig } from '@dfinity/eslint-config-oisy-wallet/vitest';
import ts from 'typescript-eslint';

export default ts.config(
	...vitestConfig,
	...svelteConfig,

	{
		ignores: ['build/', '.svelte-kit/', 'dist/', 'static/', 'src/declarations/']
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
