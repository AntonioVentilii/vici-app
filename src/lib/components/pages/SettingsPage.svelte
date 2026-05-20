<script lang="ts">
	import { signOut } from '@junobuild/core';
	import {
		ArrowLeft,
		Bell,
		CircleQuestionMark,
		Eye,
		Info,
		Lock,
		Search,
		Share2,
		Target,
		Users,
		Wallet,
		Zap
	} from 'lucide-svelte/icons';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import SetRow from '$lib/components/settings/SetRow.svelte';
	import SetSegmented from '$lib/components/settings/SetSegmented.svelte';
	import SetToggle from '$lib/components/settings/SetToggle.svelte';
	import SettingsSection from '$lib/components/settings/SettingsSection.svelte';
	import AppearancePicker from '$lib/components/ui/AppearancePicker.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { ARCHETYPE_MAP } from '$lib/constants/archetypes.constants';
	import {
		LOCALE_STORAGE_KEY,
		SUPPORTED_LOCALES,
		type AppLocale
	} from '$lib/constants/locale.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { FLOW_SESSION_LENGTH_OPTIONS } from '$lib/constants/settings.constants';
	import { authPrincipal } from '$lib/derived/user.derived';
	import { ProfileVisibility } from '$lib/enums/profile';
	import { upsertProfile } from '$lib/services/profile.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { preferencesStore } from '$lib/stores/preferences.store';
	import { setAuthBusy, userStore } from '$lib/stores/user.store';
	import type { ButtonStatus } from '$lib/types/components';
	import type { FlowSessionLength, SettingsVisibility } from '$lib/types/preferences';
	import { t } from '$lib/utils/i18n.utils';

	let confirmingDelete = $state(false);
	let signOutStatus = $state<ButtonStatus>('enabled');

	const profile = $derived($userStore.profile);
	const archetype = $derived(profile?.archetype ? ARCHETYPE_MAP.get(profile.archetype) : undefined);

	const notifyOnCount = $derived(Object.values($preferencesStore.notify).filter(Boolean).length);

	const visibilityFromProfile = (value: ProfileVisibility | undefined): SettingsVisibility => {
		if (value === ProfileVisibility.PUBLIC) {
			return 'public';
		}

		if (value === ProfileVisibility.FRIENDS_AND_FOLLOWERS) {
			return 'friends';
		}

		return 'private';
	};

	const visibilityToProfile = (value: SettingsVisibility): ProfileVisibility => {
		if (value === 'public') {
			return ProfileVisibility.PUBLIC;
		}

		if (value === 'friends') {
			return ProfileVisibility.FRIENDS_AND_FOLLOWERS;
		}

		return ProfileVisibility.FRIENDS_ONLY;
	};

	const settingsVisibility = $derived(visibilityFromProfile(profile?.visibility));

	const persistVisibility = async (value: SettingsVisibility) => {
		const principal = $authPrincipal;

		if (!principal || !profile) {
			return;
		}

		const data = { ...profile, visibility: visibilityToProfile(value) };

		await upsertProfile({ key: principal, data });
		userStore.update((s) => ({ ...s, profile: data }));
	};

	const doSignOut = async () => {
		signOutStatus = 'pending';
		setAuthBusy(true);

		try {
			await signOut();
		} finally {
			signOutStatus = 'enabled';
		}
	};

	onMount(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				void goto(AppPath.Profile);
			}
		};

		window.addEventListener('keydown', onKey);

		return () => window.removeEventListener('keydown', onKey);
	});
</script>

