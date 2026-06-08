<script lang="ts">
	/**
	 * Accuracy-as-status section: an anchored headline beside a board
	 * that cycles three labelled tabs — Friends / Universities /
	 * Workplace. A gentle ~5s auto-advance pauses on hover/focus and is
	 * disabled under reduced-motion. Same footprint as a single board.
	 */
	import { onDestroy } from 'svelte';
	import {
		LANDING_STATUS_FRIENDS,
		LANDING_STATUS_UNIVERSITIES,
		type LandingStatusRow,
		type LandingStatusTabId
	} from '$lib/constants/landing-data.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
	import { splitHeadline } from '$lib/utils/landing-headline.utils';
	import { prefersReducedMotion } from '$lib/utils/reduced-motion.utils';

	interface StatusTab {
		readonly id: LandingStatusTabId;
		readonly label: MessageKey;
		readonly caption: MessageKey;
		readonly rows: readonly LandingStatusRow[];
	}

	const tt = (key: MessageKey) => t({ locale: $localeStore, key });

	const uniRows = $derived<readonly LandingStatusRow[]>(
		LANDING_STATUS_UNIVERSITIES.map((name, i) => ({
			rank: i + 1,
			name,
			acc: `${(71.8 - i * 1.4).toFixed(1)}%`,
			team: true
		}))
	);

	const tabs = $derived<readonly StatusTab[]>([
		{
			id: 'friends',
			label: 'welcome.v2.status.tab_friends',
			caption: 'welcome.v2.status.cap_friends',
			rows: LANDING_STATUS_FRIENDS
		},
		{
			id: 'uni',
			label: 'welcome.v2.status.tab_uni',
			caption: 'welcome.v2.status.cap_uni',
			rows: uniRows
		},
		{
			id: 'work',
			label: 'welcome.v2.status.tab_work',
			caption: 'welcome.v2.status.cap_work',
			rows: [
				{
					rank: 1,
					name: tt('welcome.v2.status.team_design'),
					acc: '76.0%',
					team: true,
					you: true,
					delta: '▲ 2'
				},
				{ rank: 2, name: tt('welcome.v2.status.team_product'), acc: '74.6%', team: true },
				{ rank: 3, name: tt('welcome.v2.status.team_sales'), acc: '72.2%', team: true },
				{ rank: 4, name: tt('welcome.v2.status.team_eng'), acc: '70.9%', team: true }
			]
		}
	]);

	let active = $state(0);
	let paused = $state(false);

	const tab = $derived(tabs[active]);
	const headline = $derived(splitHeadline(tt('welcome.v2.status.headline')));

	let timer: ReturnType<typeof setInterval> | null = null;

	const clear = (): void => {
		if (timer !== null) {
			clearInterval(timer);
			timer = null;
		}
	};

	$effect(() => {
		clear();

		if (prefersReducedMotion() || paused) {
			return;
		}

		timer = setInterval(() => {
			active = (active + 1) % tabs.length;
		}, 5000);

		return clear;
	});

	onDestroy(clear);
</script>

<section id="status" class="v2-section v2-status">
	<div class="v2-wrap">
		<div class="v2-status-grid">
			<div class="v2-status-copy">
				<span class="v2-kicker">{tt('welcome.v2.status.kicker')}</span>
				<h2 class="v2-h2">
					{headline.before}{#if headline.accent}<span class="acc">{headline.accent}</span
						>{/if}{headline.after}
				</h2>
				<p class="v2-lede">{tt('welcome.v2.status.body')}</p>
			</div>

			<div
				class="v2-status-slider"
				aria-label={tt('welcome.v2.status.kicker')}
				onfocusin={() => (paused = true)}
				onfocusout={() => (paused = false)}
				onmouseenter={() => (paused = true)}
				onmouseleave={() => (paused = false)}
				role="group"
			>
				<div class="v2-status-tabs" aria-label={tt('welcome.v2.status.kicker')} role="tablist">
					{#each tabs as tb, i (tb.id)}
						<button
							class="v2-status-tab"
							class:on={i === active}
							aria-selected={i === active}
							onclick={() => {
								active = i;
								paused = true;
							}}
							role="tab"
							type="button"
						>
							{tt(tb.label)}
						</button>
					{/each}
				</div>

				{#key tab.id}
					<div class="v2-board" role="tabpanel">
						{#each tab.rows as r (r.rank)}
							<div class="v2-board-row" class:you={r.you}>
								<span class="v2-board-rank">{r.rank}</span>
								<span class="v2-board-name">
									{r.team || r.you ? r.name : `@${r.name}`}
									{#if r.you && r.delta}
										<span class="v2-board-badge">{r.delta}</span>
									{/if}
								</span>
								<span class="v2-board-acc">{r.acc}</span>
							</div>
						{/each}
					</div>
				{/key}

				<div class="v2-board-climb">{tt(tab.caption)}</div>
			</div>
		</div>
	</div>
</section>
