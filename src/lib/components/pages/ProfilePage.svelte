<script lang="ts">
	import { Settings, Shield, User } from 'lucide-svelte/icons';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import ProfileDashboard from '$lib/components/profile/ProfileDashboard.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { authBusy, authPrincipal, userIsAdmin } from '$lib/derived/user.derived';
	import { getProfile } from '$lib/services/profile.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { userStore } from '$lib/stores/user.store';
	import { t } from '$lib/utils/i18n.utils';

	let intervalId: ReturnType<typeof setInterval> | undefined;

	/**
	 * Appbar gear navigates straight to Settings — no trailing menu;
	 * sign-out lives only on the Settings page.
	 */
	const handleOpenSettings = () => {
		void goto(resolve(AppPath.Settings));
	};

	const handleOpenAdmin = () => {
		void goto(resolve(AppPath.Admin));
	};

	onMount(() => {
		const refreshProfile = async () => {
			if ($authPrincipal) {
				const profileDoc = await getProfile($authPrincipal);
				userStore.update((s) => ({ ...s, profile: profileDoc.data }));
			}
		};

		void refreshProfile();

		intervalId = setInterval(refreshProfile, 60000);

		return () => clearInterval(intervalId);
	});
</script>

{#snippet profileSettingsBtn()}
	<div class="profile-appbar-actions">
		{#if $userIsAdmin}
			<button
				class="appbar-icon-btn"
				aria-label={t({ locale: $localeStore, key: 'nav.admin' })}
				onclick={handleOpenAdmin}
				type="button"
			>
				<Shield aria-hidden="true" size={18} strokeWidth={1.8} />
			</button>
		{/if}
		<button
			class="appbar-icon-btn"
			aria-label={t({ locale: $localeStore, key: 'settings.title' })}
			onclick={handleOpenSettings}
			type="button"
		>
			<Settings aria-hidden="true" size={18} strokeWidth={1.8} />
		</button>
	</div>
{/snippet}

<div class="profile-page space-y-10 pb-24">
	<MobileAppBar
		align="left"
		right={profileSettingsBtn}
		title={t({ locale: $localeStore, key: 'profile.title' })}
	/>

	<div class="hidden min-[56rem]:block">
		<SectionHeader
			right={profileSettingsBtn}
			title={t({ locale: $localeStore, key: 'profile.title' })}
		/>
	</div>

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
	.profile-page {
		position: relative;
	}

	.profile-appbar-actions {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
</style>
