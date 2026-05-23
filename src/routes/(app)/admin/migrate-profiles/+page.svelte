<!--
  One-shot admin tool to backfill `preferences.defaultAmount` on legacy
  profile docs that were written before that field existed.

  Background: `app_list_leaderboard` / `app_get_profile` /
  `app_search_profiles` used to trap with
  `'Error converting from js JsonData into type Candid: missing field
  default_amount'` because the JsonData→Candid encoder requires every
  declared field. The satellite now normalizes on read
  (`withProfileDefaults` in `src/satellite/services/profile.services.ts`),
  so this page is purely hygienic — it rewrites the stored JSON so future
  schema changes don't have to keep carrying that defensive code.

  Idempotent: only docs whose `preferences` is missing or partial get
  rewritten; everything else is skipped. Safe to re-run.

  This route is intentionally not added to `AppPath`, has no navigation
  entry, and can be deleted once the cleanup is done.
-->
<script lang="ts">
	import { isNullish } from '@dfinity/utils';
	import { listDocs, setDoc, type Doc } from '@junobuild/core';
	import Protected from '$lib/components/authn/Protected.svelte';
	import PermissionGuard from '$lib/components/authz/PermissionGuard.svelte';
	import { Collection } from '$lib/constants/collections.constants';
	import { Permission } from '$lib/enums/permission';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import type { UserProfile } from '$lib/types/profile';
	import { t } from '$lib/utils/i18n.utils';

	type Status = 'idle' | 'scanning' | 'migrating' | 'done';

	let status = $state<Status>('idle');
	let scanned = $state(0);
	let needFix = $state(0);
	let rewritten = $state(0);
	let failed = $state(0);
	let lastError = $state<string | undefined>(undefined);

	const needsMigration = (profile: UserProfile): boolean => {
		const prefs = profile.preferences;

		if (isNullish(prefs)) {
			return false;
		}

		const { defaultAmount } = prefs;

		if (isNullish(defaultAmount)) {
			return true;
		}

		return isNullish(defaultAmount.flow) || isNullish(defaultAmount.manual);
	};

	const normalize = (profile: UserProfile): UserProfile => ({
		...profile,
		preferences: profile.preferences
			? {
					...profile.preferences,
					defaultAmount: {
						flow: profile.preferences.defaultAmount?.flow ?? '0',
						manual: profile.preferences.defaultAmount?.manual ?? '0'
					}
				}
			: undefined
	});

	const loadAllProfiles = async (): Promise<Doc<UserProfile>[]> => {
		const collected: Doc<UserProfile>[] = [];
		let startAfter: string | undefined;
		let pages = 0;

		do {
			const { items, items_page, matches_pages } = await listDocs<UserProfile>({
				collection: Collection.PROFILES,
				filter: { paginate: { startAfter, limit: 100 } }
			});

			collected.push(...items);
			pages += 1;

			if (isNullish(items_page) || isNullish(matches_pages) || items_page + 1n >= matches_pages) {
				break;
			}

			const lastItem = items[items.length - 1];

			if (isNullish(lastItem)) {
				break;
			}

			startAfter = lastItem.key;
		} while (pages < 100);

		return collected;
	};

	const handleScan = async () => {
		status = 'scanning';
		scanned = 0;
		needFix = 0;
		lastError = undefined;

		try {
			const docs = await loadAllProfiles();
			scanned = docs.length;
			needFix = docs.filter((doc) => needsMigration(doc.data)).length;
			status = 'idle';
		} catch (e: unknown) {
			status = 'idle';
			lastError = e instanceof Error ? e.message : String(e);
			console.error('Scan failed:', e);
		}
	};

	const handleMigrate = async () => {
		status = 'migrating';
		scanned = 0;
		needFix = 0;
		rewritten = 0;
		failed = 0;
		lastError = undefined;

		try {
			const docs = await loadAllProfiles();
			scanned = docs.length;
			const toFix = docs.filter((doc) => needsMigration(doc.data));
			needFix = toFix.length;

			for (const doc of toFix) {
				try {
					await setDoc<UserProfile>({
						collection: Collection.PROFILES,
						doc: {
							key: doc.key,
							version: doc.version,
							data: normalize(doc.data)
						}
					});
					rewritten += 1;
				} catch (e: unknown) {
					failed += 1;
					console.error(`Failed to migrate ${doc.key}:`, e);
				}
			}

			status = 'done';
			notificationsStore.add({
				title: 'Migration complete',
				message: `Rewrote ${rewritten} of ${needFix} profiles (${failed} failed).`,
				type: failed === 0 ? 'success' : 'warning'
			});
		} catch (e: unknown) {
			status = 'idle';
			lastError = e instanceof Error ? e.message : String(e);
			console.error('Migration failed:', e);
		}
	};
</script>

<Protected
	description={t({ locale: $localeStore, key: 'authn.admin.sub' })}
	title={t({ locale: $localeStore, key: 'authn.admin.title' })}
>
	<PermissionGuard permission={Permission.VIEW_ADMIN_PANEL}>
		<section class="migrate">
			<header>
				<h1>Migrate profiles</h1>
				<p>
					Backfills <code>preferences.defaultAmount</code> on legacy profile docs. Idempotent &mdash;
					only rewrites docs that actually need fixing. Safe to re-run.
				</p>
			</header>

			<div class="actions">
				<button
					disabled={status === 'scanning' || status === 'migrating'}
					onclick={handleScan}
					type="button"
				>
					{status === 'scanning' ? 'Scanning…' : 'Scan'}
				</button>
				<button
					disabled={status === 'scanning' || status === 'migrating'}
					onclick={handleMigrate}
					type="button"
				>
					{status === 'migrating' ? 'Migrating…' : 'Run migration'}
				</button>
			</div>

			<dl class="stats">
				<div>
					<dt>Scanned</dt>
					<dd>{scanned}</dd>
				</div>
				<div>
					<dt>Need fix</dt>
					<dd>{needFix}</dd>
				</div>
				<div>
					<dt>Rewritten</dt>
					<dd>{rewritten}</dd>
				</div>
				<div>
					<dt>Failed</dt>
					<dd>{failed}</dd>
				</div>
			</dl>

			{#if lastError}
				<p class="error">Error: {lastError}</p>
			{/if}
		</section>
	</PermissionGuard>
</Protected>

<style lang="postcss">
	.migrate {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		max-width: 36rem;
		padding: 2rem;
	}

	header h1 {
		margin: 0 0 0.5rem;
		font-size: 1.5rem;
	}

	header p {
		margin: 0;
		color: var(--color-text-muted, #888);
	}

	.actions {
		display: flex;
		gap: 0.75rem;
	}

	.actions button {
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		border: 1px solid currentColor;
		background: transparent;
		cursor: pointer;
	}

	.actions button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin: 0;
	}

	.stats > div {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.stats dt {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-muted, #888);
	}

	.stats dd {
		margin: 0;
		font-size: 1.5rem;
		font-variant-numeric: tabular-nums;
	}

	.error {
		color: var(--color-error, #d33);
		font-family: ui-monospace, monospace;
		font-size: 0.875rem;
		white-space: pre-wrap;
	}
</style>
