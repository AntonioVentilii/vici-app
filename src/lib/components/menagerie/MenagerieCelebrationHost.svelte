<script lang="ts">
	import { onMount } from 'svelte';
	import MenagerieReveal from '$lib/components/menagerie/MenagerieReveal.svelte';
	import MenagerieSprite from '$lib/components/menagerie/MenagerieSprite.svelte';
	import { persistEarnedMenagerie } from '$lib/services/profile.services';
	import { listMyReferrals } from '$lib/services/referral.services';
	import { flowBeatActiveStore } from '$lib/stores/flow-beat.store';
	import {
		advanceMenagerieCelebration,
		enqueueMenagerieCelebrations,
		menagerieCelebrationStore,
		resetMenagerieCelebrations
	} from '$lib/stores/menagerie-celebration.store';
	import { globalStandingsStore } from '$lib/stores/standings.store';
	import { userStore } from '$lib/stores/user.store';
	import { detectNewMenagerieTiers, menagerieStatsFromProfile } from '$lib/utils/menagerie.utils';

	// App-shell celebration pipeline for the Menagerie trophy layer. Mounted once
	// at the (app) shell so a freshly-crossed tier celebrates on any surface.
	//
	// Responsibilities:
	//   1. Mount the glyph sprite once (every badge across the app references it).
	//   2. Watch the owner's stats; on a genuinely new tier crossing, queue a
	//      celebration. FIRST-EVER load (the `earnedMenagerie` field is absent)
	//      seeds the ledger SILENTLY — no celebration storm for a stocked profile.
	//   3. Persist the celebrated-key ledger so a crossing fires exactly once.
	//   4. Render the reveal, HELD while a Flow character beat is on screen so the
	//      two never collide (card → character beat → trophy).
	//
	// Beyond the stats carried on the profile doc, the host best-effort sources
	// the same live signals the achievements screen (`AlbumPage`) uses — referral
	// count + global rank — so Parrot / Goat / Badger can also celebrate from the
	// always-mounted host instead of only on the grid. Any source that's missing
	// just leaves its animal at baseline; it never blocks the host.

	const profile = $derived($userStore.profile);

	// Referral count (Parrot) — loaded once; the profile doc doesn't carry it.
	let referralCount = $state(0);

	onMount(() => {
		void (async () => {
			try {
				const referrals = await listMyReferrals();
				referralCount = referrals.length;
			} catch {
				// Best-effort: Parrot just stays at its baseline if this fails.
			}
		})();
	});

	// Global rank (Goat) from the cached "all" leaderboard window, when loaded.
	const selfRank = $derived.by((): { rank: number; total: number } | undefined => {
		const result = $globalStandingsStore.get('all');
		const owner = profile?.owner;

		if (!result || !owner) {
			return;
		}

		const self = result.entries.find((entry) => entry.owner === owner);

		if (!self) {
			return;
		}

		return { rank: self.rank, total: result.entries.length };
	});

	// Guard so the seed / detect pass runs once per distinct earned-set + ledger
	// state, not on every unrelated profile tick.
	let lastSignature = $state<string | null>(null);

	$effect(() => {
		const current = profile;

		if (!current) {
			lastSignature = null;
			resetMenagerieCelebrations();

			return;
		}

		const stats = menagerieStatsFromProfile({
			profile: current,
			signals: {
				referrals: referralCount,
				rank: selfRank?.rank,
				totalRanked: selfRank?.total
			}
		});
		const diff = detectNewMenagerieTiers({ stats, celebrated: current.earnedMenagerie });

		// Signature = the earned-set + whether the ledger was seeded. Re-running
		// only when one of these changes avoids reacting to unrelated profile
		// writes (avatar, settings, …); the earned-set already folds in the live
		// signals, so a referral/rank change that crosses a tier re-triggers here.
		const signature = `${current.earnedMenagerie == null ? 'seed' : 'set'}:${diff.all.join(',')}`;

		if (signature === lastSignature) {
			return;
		}

		lastSignature = signature;

		if (diff.firstRun) {
			// Seed the ledger silently — the owner has "always had" these.
			void persistEarnedMenagerie({ owner: current.owner, keys: diff.all });

			return;
		}

		if (diff.celebrate.length === 0) {
			return;
		}

		// The ledger is append-only ("already celebrated"). Persist the UNION of
		// the existing ledger and the currently-earned set, never `diff.all` alone:
		// a regressed stat (e.g. a dropped streak) shrinks the earned set, and
		// writing it raw would erase past keys → re-celebration, plus could drop
		// keys written by another surface. Then queue the reveals.
		const ledger = Array.from(new Set([...(current.earnedMenagerie ?? []), ...diff.all]));
		void persistEarnedMenagerie({ owner: current.owner, keys: ledger });
		enqueueMenagerieCelebrations(diff.celebrate);
	});

	const reveal = $derived($menagerieCelebrationStore.current);
	const beatActive = $derived($flowBeatActiveStore);
</script>

<MenagerieSprite />

{#if reveal && !beatActive}
	{#key `${reveal.slug}:${reveal.tier}`}
		<MenagerieReveal onDone={advanceMenagerieCelebration} slug={reveal.slug} tier={reveal.tier} />
	{/key}
{/if}
