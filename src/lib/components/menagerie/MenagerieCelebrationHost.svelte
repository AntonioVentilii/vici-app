<script lang="ts">
	import MenagerieReveal from '$lib/components/menagerie/MenagerieReveal.svelte';
	import MenagerieSprite from '$lib/components/menagerie/MenagerieSprite.svelte';
	import { persistEarnedMenagerie } from '$lib/services/profile.services';
	import { flowBeatActiveStore } from '$lib/stores/flow-beat.store';
	import {
		advanceMenagerieCelebration,
		enqueueMenagerieCelebrations,
		menagerieCelebrationStore,
		resetMenagerieCelebrations
	} from '$lib/stores/menagerie-celebration.store';
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
	// The celebration only reads stats carried on the profile doc; the
	// achievements screen layers in referral count + global rank for the full
	// grid, but those animals' crossings simply celebrate the next time the host
	// sees the updated ledger — keeping this always-mounted host cheap.

	const profile = $derived($userStore.profile);

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

		const stats = menagerieStatsFromProfile({ profile: current });
		const diff = detectNewMenagerieTiers({ stats, celebrated: current.earnedMenagerie });

		// Signature = the earned-set + whether the ledger was seeded. Re-running
		// only when one of these changes avoids reacting to unrelated profile
		// writes (avatar, settings, …).
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

		// Mark everything currently earned as celebrated so a crossing never
		// re-fires, then queue the reveals (highest new tier per animal).
		void persistEarnedMenagerie({ owner: current.owner, keys: diff.all });
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
