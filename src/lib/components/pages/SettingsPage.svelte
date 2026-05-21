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
	import { resolve } from '$app/paths';
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
	const notifyTotalCount = $derived(Object.values($preferencesStore.notify).length);
	const visibilityOptions = $derived([
		{
			value: 'public',
			label: t({ locale: $localeStore, key: 'settings.profile_visibility.public' })
		},
		{
			value: 'friends',
			label: t({ locale: $localeStore, key: 'settings.profile_visibility.friends' })
		},
		{
			value: 'private',
			label: t({ locale: $localeStore, key: 'settings.profile_visibility.private' })
		}
	]);

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
				void goto(resolve(AppPath.Profile));
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
			aria-label={t({ locale: $localeStore, key: 'settings.back_profile' })}
			onclick={() => goto(resolve(AppPath.Profile))}
			type="button"
		>
			<ArrowLeft aria-hidden="true" size={18} strokeWidth={1.8} />
		</button>
		<h1 class="settings-title">{t({ locale: $localeStore, key: 'settings.title' })}</h1>
		<span class="settings-appbar-spacer" aria-hidden="true"></span>
	</header>

	<div class="settings-body">
		<SettingsSection title={t({ locale: $localeStore, key: 'settings.account' })}>
			<button class="set-identity" onclick={() => goto(resolve(AppPath.Profile))} type="button">
				<span class="set-identity-avatar" aria-hidden="true">
					{(profile?.nickname?.trim() ?? 'V').slice(0, 1).toUpperCase()}
				</span>
				<span class="set-identity-copy">
					<span class="set-identity-handle">
						@{profile?.nickname?.trim() ??
							t({ locale: $localeStore, key: 'settings.identity.fallback' })}
						{#if archetype}
							<span style:color={archetype.accent} class="set-identity-tag">{archetype.tag}</span>
						{/if}
					</span>
					<span class="set-identity-meta num">
						{t({
							locale: $localeStore,
							key: 'settings.identity.meta',
							params: {
								level: profile?.level ?? 1,
								accuracy: ((profile?.accuracy ?? 0) * 100).toFixed(1),
								calls: profile?.totalTrades ?? 0
							}
						})}
					</span>
				</span>
			</button>

			<SetRow
				icon={Wallet}
				label={t({ locale: $localeStore, key: 'settings.wallet' })}
				onclick={() => goto(resolve(AppPath.Wallet))}
				sub={t({
					locale: $localeStore,
					key: 'settings.wallet.sub',
					params: { points: (profile?.points ?? 0).toLocaleString($localeStore) }
				})}
			/>

			<SetRow
				icon={Users}
				label={t({ locale: $localeStore, key: 'settings.friends' })}
				muted
				onclick={() => goto(resolve(AppPath.Profile))}
				sub={t({ locale: $localeStore, key: 'settings.friends.sub' })}
			/>
		</SettingsSection>

		<SettingsSection title={t({ locale: $localeStore, key: 'settings.preferences' })}>
			<div class="settings-appearance">
				<p class="settings-appearance-label">
					{t({ locale: $localeStore, key: 'settings.appearance' })}
				</p>
				<AppearancePicker />
			</div>

			<SetRow
				icon={Bell}
				label={t({ locale: $localeStore, key: 'settings.notifications' })}
				onclick={() => goto(resolve(AppPath.Notifications))}
				sub={t({
					locale: $localeStore,
					key: 'settings.notifications.sub',
					params: { count: notifyOnCount, total: notifyTotalCount }
				})}
			/>

			<SetSegmented
				icon={Zap}
				label={t({ locale: $localeStore, key: 'settings.session_length' })}
				onchange={(value) => {
					preferencesStore.update((prefs) => ({
						...prefs,
						flowSessionLength: value as FlowSessionLength
					}));
				}}
				options={FLOW_SESSION_LENGTH_OPTIONS}
				sub={t({ locale: $localeStore, key: 'settings.session_length.sub' })}
				value={$preferencesStore.flowSessionLength}
			/>

			<SetSegmented
				label={t({ locale: $localeStore, key: 'settings.language' })}
				onchange={(value) => {
					localeStore.set({ key: LOCALE_STORAGE_KEY, value: value as AppLocale });
				}}
				options={SUPPORTED_LOCALES.map((locale) => ({ value: locale.id, label: locale.label }))}
				sub={t({ locale: $localeStore, key: 'settings.language.sub' })}
				value={$localeStore}
			/>

			<SetToggle
				checked={$preferencesStore.hapticsEnabled}
				icon={Target}
				label={t({ locale: $localeStore, key: 'settings.haptics' })}
				onchange={(value) => {
					preferencesStore.update((prefs) => ({ ...prefs, hapticsEnabled: value }));
				}}
				sub={t({ locale: $localeStore, key: 'settings.haptics.sub' })}
			/>
		</SettingsSection>

		<SettingsSection title={t({ locale: $localeStore, key: 'settings.privacy' })}>
			<SetToggle
				checked={true}
				icon={Lock}
				label={t({ locale: $localeStore, key: 'settings.two_factor' })}
				onchange={() => {}}
				sub={t({ locale: $localeStore, key: 'settings.two_factor.sub' })}
			/>

			<SetSegmented
				icon={Eye}
				label={t({ locale: $localeStore, key: 'settings.profile_visibility' })}
				onchange={(value) => {
					void persistVisibility(value as SettingsVisibility);
				}}
				options={visibilityOptions}
				sub={t({ locale: $localeStore, key: 'settings.profile_visibility.sub' })}
				value={settingsVisibility}
			/>

			<SetToggle
				checked={$preferencesStore.callsPublic}
				icon={Target}
				label={t({ locale: $localeStore, key: 'settings.public_calls' })}
				onchange={(value) => {
					preferencesStore.update((prefs) => ({ ...prefs, callsPublic: value }));
				}}
				sub={t({ locale: $localeStore, key: 'settings.public_calls.sub' })}
			/>
		</SettingsSection>

		<SettingsSection title={t({ locale: $localeStore, key: 'settings.help' })}>
			<SetRow
				icon={Info}
				label={t({ locale: $localeStore, key: 'settings.help.resolution' })}
				muted
				onclick={() => {}}
			/>
			<SetRow
				icon={Search}
				label={t({ locale: $localeStore, key: 'settings.help.faq' })}
				muted
				onclick={() => {}}
			/>
			<SetRow
				icon={Share2}
				label={t({ locale: $localeStore, key: 'settings.help.support' })}
				muted
				onclick={() => {}}
			/>
		</SettingsSection>

		<SettingsSection title={t({ locale: $localeStore, key: 'settings.legal' })}>
			<SetRow
				icon={Lock}
				label={t({ locale: $localeStore, key: 'settings.legal.terms' })}
				muted
				onclick={() => {}}
			/>
			<SetRow
				icon={Eye}
				label={t({ locale: $localeStore, key: 'settings.legal.privacy' })}
				muted
				onclick={() => {}}
			/>
			<SetRow
				icon={CircleQuestionMark}
				label={t({ locale: $localeStore, key: 'settings.legal.rules' })}
				muted
				onclick={() => {}}
			/>
		</SettingsSection>

		<p class="settings-about num">VICI · v0.0.7</p>

		<div class="settings-destructive">
			<Button class="settings-signout" onclick={doSignOut} status={signOutStatus} variant="ghost">
				{t({ locale: $localeStore, key: 'settings.sign_out' })}
			</Button>

			{#if !confirmingDelete}
				<button
					class="settings-delete-link"
					onclick={() => (confirmingDelete = true)}
					type="button"
				>
					{t({ locale: $localeStore, key: 'settings.delete' })}
				</button>
			{:else}
				<div class="settings-confirm">
					<p>{t({ locale: $localeStore, key: 'settings.delete.confirm' })}</p>
					<div class="settings-confirm-actions">
						<Button onclick={() => (confirmingDelete = false)} variant="ghost">
							{t({ locale: $localeStore, key: 'settings.cancel' })}
						</Button>
						<Button onclick={doSignOut} variant="danger">
							{t({ locale: $localeStore, key: 'settings.delete.forever' })}
						</Button>
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
		padding: 0.25rem 0 1rem;
	}

	.settings-back {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-8);
		background: color-mix(in srgb, var(--text-base) 6%, transparent);
		color: var(--text-base);
		cursor: pointer;
	}

	.settings-title {
		margin: 0;
		font-size: var(--t-18);
		font-weight: 600;
		text-align: center;
		color: var(--text-base);
	}

	.settings-appbar-spacer {
		width: 2.125rem;
	}

	.settings-body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.set-identity {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.875rem;
		border: none;
		background: var(--bg-surface);
		color: var(--text-base);
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
		background: var(--laurel-glow);
		color: var(--color-primary);
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
		color: var(--text-base);
	}

	.set-identity-tag {
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.06em;
	}

	.set-identity-meta {
		font-size: 0.6875rem;
		color: var(--text-muted);
	}

	.settings-appearance {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.875rem;
		background: var(--bg-surface);
	}

	.settings-appearance-label {
		margin: 0;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.settings-about {
		margin: 0.25rem 0 0;
		font-size: 0.625rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		text-align: center;
		color: var(--text-muted);
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
		color: var(--color-destructive);
		cursor: pointer;
		text-align: center;
	}

	.settings-confirm {
		padding: 0.75rem;
		border-radius: var(--r-8);
		border: 1px solid var(--border-base);
		background: var(--bg-surface);
		box-shadow: var(--shadow-card);
	}

	.settings-confirm p {
		margin: 0 0 0.75rem;
		font-size: var(--t-12);
		color: var(--text-muted);
	}

	.settings-confirm-actions {
		display: flex;
		gap: 0.5rem;
	}
</style>
