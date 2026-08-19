import { describe, expect, test } from 'bun:test';
import { MARKET_TAXONOMY } from '../../src/markets/taxonomy';
import { extractBlock, quotedStrings, readRepoSource } from '../helpers/repo-source';

// market-taxonomy.constants.ts value-imports an app dependency, so the macro
// and micro vocabulary is pinned by static extraction from the source text.
describe('shared drift: market taxonomy', () => {
	test('backend MARKET_TAXONOMY matches the app macro/micro vocabulary', () => {
		const source = readRepoSource('src/lib/constants/market-taxonomy.constants.ts');
		const block = extractBlock({ source, marker: 'export const MARKET_TAXONOMY' });
		const app = [...block.matchAll(/id:\s*'([^']+)',\s*micros:\s*\[([^\]]*)\]/g)].map((match) => ({
			id: match[1],
			micros: quotedStrings(match[2] ?? '')
		}));

		const backend: { id: string | undefined; micros: string[] }[] = MARKET_TAXONOMY.map(
			({ id, micros }) => ({ id, micros: [...micros] })
		);

		expect(app.length).toBeGreaterThan(0);
		expect(backend).toEqual(app);
	});
});
