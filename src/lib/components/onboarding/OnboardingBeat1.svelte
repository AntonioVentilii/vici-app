<script lang="ts">
	import { featuredEvent } from '$lib/derived/featured-event.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import type { FeaturedEventParticipant } from '$lib/types/featured-event';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Onboarding V2 · Beat 1.a — team picker.
	 *
	 * V1.2's prototype splits Beat 1 into two micro-phases: 1.a "pick your
	 * team" (or skip) and 1.b "swipe the prediction card derived from your
	 * pick." This component owns 1.a only — emitting the picked
	 * `participantId` (ISO-3166 alpha-2) or `null` for the skip path.
	 *
	 * The card-swipe sequel (1.b) is a follow-up component.
	 *
	 * Reads the active featured event so swapping the tentpole in
	 * `featured-event.constants.ts` automatically rewires the picker.
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

	// Favourites surface as 4 large tiles. Stable order from
	// `favouriteIds`. Filtering then mapping over the participant list
	// keeps the tiles in the curated order even if the participant array
	// is sorted by odds.
	const favourites: FeaturedEventParticipant[] = $derived(
		favouriteIds
			.map((id) => participants.find((p) => p.id === id))
			.filter((p): p is FeaturedEventParticipant => p !== undefined)
	);

	const moreCount = $derived(Math.max(0, participants.length - favourites.length));

	// Per V1.2's "FIFA WORLD CUP 2026 · 27d to kickoff" eyebrow.
	const kickoffDays = $derived(
		Math.max(0, Math.ceil((event.kickoffAt_ms - Date.now()) / (24 * 60 * 60 * 1000)))
	);

	const pick = (participantId: string) => {
		onPick(participantId);
	};

	const skip = () => {
		onPick(null);
	};
</script>

<section class="ob2-beat ob2-beat-1">
	<header class="ob2-beat-header">
		<span class="ob2-progress" aria-hidden="true">
			<span class="ob2-progress-dot is-filled"></span>
			<span class="ob2-progress-dot"></span>
			<span class="ob2-progress-dot"></span>
		</span>
		<span class="allcaps ob2-step-label">
			{t({
				locale: $localeStore,
				key: 'onboarding.beat_label',
				params: { current: 1, total: 3 }
			})}
		</span>
	</header>

	<div class="ob2-wc-eyebrow">
		<span class="allcaps ob2-wc-tag">{event.title}</span>
		<span class="ob2-wc-countdown num">
			· {t({
				locale: $localeStore,
				key: 'onboarding.beat1.kickoff_days',
				params: { days: kickoffDays }
			})}
		</span>
	</div>

	<h1 class="ob2-h1">{t({ locale: $localeStore, key: 'onboarding.beat1.title' })}</h1>
	<p class="ob2-sub">{t({ locale: $localeStore, key: 'onboarding.beat1.subtitle' })}</p>

	<div class="ob2-team-grid">
		{#each favourites as team (team.id)}
			<button
				style:--team-color={team.color ?? 'var(--border-strong)'}
				class="ob2-team-tile"
				onclick={() => pick(team.id)}
				type="button"
			>
				<span class="ob2-team-flag-lg" aria-hidden="true">{team.glyph ?? ''}</span>
				<span class="ob2-team-name-lg">{team.name}</span>
			</button>
		{/each}
		{#if moreCount > 0}
			<button
				class="ob2-team-tile ob2-team-more"
				aria-expanded={showAllTeams}
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
		<div class="ob2-all-teams">
			<div class="ob2-all-teams-grid">
				{#each participants as team (team.id)}
					<button
						class="ob2-team-chip"
						onclick={() => {
							pick(team.id);
							showAllTeams = false;
						}}
						type="button"
					>
						<span class="ob2-team-flag" aria-hidden="true">{team.glyph ?? ''}</span>
						<span class="ob2-team-name">{team.name}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<button class="ob2-skip-team" onclick={skip} type="button">
		{t({ locale: $localeStore, key: 'onboarding.beat1.skip' })}
	</button>
</section>

<style lang="postcss">
	.ob2-beat {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.25rem 1.1rem 1.5rem;
		color: var(--text-base);
	}

	.ob2-beat-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.ob2-progress {
		display: inline-flex;
		gap: 6px;
	}

	.ob2-progress-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--border-base);
		transition: background 160ms ease;
	}

	.ob2-progress-dot.is-filled {
		background: var(--laurel);
	}

	.ob2-step-label {
		font-size: var(--t-11, 0.7rem);
		color: var(--text-muted);
	}

	.ob2-wc-eyebrow {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		font-size: var(--t-12);
		color: var(--text-muted);
	}

	.ob2-wc-tag {
		color: var(--laurel);
		font-weight: 700;
	}

	.ob2-h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.5rem, 6vw, 2rem);
		line-height: var(--leading-tight);
		color: var(--text-base);
	}

	.ob2-sub {
		margin: 0;
		font-size: var(--t-14);
		color: var(--text-muted);
	}

	.ob2-team-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
		gap: 0.65rem;
		margin-top: 0.35rem;
	}

	.ob2-team-tile {
		appearance: none;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 1rem 0.5rem;
		min-height: 6rem;
		font: inherit;
		color: var(--text-base);
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		border: 1px solid
			color-mix(in srgb, var(--team-color, var(--border-strong)) 33%, var(--border-base));
		border-radius: var(--r-12);
		cursor: pointer;
		transition:
			transform 160ms ease,
			border-color 160ms ease,
			background 160ms ease;
	}

	.ob2-team-tile:hover {
		transform: translateY(-1px);
		border-color: color-mix(
			in srgb,
			var(--team-color, var(--border-strong)) 55%,
			var(--border-base)
		);
	}

	.ob2-team-flag-lg {
		font-size: 2.25rem;
		line-height: 1;
	}

	.ob2-team-name-lg {
		font-size: var(--t-13);
		font-weight: 600;
	}

	.ob2-team-more {
		--team-color: var(--border-strong);
		gap: 0.15rem;
	}

	.ob2-team-more-sub {
		font-size: var(--t-11, 0.7rem);
		color: var(--text-muted);
	}

	.ob2-all-teams {
		border-top: 1px solid var(--border-base);
		padding-top: 0.85rem;
	}

	.ob2-all-teams-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
		gap: 0.45rem;
	}

	.ob2-team-chip {
		appearance: none;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.65rem;
		font: inherit;
		color: var(--text-base);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		cursor: pointer;
		transition: background 140ms ease;
	}

	.ob2-team-chip:hover {
		background: color-mix(in srgb, var(--bg-surface) 60%, transparent);
	}

	.ob2-team-flag {
		font-size: 1rem;
		line-height: 1;
	}

	.ob2-team-name {
		font-size: var(--t-12);
	}

	.ob2-skip-team {
		appearance: none;
		align-self: center;
		margin-top: 0.5rem;
		padding: 0.55rem 0.85rem;
		font: inherit;
		font-size: var(--t-13);
		color: var(--text-muted);
		background: none;
		border: none;
		cursor: pointer;
		text-decoration: underline;
	}

	.ob2-skip-team:hover {
		color: var(--text-base);
	}
</style>
