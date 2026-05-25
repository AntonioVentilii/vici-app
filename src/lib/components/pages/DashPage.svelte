<script lang="ts">
	import { Briefcase, Flame } from 'lucide-svelte/icons';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { userStore } from '$lib/stores/user.store';
	import { t } from '$lib/utils/i18n.utils';

	const profile = $derived($userStore.profile);
	const nickname = $derived(profile?.nickname ?? '');
	const accuracyPct = $derived(profile ? '—' : '—');
</script>

{#snippet dashAppbarRight()}
	<button
		class="profile-mobile-icon-btn"
		aria-label={t({ locale: $localeStore, key: 'nav.portfolio' })}
		onclick={() => goto(resolve(AppPath.Portfolio))}
		type="button"
	>
		<Briefcase aria-hidden="true" size={18} strokeWidth={1.8} />
	</button>
{/snippet}

<MobileAppBar right={dashAppbarRight} title={t({ locale: $localeStore, key: 'dash.title' })} />

<div class="mx-auto flex max-w-[var(--reading-max,64ch)] flex-col gap-6">
	<header class="hidden md:flex md:items-center md:justify-between">
		<SectionHeader
			description={t({ locale: $localeStore, key: 'dash.subtitle' })}
			title={t({ locale: $localeStore, key: 'dash.title' })}
		/>
	</header>

	<section
		class="surface border-border bg-card flex flex-col items-center gap-2 rounded-2xl border px-6 py-8"
		aria-labelledby="dash-accuracy-eyebrow"
	>
		<span id="dash-accuracy-eyebrow" class="allcaps">
			{t({ locale: $localeStore, key: 'dash.accuracy.eyebrow' })}
		</span>
		<div class="display-num text-foreground text-6xl md:text-8xl">
			{accuracyPct}<span class="text-muted-foreground text-3xl md:text-5xl">%</span>
		</div>
		<p class="text-muted-foreground text-sm">
			{nickname
				? t({ locale: $localeStore, key: 'dash.accuracy.signed_in', params: { handle: nickname } })
				: t({ locale: $localeStore, key: 'dash.accuracy.signed_out' })}
		</p>
	</section>

	<section
		class="surface border-border bg-card flex flex-col gap-3 rounded-2xl border px-5 py-4"
		aria-labelledby="dash-streak-eyebrow"
	>
		<div class="flex items-center gap-2">
			<Flame class="text-laurel" aria-hidden="true" size={18} strokeWidth={1.8} />
			<span id="dash-streak-eyebrow" class="allcaps">
				{t({ locale: $localeStore, key: 'dash.streak.eyebrow' })}
			</span>
		</div>
		<p class="text-muted-foreground text-sm">
			{t({ locale: $localeStore, key: 'dash.placeholder.streak' })}
		</p>
	</section>

	<section
		class="surface border-border bg-card flex flex-col gap-3 rounded-2xl border px-5 py-4"
		aria-labelledby="dash-positions-eyebrow"
	>
		<div class="flex items-center justify-between">
			<span id="dash-positions-eyebrow" class="allcaps">
				{t({ locale: $localeStore, key: 'dash.positions.eyebrow' })}
			</span>
			<a
				class="text-laurel hover:text-laurel-deep text-xs font-medium"
				href={resolve(AppPath.Portfolio)}
			>
				{t({ locale: $localeStore, key: 'dash.positions.view_all' })}
			</a>
		</div>
		<p class="text-muted-foreground text-sm">
			{t({ locale: $localeStore, key: 'dash.placeholder.positions' })}
		</p>
	</section>

	<section
		class="surface border-border bg-card flex flex-col gap-3 rounded-2xl border px-5 py-4"
		aria-labelledby="dash-category-eyebrow"
	>
		<span id="dash-category-eyebrow" class="allcaps">
			{t({ locale: $localeStore, key: 'dash.categories.eyebrow' })}
		</span>
		<p class="text-muted-foreground text-sm">
			{t({ locale: $localeStore, key: 'dash.placeholder.categories' })}
		</p>
	</section>

	<section
		class="surface border-border bg-card flex flex-col gap-3 rounded-2xl border px-5 py-4"
		aria-labelledby="dash-history-eyebrow"
	>
		<span id="dash-history-eyebrow" class="allcaps">
			{t({ locale: $localeStore, key: 'dash.history.eyebrow' })}
		</span>
		<p class="text-muted-foreground text-sm">
			{t({ locale: $localeStore, key: 'dash.placeholder.history' })}
		</p>
	</section>
</div>
