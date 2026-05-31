<script lang="ts">
	import OnboardingStepTracker from '$lib/components/onboarding/OnboardingStepTracker.svelte';
	import CountryFlag from '$lib/components/ui/CountryFlag.svelte';
	import { DAY_IN_MS } from '$lib/constants/app.constants';
	import { featuredEvent } from '$lib/derived/featured-event.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import type { FeaturedEventParticipant } from '$lib/types/featured-event';
	import { t } from '$lib/utils/i18n.utils';
	import { detectUserCountryCode } from '$lib/utils/locale-country.utils';

	/**
	 * Onboarding · Beat 1.a — team picker.
	 *
	 * Renders the favourites grid with the `+N more` tile inline, an
	 * optional all-teams panel below, and a single "Skip — just
	 * following the tournament" link.
	 *
	 * Beat 1 splits into two micro-phases: 1.a "pick your team" (or
	 * skip) and 1.b "swipe the prediction card derived from your
	 * pick." This component owns 1.a only — emitting the picked
	 * `participantId` (ISO-3166 alpha-2) or `null` for the skip path.
	 */
	interface Props {
		// Fires when the user picks a team. Pass `null` for the "Skip — just
		// following the tournament" path.
		onPick: (participantId: string | null) => void;
	}

	const { onPick }: Props = $props();

	let showAllTeams = $state(false);

	const event = $derived($featuredEvent);
	const favouriteIds = $derived(event.favouriteIds ?? []);
	const participants = $derived(event.participants ?? []);

	// Auto-detect the visitor's country from `navigator.languages` and
	// promote a matching participant into position 1 of the favourites
	// grid — Brazilian visitor sees Brazil first, US visitor sees USA
	// first, etc. We only promote when the local team is NOT already
	// visible.
	const localCountryCode: string | null = detectUserCountryCode();

	// Favourites surface as 4 large tiles, sorted by `odds` descending so
	// the team most likely to win renders first.
	const baseFavourites: FeaturedEventParticipant[] = $derived(
		favouriteIds
			.map((id) => participants.find((p) => p.id === id))
			.filter((p): p is FeaturedEventParticipant => p !== undefined)
			.sort((a, b) => (b.odds ?? -Infinity) - (a.odds ?? -Infinity))
	);

	const favourites: FeaturedEventParticipant[] = $derived.by(() => {
		if (localCountryCode === null) {
			return baseFavourites;
		}

		if (baseFavourites.some((p) => p.id === localCountryCode)) {
			return baseFavourites;
		}

		const local = participants.find((p) => p.id === localCountryCode);

		if (!local) {
			return baseFavourites;
		}

		return [local, ...baseFavourites.slice(0, Math.max(0, baseFavourites.length - 1))];
	});

	// Teams shown when the user expands "+N more" — exclude the
	// favourites already rendered as big tiles above so the expanded
	// grid only surfaces the *other* teams.
	const otherTeams: FeaturedEventParticipant[] = $derived.by(() => {
		const favouriteIdSet = new Set(favourites.map((p) => p.id));

		return participants.filter((p) => !favouriteIdSet.has(p.id));
	});

	const moreCount = $derived(otherTeams.length);

	// "FIFA WORLD CUP 2026 · 27d to kickoff" eyebrow.
	const kickoffDays = $derived(
		Math.max(0, Math.ceil((event.kickoffAt_ms - Date.now()) / DAY_IN_MS))
	);
</script>

<div class="ob2-beat ob2-beat-1 ob2-beat-pick">
	<OnboardingStepTracker step={1} />

	<div class="ob2-wc-eyebrow">
		<span class="ob2-wc-tag">{event.badgeTitle ?? event.title}</span>
		<span class="ob2-wc-countdown">
			· {t({
				locale: $localeStore,
				key: 'onboarding.beat1.kickoff_days',
				params: { days: kickoffDays }
			})}
		</span>
	</div>

	<h1 class="ob2-h1">{t({ locale: $localeStore, key: 'onboarding.beat1.title' })}</h1>
	<p class="ob2-sub">
		{t({ locale: $localeStore, key: 'onboarding.beat1.subtitle_a' })}
		<span class="serif-italic acc">
			{t({ locale: $localeStore, key: 'onboarding.beat1.subtitle_b' })}
		</span>
	</p>

	<div class="ob2-team-grid">
		{#each favourites as team (team.id)}
			<button
				style:border-color="{team.color ?? 'var(--ink-line)'}55"
				class="ob2-team-tile"
				onclick={() => onPick(team.id)}
				type="button"
			>
				<span class="ob2-team-flag-lg">
					<CountryFlag class="ob2-team-flag-img" countryCode={team.id} />
				</span>
				<span class="ob2-team-name-lg">{team.name}</span>
			</button>
		{/each}
		{#if moreCount > 0}
			<button
				class="ob2-team-tile ob2-team-more-tile"
				onclick={() => (showAllTeams = !showAllTeams)}
				type="button"
			>
				<span class="ob2-team-name-lg">
					{t({
						locale: $localeStore,
						key: 'onboarding.beat1.more',
						params: { count: moreCount }
					})}
				</span>
				<span class="ob2-team-more-sub">
					{t({
						locale: $localeStore,
						key: 'onboarding.beat1.all_teams',
						params: { total: participants.length }
					})}
				</span>
			</button>
		{/if}
	</div>

	{#if showAllTeams}
		<div class="ob2-all-teams no-scrollbar">
			<div class="ob2-all-teams-grid">
				{#each otherTeams as team (team.id)}
					<button
						class="ob2-team-chip"
						onclick={() => {
							onPick(team.id);
							showAllTeams = false;
						}}
						type="button"
					>
						<span class="ob2-team-flag">
							<CountryFlag class="ob2-team-flag-img" countryCode={team.id} />
						</span>
						<span class="ob2-team-name">{team.name}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<button class="ob2-skip-team" onclick={() => onPick(null)} type="button">
		{t({ locale: $localeStore, key: 'onboarding.beat1.skip' })}
	</button>
</div>
