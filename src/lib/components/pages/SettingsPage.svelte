<script lang="ts">
	import { signOut } from '@junobuild/core';
	import {
		Activity,
		ArrowLeft,
		Bell,
		CircleQuestionMark,
		Eye,
		Info,
		Lock,
		Search,
		Share2,
		Sun,
		Target,
		Wallet,
		Zap
	} from 'lucide-svelte/icons';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Avatar from '$lib/components/profile/Avatar.svelte';
	import SetRow from '$lib/components/settings/SetRow.svelte';
	import SetSegmented from '$lib/components/settings/SetSegmented.svelte';
	import SetToggle from '$lib/components/settings/SetToggle.svelte';
	import SettingsSection from '$lib/components/settings/SettingsSection.svelte';
	import AppearancePicker from '$lib/components/ui/AppearancePicker.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { ARCHETYPE_MAP } from '$lib/constants/archetypes.constants';
	import {
		LOCALE_STORAGE_KEY,
		SUPPORTED_LOCALES,
		type AppLocale
	} from '$lib/constants/locale.constants';
	import { MARKET_TAGS } from '$lib/constants/market-tags.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { FLOW_SESSION_LENGTH_OPTIONS } from '$lib/constants/settings.constants';
	import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
	import { authPrincipal } from '$lib/derived/user.derived';
	import { ProfileVisibility } from '$lib/enums/profile';
	import { upsertProfile } from '$lib/services/profile.services';
	import { balancesStore } from '$lib/stores/balances.store';
	import { collateralsStore } from '$lib/stores/collaterals.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { preferencesStore } from '$lib/stores/preferences.store';
	import { theme } from '$lib/stores/theme.store';
	import { setAuthBusy, userStore } from '$lib/stores/user.store';
	import type { ButtonStatus } from '$lib/types/components';
	import type { FlowSessionLength, SettingsVisibility } from '$lib/types/preferences';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
	import { formatVxpBalance } from '$lib/utils/playground-display.utils';

	let confirmingDelete = $state(false);
	let signOutStatus = $state<ButtonStatus>('enabled');

	const profile = $derived($userStore.profile);
	const archetype = $derived(profile?.archetype ? ARCHETYPE_MAP.get(profile.archetype) : undefined);

	// "Available" balance shown on the Wallet row: the user's *real*, settled
	// VXP — free wallet balance plus collateral locked on clearing. Realized
	// PnL is already reflected in the wallet balance (settlements credit/debit
	// the ledger), so we don't add it as a separate term. Unrealized PnL is
	// intentionally excluded — the breakdown lives on the Wallet page.
	const vxpAvailableLabel = $derived(
		formatVxpBalance({
			value:
				($balancesStore?.[VXP_TOKEN.id] ?? ZERO) +
				($collateralsStore?.balances[VXP_TOKEN.id] ?? ZERO)
		})
	);

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

	const themeLabel = $derived($theme.charAt(0).toUpperCase() + $theme.slice(1));

	// Flow deck card --------------------------------------------------
	type FlowDeckTab = 'all' | 'single';

	let flowDeckTab = $state<FlowDeckTab>('all');
	const flowDeckTabOptions = $derived([
		{ value: 'all', label: t({ locale: $localeStore, key: 'settings.flow_deck.tab.all' }) },
		{ value: 'single', label: t({ locale: $localeStore, key: 'settings.flow_deck.tab.single' }) }
	]);

	const flowTagsEnabled = $derived(($preferencesStore.flowTags ?? []).length);
	const flowDeckSub = $derived(
		flowTagsEnabled <= 1
			? t({ locale: $localeStore, key: 'settings.flow_deck.sub_one' })
			: t({
					locale: $localeStore,
					key: 'settings.flow_deck.sub',
					params: { enabled: flowTagsEnabled, total: MARKET_TAGS.length }
				})
	);

	const tagLabelKey = (tag: string): MessageKey =>
		`settings.flow_deck.category.${tag}` as MessageKey;

	const toggleFlowTag = (tag: string) => {
		preferencesStore.update((prefs) => {
			const current = prefs.flowTags ?? [...MARKET_TAGS];
			const next = current.includes(tag) ? current.filter((c) => c !== tag) : [...current, tag];

			return { ...prefs, flowTags: next.length === 0 ? [tag] : next };
		});
	};

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
				{#if profile}
					<span class="set-identity-avatar">
						<Avatar
							class="h-full w-full"
							avatar={profile.avatar}
							nickname={profile.nickname}
							owner={profile.owner}
						/>
					</span>
				{:else}
					<span class="set-identity-avatar set-identity-avatar-fallback" aria-hidden="true">
						V
					</span>
				{/if}
				<span class="set-identity-copy">
					<span class="set-identity-handle">
						@{profile?.nickname?.trim() ??
							t({ locale: $localeStore, key: 'settings.identity.fallback' })}
						{#if archetype}
							<span
								style:color={archetype.accent}
								style:background={`color-mix(in srgb, ${archetype.accent} 14%, transparent)`}
								class="set-identity-tag"
							>
								{t({ locale: $localeStore, key: archetype.tagKey })}
							</span>
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
					params: { amount: vxpAvailableLabel }
				})}
			/>
		</SettingsSection>

		<SettingsSection title={t({ locale: $localeStore, key: 'settings.preferences' })}>
			<div class="settings-appearance">
				<div class="settings-appearance-head">
					<span class="settings-appearance-icon" aria-hidden="true">
						<Sun size={16} strokeWidth={1.8} />
					</span>
					<div class="settings-appearance-titles">
						<p class="settings-appearance-label">
							{t({ locale: $localeStore, key: 'settings.appearance' })}
						</p>
						<p class="settings-appearance-current">{themeLabel}</p>
					</div>
				</div>
				<AppearancePicker variant="tiles" />
			</div>

			<div class="settings-flow-deck">
				<div class="settings-flow-deck-head">
					<span class="settings-flow-deck-icon" aria-hidden="true">
						<Activity size={16} strokeWidth={1.8} />
					</span>
					<div class="settings-flow-deck-titles">
						<p class="settings-flow-deck-label">
							{t({ locale: $localeStore, key: 'settings.flow_deck' })}
						</p>
						<p class="settings-flow-deck-sub">{flowDeckSub}</p>
					</div>
				</div>

				<div class="settings-flow-deck-tabs" role="tablist">
					{#each flowDeckTabOptions as tab (tab.value)}
						<button
							class="settings-flow-deck-tab"
							class:is-active={flowDeckTab === tab.value}
							aria-selected={flowDeckTab === tab.value}
							onclick={() => (flowDeckTab = tab.value as FlowDeckTab)}
							role="tab"
							type="button"
						>
							{tab.label}
						</button>
					{/each}
				</div>

				{#if flowDeckTab === 'all'}
					<div class="settings-flow-deck-grid" role="group">
						{#each MARKET_TAGS as tag (tag)}
							{@const enabled = ($preferencesStore.flowTags ?? []).includes(tag)}
							<button
								class="settings-flow-deck-pill"
								class:is-active={enabled}
								aria-pressed={enabled}
								onclick={() => toggleFlowTag(tag)}
								type="button"
							>
								<span class="settings-flow-deck-pill-dot" aria-hidden="true"></span>
								{t({ locale: $localeStore, key: tagLabelKey(tag) })}
							</button>
						{/each}
					</div>
				{:else}
					<p class="settings-flow-deck-hint">
						{t({ locale: $localeStore, key: 'settings.flow_deck.single_soon' })}
					</p>
				{/if}
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
				checked={false}
				disabled={true}
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
				onclick={() => {}}
			/>
			<SetRow
				icon={Search}
				label={t({ locale: $localeStore, key: 'settings.help.faq' })}
				onclick={() => {}}
			/>
			<SetRow
				icon={Share2}
				label={t({ locale: $localeStore, key: 'settings.help.support' })}
				onclick={() => {}}
			/>
		</SettingsSection>

		<SettingsSection title={t({ locale: $localeStore, key: 'settings.legal' })}>
			<SetRow
				icon={Lock}
				label={t({ locale: $localeStore, key: 'settings.legal.terms' })}
				onclick={() => {}}
			/>
			<SetRow
				icon={Eye}
				label={t({ locale: $localeStore, key: 'settings.legal.privacy' })}
				onclick={() => {}}
			/>
			<SetRow
				icon={CircleQuestionMark}
				label={t({ locale: $localeStore, key: 'settings.legal.rules' })}
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
		overflow: hidden;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		flex-shrink: 0;
		border-radius: 999px;
		background: var(--bg-popover);
	}

	.set-identity-avatar-fallback {
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
		display: inline-flex;
		align-items: center;
		padding: 0.1rem 0.4rem;
		border-radius: var(--r-4);
		font-family: var(--font-mono);
		font-size: 0.6rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.set-identity-meta {
		font-size: 0.6875rem;
		color: var(--text-muted);
	}

	.settings-appearance {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 0.875rem;
		background: var(--bg-surface);
	}

	.settings-appearance-head {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}

	.settings-appearance-icon {
		display: inline-flex;
		width: 1.85rem;
		height: 1.85rem;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		border-radius: var(--r-8);
		background: var(--laurel-glow);
		color: var(--color-primary);
	}

	.settings-appearance-titles {
		display: flex;
		min-width: 0;
		flex: 1;
		flex-direction: column;
		gap: 0.1rem;
	}

	.settings-appearance-label {
		margin: 0;
		color: var(--text-base);
		font-size: var(--t-14);
		font-weight: 700;
	}

	.settings-appearance-current {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--t-12);
	}

	/* Flow deck preference card ---------------------------------- */
	.settings-flow-deck {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 0.875rem;
		background: var(--bg-surface);
	}

	.settings-flow-deck-head {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}

	.settings-flow-deck-icon {
		display: inline-flex;
		width: 1.85rem;
		height: 1.85rem;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		border-radius: var(--r-8);
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
		color: var(--color-primary);
	}

	.settings-flow-deck-titles {
		display: flex;
		min-width: 0;
		flex: 1;
		flex-direction: column;
		gap: 0.1rem;
	}

	.settings-flow-deck-label {
		margin: 0;
		color: var(--text-base);
		font-size: var(--t-14);
		font-weight: 700;
	}

	.settings-flow-deck-sub {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--t-12);
	}

	.settings-flow-deck-tabs {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.25rem;
		padding: 0.25rem;
		border: 1px solid var(--border-base);
		border-radius: 0.85rem;
		background: var(--bg-popover);
	}

	.settings-flow-deck-tab {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.55rem 0.5rem;
		border: 0;
		border-radius: 0.65rem;
		background: transparent;
		color: var(--text-muted);
		font-size: var(--t-13);
		font-weight: 600;
		cursor: pointer;
		transition:
			background-color var(--d-hover) var(--ease-vici),
			color var(--d-hover) var(--ease-vici);
	}

	.settings-flow-deck-tab.is-active {
		background: var(--bg-surface);
		color: var(--text-base);
		box-shadow: var(--shadow-card);
	}

	.settings-flow-deck-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
	}

	.settings-flow-deck-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.65rem 0.8rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--color-primary) 5%, var(--bg-popover));
		color: var(--text-muted);
		font-size: var(--t-13);
		font-weight: 600;
		cursor: pointer;
		transition:
			border-color var(--d-hover) var(--ease-vici),
			background-color var(--d-hover) var(--ease-vici),
			color var(--d-hover) var(--ease-vici);
	}

	.settings-flow-deck-pill.is-active {
		border-color: color-mix(in srgb, var(--color-primary) 35%, var(--border-base));
		background: color-mix(in srgb, var(--color-primary) 12%, var(--bg-popover));
		color: var(--color-primary);
	}

	.settings-flow-deck-pill-dot {
		display: inline-block;
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 999px;
		background: var(--text-muted);
	}

	.settings-flow-deck-pill.is-active .settings-flow-deck-pill-dot {
		background: var(--color-primary);
	}

	.settings-flow-deck-hint {
		margin: 0;
		padding: 0.65rem 0.25rem 0.15rem;
		color: var(--text-muted);
		font-size: var(--t-12);
		text-align: center;
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
