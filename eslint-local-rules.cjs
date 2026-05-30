/* eslint-disable @typescript-eslint/no-require-imports */
const upstream = require('@dfinity/eslint-config-oisy-wallet/eslint-local-rules');
const noBareSvelteText = require('./local-rules/no-bare-svelte-text.cjs');

module.exports = {
	...upstream,
	'no-bare-svelte-text': noBareSvelteText
};