<div class="settings-page">
	<header class="settings-appbar">
		<button
			class="settings-back"
			aria-label="Back to profile"
			onclick={() => goto(AppPath.Profile)}
			type="button"
		>
			<ArrowLeft size={18} strokeWidth={1.8} />
		</button>
		<h1 class="settings-title">{t({ locale: $localeStore, key: 'settings.title' })}</h1>
		<span class="settings-appbar-spacer" aria-hidden="true"></span>
	</header>

	<div class="settings-body">
		<SettingsSection title="Account">
			<button class="set-identity" onclick={() => goto(AppPath.Profile)} type="button">
				<span class="set-identity-avatar" aria-hidden="true">
					{(profile?.nickname?.trim() ?? 'V').slice(0, 1).toUpperCase()}
				</span>
				<span class="set-identity-copy">
					<span class="set-identity-handle">
						@{profile?.nickname?.trim() ?? 'predictor'}
						{#if archetype}
							<span style:color={archetype.accent} class="set-identity-tag">{archetype.tag}</span>
						{/if}
					</span>
					<span class="set-identity-meta num">
						Lvl {profile?.level ?? 1} · {((profile?.accuracy ?? 0) * 100).toFixed(1)}% accuracy ·
						{profile?.totalTrades ?? 0} calls
					</span>
				</span>
			</button>

			<SetRow
				icon={Wallet}
				label="Wallet"
				onclick={() => goto(AppPath.Wallet)}
				sub="{(profile?.points ?? 0).toLocaleString()} VXP available"
			/>

			<SetRow
				icon={Users}
				label="Connected friends"
				muted
				onclick={() => goto(AppPath.Profile)}
				sub="Social graph"
			/>
		</SettingsSection>

		<SettingsSection title="Preferences">
			<div class="settings-appearance">
				<p class="settings-appearance-label">Appearance</p>
				<AppearancePicker />
			</div>

			<SetRow
				icon={Bell}
				label="Notifications"
				onclick={() => goto(AppPath.Notifications)}
				sub="{notifyOnCount} of 4 on · daily 7pm"
			/>

			<SetSegmented
				icon={Zap}
				label="Flow session length"
				onchange={(value) => {
					preferencesStore.update((prefs) => ({
						...prefs,
						flowSessionLength: value as FlowSessionLength
					}));
				}}
				options={FLOW_SESSION_LENGTH_OPTIONS}
				sub="Markets per session"
				value={$preferencesStore.flowSessionLength}
			/>

			<SetSegmented
				label="Language"
				onchange={(value) => {
					localeStore.set({ key: LOCALE_STORAGE_KEY, value: value as AppLocale });
				}}
				options={SUPPORTED_LOCALES.map((locale) => ({ value: locale.id, label: locale.label }))}
				sub="English and Italian available now"
				value={$localeStore}
			/>

			<SetToggle
				checked={$preferencesStore.hapticsEnabled}
				icon={Target}
				label="Haptics & sound"
				onchange={(value) => {
					preferencesStore.update((prefs) => ({ ...prefs, hapticsEnabled: value }));
				}}
				sub="Subtle taps on YES/NO commit"
			/>
		</SettingsSection>

		<SettingsSection title="Privacy & security">
			<SetToggle
				checked={true}
				icon={Lock}
				label="Two-factor authentication"
				onchange={() => {}}
				sub="Enabled · authenticator app"
			/>

			<SetSegmented
				icon={Eye}
				label="Profile visibility"
				onchange={(value) => {
					void persistVisibility(value as SettingsVisibility);
				}}
				options={[
					{ value: 'public', label: 'Public' },
					{ value: 'friends', label: 'Friends' },
					{ value: 'private', label: 'Private' }
				]}
				sub="Who can see your calls and accuracy"
				value={settingsVisibility}
			/>

			<SetToggle
				checked={$preferencesStore.callsPublic}
				icon={Target}
				label="Public call history"
				onchange={(value) => {
					preferencesStore.update((prefs) => ({ ...prefs, callsPublic: value }));
				}}
				sub="Show your last 30 calls on your profile"
			/>
		</SettingsSection>

		<SettingsSection title="Help">
			<SetRow icon={Info} label="How resolution works" muted onclick={() => {}} />
			<SetRow icon={Search} label="Frequently asked" muted onclick={() => {}} />
			<SetRow icon={Share2} label="Contact support" muted onclick={() => {}} />
		</SettingsSection>

		<SettingsSection title="Legal">
			<SetRow icon={Lock} label="Terms of service" muted onclick={() => {}} />
			<SetRow icon={Eye} label="Privacy policy" muted onclick={() => {}} />
			<SetRow icon={CircleQuestionMark} label="Resolution rules" muted onclick={() => {}} />
		</SettingsSection>

		<p class="settings-about num">VICI · v0.0.7</p>

		<div class="settings-destructive">
			<Button class="settings-signout" onclick={doSignOut} status={signOutStatus} variant="ghost">
				Sign out
			</Button>

			{#if !confirmingDelete}
				<button
					class="settings-delete-link"
					onclick={() => (confirmingDelete = true)}
					type="button"
				>
					Delete account
				</button>
			{:else}
				<div class="settings-confirm">
					<p>This erases your handle, history, and XP. Cannot be undone.</p>
					<div class="settings-confirm-actions">
						<Button onclick={() => (confirmingDelete = false)} variant="ghost">Cancel</Button>
						<Button onclick={doSignOut} variant="danger">Delete forever</Button>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<style lang="postcss">
	.settings-page {
		max-width: 40rem;
		margin: 0 auto;
		padding-bottom: 5rem;
	}

	.settings-appbar {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0 1rem;
	}

	.settings-back {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 0.625rem;
		border: none;
		border-radius: var(--r-8);
		background: transparent;
		color: var(--parchment);
		cursor: pointer;
	}

	.settings-title {
		margin: 0;
		font-size: var(--t-18);
		font-weight: 600;
		text-align: center;
	}

	.settings-appbar-spacer {
		width: 2.125rem;
	}

	.settings-body {
		display: flex;
		flex-direction: column;
		gap: 1.125rem;
	}

	.set-identity {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.875rem;
		border: none;
		background: var(--bg-surface);
		text-align: left;
		cursor: pointer;
	}

	.set-identity-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: var(--r-8);
		background: var(--laurel-wash);
		color: var(--laurel);
		font-weight: 700;
	}

	.set-identity-copy {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}

	.set-identity-handle {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.375rem;
		font-size: var(--t-14);
		font-weight: 600;
	}

	.set-identity-tag {
		font-size: var(--t-10);
		font-weight: 700;
		letter-spacing: 0.06em;
	}

	.set-identity-meta {
		font-size: var(--t-11);
		color: var(--parchment-mute);
	}

	.settings-appearance {
		padding: 0.75rem 0.875rem;
		background: var(--bg-surface);
	}

	.settings-appearance-label {
		margin: 0 0 0.5rem;
		font-size: var(--t-14);
		font-weight: 500;
	}

	.settings-about {
		margin: 0.25rem 0 0;
		font-size: var(--t-10);
		letter-spacing: 0.1em;
		text-transform: uppercase;
		text-align: center;
		color: var(--parchment-mute);
	}

	.settings-destructive {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	:global(.settings-signout) {
		width: 100%;
	}

	.settings-delete-link {
		border: none;
		background: none;
		font-size: var(--t-12);
		color: var(--no);
		cursor: pointer;
		text-align: center;
	}

	.settings-confirm {
		padding: 0.75rem;
		border-radius: var(--r-8);
		border: 1px solid var(--border-base);
		background: var(--bg-surface);
	}

	.settings-confirm p {
		margin: 0 0 0.75rem;
		font-size: var(--t-12);
		color: var(--parchment-mute);
	}

	.settings-confirm-actions {
		display: flex;
		gap: 0.5rem;
	}
</style>
