<script lang="ts">
	import { Settings, User } from 'lucide-svelte/icons';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import ProfileDashboard from '$lib/components/profile/ProfileDashboard.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import {
		daysToKickoff,
		featuredEvent,
		featuredEventActive
	} from '$lib/derived/featured-event.derived';
	import { authBusy, authPrincipal } from '$lib/derived/user.derived';
	import { getProfile } from '$lib/services/profile.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { userStore } from '$lib/stores/user.store';
	import { t } from '$lib/utils/i18n.utils';

	let intervalId: ReturnType<typeof setInterval> | undefined;

	onMount(() => {
		const refreshProfile = async () => {
			if ($authPrincipal) {
				const profileDoc = await getProfile($authPrincipal);
				userStore.update((s) => ({ ...s, profile: profileDoc.data }));
			}
		};

		intervalId = setInterval(refreshProfile, 60000);

		return () => clearInterval(intervalId);
	});
</script>

{#snippet profileAppbarRight()}
	<button
		class="profile-mobile-icon-btn"
		aria-label={t({ locale: $localeStore, key: 'settings.title' })}
		onclick={() => goto(resolve(AppPath.Settings))}
		type="button"
	>
		<Settings aria-hidden="true" size={18} strokeWidth={1.8} />
	</button>
{/snippet}

{#snippet profileDesktopRight()}
	<button
		class="profile-desktop-icon-btn"
		aria-label={t({ locale: $localeStore, key: 'settings.title' })}
		onclick={() => goto(resolve(AppPath.Settings))}
		type="button"
	>
		<Settings aria-hidden="true" size={22} strokeWidth={1.6} />
	</button>
{/snippet}

<div class="space-y-10 pb-24">
	<MobileAppBar
		align="left"
		right={profileAppbarRight}
		title={t({ locale: $localeStore, key: 'profile.title' })}
	/>

	<div class="hidden md:block">
		<SectionHeader
			description={t({ locale: $localeStore, key: 'profile.sub' })}
			right={profileDesktopRight}
			title={t({ locale: $localeStore, key: 'profile.title' })}
		/>
	</div>

	{#if $featuredEventActive}
		<!-- Featured-event chip — mirrors the one shipped on onboarding
		     step 0 (72e62a0). Surfaces the live tentpole context on the
		     profile page so users see the WC anchor whenever they land
		     here. Reads from the same FeaturedEvent abstraction (b9dfb7d)
		     so swapping the next event is still a one-export change. -->
		<div class="profile-featured-event" role="note">
			<span class="profile-featured-event-dot" aria-hidden="true"></span>
			<span class="num">
				{#if $daysToKickoff !== null && $daysToKickoff > 0}
					{t({
						locale: $localeStore,
						key: 'profile.featured_event.upcoming',
						params: { event: $featuredEvent.title, days: $daysToKickoff }
					})}
				{:else}
					{t({
						locale: $localeStore,
						key: 'profile.featured_event.live',
						params: { event: $featuredEvent.title }
					})}
				{/if}
			</span>
		</div>
	{/if}

	{#if $userStore.profile}
		<ProfileDashboard profile={$userStore.profile} viewerPrincipal={$authPrincipal ?? ''} />
	{:else if $authBusy}
		<div
			class="border-border bg-card flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-24 text-center"
			aria-label={t({ locale: $localeStore, key: 'profile.loading.title' })}
			aria-live="polite"
			role="status"
		>
			<LoadingSpinner center={false} size="md" />
			<h2 class="font-display text-foreground mt-6 text-2xl font-semibold">
				{t({ locale: $localeStore, key: 'profile.loading.title' })}
			</h2>
			<p class="text-muted-foreground mt-2 max-w-xs">
				{t({ locale: $localeStore, key: 'profile.loading.sub' })}
			</p>
		</div>
	{:else}
		<div
			class="border-border bg-card flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-24 text-center"
		>
			<div class="bg-card mb-6 rounded-full p-6">
				<User class="text-muted-foreground" aria-hidden="true" size={40} strokeWidth={1.6} />
			</div>
			<h2 class="font-display text-foreground text-2xl font-semibold">
				{t({ locale: $localeStore, key: 'profile.empty.title' })}
			</h2>
			<p class="text-muted-foreground mt-2 max-w-xs">
				{t({ locale: $localeStore, key: 'profile.empty.sub' })}
			</p>
		</div>
	{/if}
</div>

<style lang="postcss">
	.profile-featured-event {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		align-self: flex-start;
		padding: 0.35rem 0.7rem;
		border: 1px solid color-mix(in srgb, var(--laurel) 28%, transparent);
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--laurel) 12%, transparent);
		color: var(--laurel);
		font-size: var(--t-12);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.profile-featured-event-dot {
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 50%;
		background: currentColor;
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--laurel) 18%, transparent);
	}

	.profile-mobile-icon-btn {
		display: inline-flex;
		width: 2.25rem;
		height: 2.25rem;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		background: var(--bg-surface);
		color: var(--text-base);
		cursor: pointer;
		transition:
			background-color var(--d-hover) var(--ease-vici),
			border-color var(--d-hover) var(--ease-vici);
	}

	.profile-mobile-icon-btn:hover {
		border-color: var(--border-strong);
		background: var(--bg-popover);
	}

	.profile-desktop-icon-btn {
		display: inline-flex;
		width: 2.75rem;
		height: 2.75rem;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		background: var(--bg-surface);
		color: var(--text-base);
		cursor: pointer;
		transition:
			background-color var(--d-hover) var(--ease-vici),
			border-color var(--d-hover) var(--ease-vici);
	}

	.profile-desktop-icon-btn:hover {
		border-color: var(--border-strong);
		background: var(--bg-popover);
	}
</style>
