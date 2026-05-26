<script lang="ts">
	import { getDoc, signOut } from '@junobuild/core';
	import { LogOut, Settings, User } from 'lucide-svelte/icons';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import ProfileDashboard from '$lib/components/profile/ProfileDashboard.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import { Collection } from '$lib/constants/collections.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { authBusy, authPrincipal } from '$lib/derived/user.derived';
	import { getProfile } from '$lib/services/profile.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { userStore } from '$lib/stores/user.store';
	import type { UserProfile } from '$lib/types/profile';
	import { t } from '$lib/utils/i18n.utils';

	let intervalId: ReturnType<typeof setInterval> | undefined;

	/**
	 * Profile doc creation timestamp in nanoseconds. Sourced from
	 * `getDoc`'s `created_at` (Juno's storage layer, not our wire
	 * projection — `functions.getProfile` flattens the doc to its
	 * data field and drops creation metadata). Used by the dashboard
	 * to render the "Joined" line.
	 */
	let joinedAtNs = $state<bigint | undefined>(undefined);
	let trailingMenuOpen = $state(false);

	const loadJoinedAt = async (principal: string) => {
		try {
			const doc = await getDoc<UserProfile>({
				collection: Collection.PROFILES,
				key: principal
			});

			joinedAtNs = doc?.created_at;
		} catch {
			// Synthetic shell or transient — fall back to "no joined date".
			joinedAtNs = undefined;
		}
	};

	const handleSignOut = async () => {
		trailingMenuOpen = false;

		try {
			await signOut();
		} catch (err) {
			console.error('ProfilePage: signOut failed', err);
		}
	};

	const handleOpenSettings = () => {
		trailingMenuOpen = false;
		void goto(resolve(AppPath.Settings));
	};

	onMount(() => {
		const refreshProfile = async () => {
			if ($authPrincipal) {
				const profileDoc = await getProfile($authPrincipal);
				userStore.update((s) => ({ ...s, profile: profileDoc.data }));
				await loadJoinedAt($authPrincipal);
			}
		};

		void refreshProfile();

		intervalId = setInterval(refreshProfile, 60000);

		return () => clearInterval(intervalId);
	});
</script>

{#snippet profileAppbarRight()}
	<button
		class="profile-mobile-icon-btn"
		aria-expanded={trailingMenuOpen}
		aria-haspopup="menu"
		aria-label={t({ locale: $localeStore, key: 'settings.title' })}
		onclick={() => (trailingMenuOpen = !trailingMenuOpen)}
		type="button"
	>
		<Settings aria-hidden="true" size={18} strokeWidth={1.8} />
	</button>
{/snippet}

{#snippet profileDesktopRight()}
	<button
		class="profile-desktop-icon-btn"
		aria-expanded={trailingMenuOpen}
		aria-haspopup="menu"
		aria-label={t({ locale: $localeStore, key: 'settings.title' })}
		onclick={() => (trailingMenuOpen = !trailingMenuOpen)}
		type="button"
	>
		<Settings aria-hidden="true" size={22} strokeWidth={1.6} />
	</button>
{/snippet}

<div class="profile-page space-y-10 pb-24">
	<MobileAppBar
		align="left"
		right={profileAppbarRight}
		title={t({ locale: $localeStore, key: 'profile.title' })}
	/>

	<div class="hidden md:block">
		<SectionHeader
			right={profileDesktopRight}
			title={t({ locale: $localeStore, key: 'profile.title' })}
		/>
	</div>

	{#if trailingMenuOpen}
		<div class="profile-trailing-menu" role="menu">
			<button
				class="profile-trailing-item"
				onclick={handleOpenSettings}
				role="menuitem"
				type="button"
			>
				<Settings aria-hidden="true" size={14} strokeWidth={1.8} />
				<span>{t({ locale: $localeStore, key: 'settings.title' })}</span>
			</button>
			<button
				class="profile-trailing-item is-danger"
				onclick={handleSignOut}
				role="menuitem"
				type="button"
			>
				<LogOut aria-hidden="true" size={14} strokeWidth={1.8} />
				<span>{t({ locale: $localeStore, key: 'settings.sign_out' })}</span>
			</button>
		</div>
	{/if}

	{#if $userStore.profile}
		<ProfileDashboard
			{joinedAtNs}
			profile={$userStore.profile}
			viewerPrincipal={$authPrincipal ?? ''}
		/>
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

	.profile-trailing-menu {
		position: absolute;
		top: 3.25rem;
		right: 0.5rem;
		z-index: 30;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 11rem;
		padding: 0.4rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: var(--bg-popover);
		box-shadow: var(--shadow-card);
	}

	.profile-trailing-item {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.5rem 0.6rem;
		border: 0;
		border-radius: var(--r-8);
		background: transparent;
		color: var(--text-base);
		font: inherit;
		font-size: var(--t-13);
		font-weight: 600;
		text-align: left;
		cursor: pointer;
		transition: background-color var(--d-hover) var(--ease-vici);
	}

	.profile-trailing-item:hover {
		background: color-mix(in srgb, var(--color-primary) 6%, transparent);
	}

	.profile-trailing-item.is-danger {
		color: var(--no);
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
