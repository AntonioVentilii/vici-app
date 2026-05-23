#!/usr/bin/env node
/**
 * Verify every locale catalog under `src/lib/constants/messages/` exposes
 * the same key set as `en.ts` (the source of truth).
 *
 * Exits non-zero on any drift, with a per-locale report of missing /
 * extra keys. Wired into `npm run check:i18n` and `npm run lint`.
 *
 * See `docs/ai/frontend/i18n.md`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.resolve(scriptDir, '../src/lib/constants/messages');
const localeConstantsPath = path.resolve(scriptDir, '../src/lib/constants/locale.constants.ts');

/**
 * Extract all `'key': ...` entries from a catalog TS file. The catalogs
 * are mechanical exports (`export const xxMessages = { 'a': '...', ... }
 * as const;`) so a regex on the source is robust enough — and avoids
 * pulling in a TS loader just for this check.
 *
 * @param {string} filePath
 * @returns {Set<string>}
 */
const extractKeys = (filePath) => {
	const source = fs.readFileSync(filePath, 'utf8');
	const keys = new Set();
	const re = /^[\s]*'((?:\\'|[^'])+)'\s*:/gm;
	let match;

	while ((match = re.exec(source)) !== null) {
		keys.add(match[1]);
	}

	return keys;
};

/**
 * Read `SUPPORTED_LOCALES` from `locale.constants.ts` so the script
 * stays in lock-step with the type without hand-maintaining a list.
 *
 * @returns {string[]}
 */
const readSupportedLocales = () => {
	const source = fs.readFileSync(localeConstantsPath, 'utf8');
	const block = source.match(/SUPPORTED_LOCALES[\s\S]*?\[([\s\S]*?)\]\s*as const/);

	if (block === null) {
		throw new Error(
			`Could not parse SUPPORTED_LOCALES in ${path.relative(process.cwd(), localeConstantsPath)}`
		);
	}

	const ids = [];
	const re = /id:\s*'([^']+)'/g;
	let match;

	while ((match = re.exec(block[1])) !== null) {
		ids.push(match[1]);
	}

	if (ids.length === 0) {
		throw new Error('SUPPORTED_LOCALES is empty — nothing to check.');
	}

	return ids;
};

const main = () => {
	const supportedLocales = readSupportedLocales();
	const baseLocale = 'en';

	if (!supportedLocales.includes(baseLocale)) {
		console.error(`Source-of-truth locale '${baseLocale}' is not in SUPPORTED_LOCALES.`);
		process.exit(1);
	}

	const baseFile = path.join(messagesDir, `${baseLocale}.ts`);

	if (!fs.existsSync(baseFile)) {
		console.error(`Missing base catalog: ${path.relative(process.cwd(), baseFile)}`);
		process.exit(1);
	}

	const baseKeys = extractKeys(baseFile);
	const failures = [];

	for (const locale of supportedLocales) {
		if (locale === baseLocale) {
			continue;
		}

		const catalogPath = path.join(messagesDir, `${locale}.ts`);

		if (!fs.existsSync(catalogPath)) {
			failures.push({ locale, missing: [...baseKeys], extra: [], status: 'absent' });

			continue;
		}

		const localeKeys = extractKeys(catalogPath);
		const missing = [...baseKeys].filter((key) => !localeKeys.has(key));
		const extra = [...localeKeys].filter((key) => !baseKeys.has(key));

		if (missing.length > 0 || extra.length > 0) {
			failures.push({ locale, missing, extra, status: 'drift' });
		}
	}

	if (failures.length === 0) {
		console.log(
			`✓ i18n catalogs aligned across ${supportedLocales.length} locales (${baseKeys.size} keys).`
		);
		process.exit(0);
	}

	console.error('✗ i18n catalog drift detected.\n');

	for (const { locale, missing, extra, status } of failures) {
		if (status === 'absent') {
			console.error(`  [${locale}] catalog file is missing.`);

			continue;
		}

		console.error(`  [${locale}]`);

		if (missing.length > 0) {
			console.error(`    missing (${missing.length}):`);

			for (const key of missing) {
				console.error(`      - ${key}`);
			}
		}

		if (extra.length > 0) {
			console.error(`    extra (${extra.length}):`);

			for (const key of extra) {
				console.error(`      + ${key}`);
			}
		}
	}

	console.error(
		'\nFix: add the missing keys to each locale catalog under src/lib/constants/messages/.'
	);
	console.error('See docs/ai/frontend/i18n.md.');
	process.exit(1);
};

main();
