<script lang="ts">
	import { getDoc, signOut } from '@junobuild/core';
	import {
		Activity,
		Bell,
		ChevronLeft,
		ChevronRight,
		Eye,
		Globe,
		Info,
		KeyRound,
		LineChart,
		Lock,
		Mail,
		Moon,
		Search,
		Share2,
		Sun,
		Target,
		Trophy,
		Users,
		Volume2
	} from 'lucide-svelte/icons';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import DeleteAccountFlow from '$lib/components/settings/DeleteAccountFlow.svelte';
	import LanguageSheet from '$lib/components/settings/LanguageSheet.svelte';
	import SetRow from '$lib/components/settings/SetRow.svelte';
	import SetSegmented from '$lib/components/settings/SetSegmented.svelte';
	import SetToggle from '$lib/components/settings/SetToggle.svelte';
	import SettingsIdentityCard from '$lib/components/settings/SettingsIdentityCard.svelte';
	import SettingsSection from '$lib/components/settings/SettingsSection.svelte';
	import AppearancePicker from '$lib/components/ui/AppearancePicker.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { Collection } from '$lib/constants/collections.constants';
	import { LOCALE_STORAGE_KEY, SUPPORTED_LOCALES } from '$lib/constants/locale.constants';
	import { MARKET_TAGS } from '$lib/constants/market-tags.constants';
	import { AppPath, PublicPath } from '$lib/constants/routes.constants';
	import { authPrincipal } from '$lib/derived/user.derived';
	import { upsertProfile } from '$lib/services/profile.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { preferencesStore } from '$lib/stores/preferences.store';
	import { theme } from '$lib/stores/theme.store';
	import { setAuthBusy, userStore } from '$lib/stores/user.store';
	import type { ButtonStatus } from '$lib/types/components';
	import type { SettingsVisibility } from '$lib/types/preferences';
	import type { UserProfile } from '$lib/types/profile';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
	import { goBack } from '$lib/utils/nav.utils';
	import { visibilityFromProfile, visibilityToProfile } from '$lib/utils/visibility.utils';

	// Delete-account flow — the six-beat flow lives in
	// `DeleteAccountFlow`; this page only owns the open/close toggle.
	let deleteSheetOpen = $state(false);

	// Language picker — the searchable list lives in `LanguageSheet`;
	// the row below opens it and reflects the active locale.
	let langSheetOpen = $state(false);

	const activeLocale = $derived(
		SUPPORTED_LOCALES.find((locale) => locale.id === $localeStore) ?? SUPPORTED_LOCALES[0]
	);

	let signOutStatus = $state<ButtonStatus>('enabled');
	let confirmingSignOut = $state(false);

	// Local transient toast pill. Kept page-local instead of routing
	// through `notificationsStore` because the surface wants a compact
	// pill pinned to the bottom of the page, not a full-stack
	// notification.
	let toastMessage = $state<string | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | undefined;

	const flashToast = (message: string) => {
		if (toastTimer) {
			clearTimeout(toastTimer);
		}

		toastMessage = message;
		toastTimer = setTimeout(() => {
			toastMessage = null;
		}, 1800);
	};

	// Joined date — sourced from the Juno profile doc's `created_at` (ns).
	// Mirrors the `ProfilePage` loader so the identity row's "Joined …"
	// line stays in sync with the dashboard's joined chip.
	let joinedAtNs = $state<bigint | undefined>(undefined);

	const loadJoinedAt = async (principal: string) => {
		try {
			const doc = await getDoc<UserProfile>({
				collection: Collection.PROFILES,
				key: principal
			});

			joinedAtNs = doc?.created_at;
		} catch {
			joinedAtNs = undefined;
		}
	};

	const joinedLabel = $derived.by(() => {
		if (joinedAtNs === undefined) {
			return null;
		}

		const ms = Number(joinedAtNs / 1_000_000n);
		const date = new Date(ms);

		try {
			const formatter = new Intl.DateTimeFormat($localeStore, {
				month: 'long',
				year: 'numeric'
			});

			return formatter.format(date);
		} catch {
			return date.toISOString().slice(0, 7);
		}
	});

	const profile = $derived($userStore.profile);
	const nickname = $derived(profile?.nickname ?? '');
	const email = $derived(profile?.email ?? '');
	const hasEmail = $derived(email.length > 0);

	// Sign-in method sub — `{provider_account} · {method_label}`
	// (e.g. `tacitus@vici.market · magic link`). For Internet
	// Identity accounts (no email on file) we fall back to a friendly
	// "Internet Identity" label.
	const signinMethodSub = $derived(
		hasEmail
			? t({
					locale: $localeStore,
					key: 'settings.account.signin_method.magic_link',
					params: { email }
				})
			: t({ locale: $localeStore, key: 'settings.account.signin_method.ii' })
	);

	// Email row sub — just the address; the "verified" affordance is
	// rendered as a separate green badge.
	const emailSub = $derived(
		hasEmail ? email : t({ locale: $localeStore, key: 'settings.account.email.empty' })
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

	const settingsVisibility = $derived(visibilityFromProfile(profile?.visibility));

	const themeLabel = $derived($theme.charAt(0).toUpperCase() + $theme.slice(1));

	// About line — `VICI · v{version} · Build {sha}`. Both values are
	// injected at build time via vite `define` (see `vite.config.ts`),
	// so the line surfaces the actual shipped artefact and not a
	// hard-coded literal.
	const aboutLine = $derived(
		t({
			locale: $localeStore,
			key: 'settings.about',
			params: { version: __APP_VERSION__, build: __BUILD_SHA__ }
		})
	);

	// Flow deck card --------------------------------------------------
	// Two-way segmented control: `all` shows the category-pill grid,
	// `wc` flips the deck to World Cup markets only. Mirrors the
	// SetSegmented on the SettingsScreen — when `wc` is selected the
	// pill grid is hidden and a single explanatory line surfaces.
	type FlowDeckMode = 'all' | 'wc';

	const flowDeckMode = $derived<FlowDeckMode>($preferencesStore.worldCupMode ? 'wc' : 'all');

	const flowDeckTabOptions = $derived([
		{ value: 'all', label: t({ locale: $localeStore, key: 'settings.flow_deck.tab.all' }) },
		{ value: 'wc', label: t({ locale: $localeStore, key: 'settings.flow_deck.tab.wc' }) }
	]);

	// `wc` lives on its own tab next to "All categories"; the grid only
	// surfaces the other tags so the user doesn't see the same control in
	// two places.
	const settingsCategoryTags = $derived(MARKET_TAGS.filter((tag) => tag !== 'wc'));
	const flowTagsEnabled = $derived(
		($preferencesStore.flowTags ?? []).filter((tag) => tag !== 'wc').length
	);
	const flowDeckSub = $derived(
		flowDeckMode === 'wc'
			? t({ locale: $localeStore, key: 'settings.flow_deck.sub_wc' })
			: flowTagsEnabled <= 1
				? t({ locale: $localeStore, key: 'settings.flow_deck.sub_one' })
				: t({
						locale: $localeStore,
						key: 'settings.flow_deck.sub',
						params: { enabled: flowTagsEnabled, total: settingsCategoryTags.length }
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

	const setFlowDeckMode = (mode: FlowDeckMode) => {
		preferencesStore.update((prefs) => ({ ...prefs, worldCupMode: mode === 'wc' }));
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

		try {
			await dropAuth();
		} finally {
			signOutStatus = 'enabled';
			confirmingSignOut = false;
		}
	};

	/**
	 * Drop auth so the user lands on the sign-in screen. Reused both by
	 * the in-page sign-out confirm and as the `DeleteAccountFlow`'s
	 * sign-out hook (after a successful delete or a 30-day pause).
	 * `signOut()` clears local stores; `setAuthBusy` keeps the global
	 * busy flag set while it does.
	 */
	const dropAuth = async () => {
		setAuthBusy(true);
		await signOut();
	};

	onMount(() => {
		if ($authPrincipal) {
			void loadJoinedAt($authPrincipal);
		}

		const onKey = (event: KeyboardEvent) => {
			// Open sheets own Escape while visible (they close themselves,
			// not the page); don't navigate away underneath them.
			if (event.key === 'Escape' && !deleteSheetOpen && !langSheetOpen) {
				void goto(resolve(AppPath.Profile));
			}
		};

		window.addEventListener('keydown', onKey);

		return () => {
			window.removeEventListener('keydown', onKey);

			if (toastTimer) {
				clearTimeout(toastTimer);
			}
		};
	});
</script>

<div class="settings-page">
	<header class="settings-appbar">
		<button
			class="appbar-icon-btn"
			aria-label={t({ locale: $localeStore, key: 'settings.back_profile' })}
			onclick={() => goBack(resolve(AppPath.Profile))}
			type="button"
		>
			<ChevronLeft aria-hidden="true" size={18} strokeWidth={1.6} />
		</button>
		<h1 class="settings-appbar-title">
			{t({ locale: $localeStore, key: 'settings.title' })}
		</h1>
		<span class="settings-appbar-spacer" aria-hidden="true"></span>
	</header>

	<div class="settings-body">
		<SettingsSection title={t({ locale: $localeStore, key: 'settings.account' })}>
			<SettingsIdentityCard {joinedLabel} {profile} />

			<SetRow
				icon={KeyRound}
				label={t({ locale: $localeStore, key: 'settings.account.signin_method' })}
				onclick={() => goto(resolve(AppPath.AccountSettings))}
				sub={signinMethodSub}
			/>

			<SetRow
				icon={Mail}
				label={t({ locale: $localeStore, key: 'settings.account.email' })}
				onclick={() => goto(resolve(AppPath.AccountSettings))}
				sub={emailSub}
			>
				{#snippet right()}
					{#if hasEmail}
						<span class="settings-verified-pill">
							{t({ locale: $localeStore, key: 'settings.account.email.verified' })}
						</span>
					{/if}
				{/snippet}
			</SetRow>
		</SettingsSection>

		<SettingsSection title={t({ locale: $localeStore, key: 'settings.preferences' })}>
			<div class="settings-appearance">
				<div class="settings-appearance-head">
					<span class="settings-appearance-icon" aria-hidden="true">
						{#if $theme === 'dark'}
							<Moon size={16} strokeWidth={1.8} />
						{:else}
							<Sun size={16} strokeWidth={1.8} />
						{/if}
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
							class:is-active={flowDeckMode === tab.value}
							aria-selected={flowDeckMode === tab.value}
							onclick={() => setFlowDeckMode(tab.value as FlowDeckMode)}
							role="tab"
							type="button"
						>
							{tab.label}
						</button>
					{/each}
				</div>

				{#if flowDeckMode === 'all'}
					<div class="settings-flow-deck-grid" role="group">
						{#each settingsCategoryTags as tag (tag)}
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
						{t({ locale: $localeStore, key: 'settings.flow_deck.wc_only' })}
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

			<SetRow
				icon={Globe}
				label={t({ locale: $localeStore, key: 'settings.language' })}
				onclick={() => (langSheetOpen = true)}
				sub={activeLocale.label}
			>
				{#snippet right()}
					<span class="settings-lang-right">
						<span class="settings-lang-short num">{activeLocale.short}</span>
						<ChevronRight aria-hidden="true" size={16} strokeWidth={1.6} />
					</span>
				{/snippet}
			</SetRow>

			<SetToggle
				checked={$preferencesStore.hapticsEnabled}
				icon={Target}
				label={t({ locale: $localeStore, key: 'settings.haptics' })}
				onchange={(value) => {
					preferencesStore.update((prefs) => ({ ...prefs, hapticsEnabled: value }));
				}}
				sub={t({ locale: $localeStore, key: 'settings.haptics.sub' })}
			/>

			<SetToggle
				checked={$preferencesStore.soundEnabled}
				icon={Volume2}
				label={t({ locale: $localeStore, key: 'settings.sound' })}
				onchange={(value) => {
					preferencesStore.update((prefs) => ({ ...prefs, soundEnabled: value }));
				}}
				sub={t({ locale: $localeStore, key: 'settings.sound.sub' })}
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
				icon={LineChart}
				label={t({ locale: $localeStore, key: 'settings.public_calls' })}
				onchange={(value) => {
					preferencesStore.update((prefs) => ({ ...prefs, callsPublic: value }));
				}}
				sub={t({ locale: $localeStore, key: 'settings.public_calls.sub' })}
			/>
		</SettingsSection>

		<!--
			Secondary Privacy section — a "Privacy" card holding three
			share toggles distinct from the privacy-and-security set
			above. The fields are not yet wired to the profile schema;
			they round-trip a flash-toast confirmation until a `sharing`
			slice lands on `preferences`.
		-->
		<SettingsSection title={t({ locale: $localeStore, key: 'settings.privacy_share' })}>
			<SetToggle
				checked={true}
				icon={Eye}
				label={t({ locale: $localeStore, key: 'settings.privacy_share.public_profile' })}
				onchange={() => flashToast(t({ locale: $localeStore, key: 'settings.toast.saved' }))}
				sub={t({ locale: $localeStore, key: 'settings.privacy_share.public_profile.sub' })}
			/>

			<SetToggle
				checked={true}
				icon={Users}
				label={t({ locale: $localeStore, key: 'settings.privacy_share.global' })}
				onchange={() => flashToast(t({ locale: $localeStore, key: 'settings.toast.saved' }))}
				sub={t({ locale: $localeStore, key: 'settings.privacy_share.global.sub' })}
			/>

			<SetToggle
				checked={true}
				icon={Trophy}
				label={t({ locale: $localeStore, key: 'settings.privacy_share.worlds' })}
				onchange={() => flashToast(t({ locale: $localeStore, key: 'settings.toast.saved' }))}
				sub={t({ locale: $localeStore, key: 'settings.privacy_share.worlds.sub' })}
			/>
		</SettingsSection>

		<SettingsSection title={t({ locale: $localeStore, key: 'settings.data' })}>
			<SetRow
				icon={Share2}
				label={t({ locale: $localeStore, key: 'settings.data.export' })}
				muted
				onclick={() => flashToast(t({ locale: $localeStore, key: 'settings.toast.export_coming' }))}
				sub={t({ locale: $localeStore, key: 'settings.data.export.sub' })}
			/>
			<SetRow
				icon={Trophy}
				label={t({ locale: $localeStore, key: 'settings.data.album' })}
				muted
				onclick={() =>
					flashToast(t({ locale: $localeStore, key: 'settings.toast.download_coming' }))}
				sub={t({ locale: $localeStore, key: 'settings.data.album.sub' })}
			/>
		</SettingsSection>

		<SettingsSection title={t({ locale: $localeStore, key: 'settings.help' })}>
			<SetRow
				icon={Info}
				label={t({ locale: $localeStore, key: 'settings.help.resolution' })}
				onclick={() => goto(resolve(`${PublicPath.Info}/how-resolution-works`))}
			/>
			<SetRow
				icon={Search}
				label={t({ locale: $localeStore, key: 'settings.help.faq' })}
				onclick={() => goto(resolve(`${PublicPath.Info}/faq`))}
			/>
			<SetRow
				icon={Share2}
				label={t({ locale: $localeStore, key: 'settings.help.support' })}
				onclick={() => goto(resolve(`${PublicPath.Info}/contact`))}
			/>
		</SettingsSection>

		<SettingsSection title={t({ locale: $localeStore, key: 'settings.legal' })}>
			<SetRow
				icon={Lock}
				label={t({ locale: $localeStore, key: 'settings.legal.terms' })}
				onclick={() => goto(resolve(`${PublicPath.Info}/terms`))}
			/>
			<SetRow
				icon={Eye}
				label={t({ locale: $localeStore, key: 'settings.legal.privacy' })}
				onclick={() => goto(resolve(`${PublicPath.Info}/privacy`))}
			/>
			<SetRow
				icon={Info}
				label={t({ locale: $localeStore, key: 'settings.legal.rules' })}
				onclick={() => goto(resolve(`${PublicPath.Info}/resolution-rules`))}
			/>
		</SettingsSection>

		<p class="settings-about num">{aboutLine}</p>

		<div class="settings-destructive">
			{#if !confirmingSignOut}
				<Button class="settings-signout" onclick={() => (confirmingSignOut = true)} variant="ghost">
					{t({ locale: $localeStore, key: 'settings.sign_out' })}
				</Button>
			{:else}
				<div class="settings-confirm settings-signout-confirm">
					<p>{t({ locale: $localeStore, key: 'settings.sign_out.confirm' })}</p>
					<div class="settings-confirm-actions">
						<Button onclick={() => (confirmingSignOut = false)} variant="ghost">
							{t({ locale: $localeStore, key: 'settings.sign_out.cancel' })}
						</Button>
						<Button onclick={doSignOut} status={signOutStatus} variant="primary">
							{t({ locale: $localeStore, key: 'settings.sign_out' })}
						</Button>
					</div>
				</div>
			{/if}

			<button class="settings-delete-link" onclick={() => (deleteSheetOpen = true)} type="button">
				{t({ locale: $localeStore, key: 'settings.delete' })}
			</button>
		</div>
	</div>

	<DeleteAccountFlow
		isOpen={deleteSheetOpen}
		{nickname}
		onClose={() => (deleteSheetOpen = false)}
		onSignOut={dropAuth}
	/>

	<LanguageSheet
		current={$localeStore}
		isOpen={langSheetOpen}
		onClose={() => (langSheetOpen = false)}
		onPick={(locale) => {
			localeStore.set({ key: LOCALE_STORAGE_KEY, value: locale });
			langSheetOpen = false;
		}}
	/>

	{#if toastMessage !== null}
		<!--
			Pill-shaped transient toast pinned to the bottom of the page.
			Local to this surface — used for low-stakes confirmations
			(Saved / coming soon) that don't warrant a global
			notification entry.
		-->
		<div class="settings-toast t-eyebrow" aria-live="polite" role="status">
			{toastMessage}
		</div>
	{/if}
</div>

<style lang="postcss">
	.settings-page {
		padding: 0 1.25rem 6rem;
	}

	.settings-appbar {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.5rem;
		padding: 1.25rem 0 1rem;
	}

	.settings-appbar-title {
		min-width: 0;
		margin: 0;
		font-size: var(--t-20);
		font-weight: 600;
		line-height: 1.2;
		letter-spacing: var(--tracking-snug);
		color: var(--text-base);
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.settings-appbar-spacer {
		width: 2.5rem;
	}

	/* Verified email pill — small green badge rendered in the SetRow
	   `right` snippet. Uses YES (green) tokens to read as a positive
	   verification affordance, distinct from the laurel-gold default
	   badge slot. */
	.settings-verified-pill {
		flex-shrink: 0;
		padding: 0.125rem 0.5rem;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--yes) 14%, transparent);
		color: var(--yes);
		font-family: var(--font-mono);
		font-size: var(--t-10);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	/* Language row trailing affordance — the active locale's short code
	   (mono, muted) sitting beside the chevron, mirroring the row's
	   `right` slot. */
	.settings-lang-right {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		gap: 0.5rem;
		color: var(--text-muted);
	}

	.settings-lang-short {
		font-size: var(--t-11);
		font-weight: 600;
		letter-spacing: 0.06em;
		color: var(--text-muted);
	}

	.settings-body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
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
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		color: var(--text-muted);
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

	/* Category toggle chip. 8-px rounded rectangle (intentionally
	   NOT a pill — the squarer geometry pairs better with the dense
	   2-col grid of categories). Off-state is a neutral wash + base
	   border; on-state lifts to `--laurel-glow` fill + accent border
	   + accent text + accent-tinted dot. Light / peach theme
	   overrides below swap the off-state to a darker ink wash. */
	.settings-flow-deck-pill {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border: 1px solid var(--border-base);
		border-radius: var(--r-8);
		background: rgba(242, 236, 220, 0.04);
		color: var(--text-muted);
		font-size: var(--t-13);
		font-weight: 500;
		cursor: pointer;
		text-align: left;
		transition:
			border-color var(--d-hover) var(--ease-vici),
			background-color var(--d-hover) var(--ease-vici),
			color var(--d-hover) var(--ease-vici);
	}

	.settings-flow-deck-pill:hover {
		background: rgba(242, 236, 220, 0.07);
		border-color: var(--border-strong);
		color: var(--text-base);
	}

	:global([data-theme='light']) .settings-flow-deck-pill,
	:global([data-theme='peach']) .settings-flow-deck-pill {
		background: rgba(14, 13, 11, 0.03);
	}

	:global([data-theme='light']) .settings-flow-deck-pill:hover,
	:global([data-theme='peach']) .settings-flow-deck-pill:hover {
		background: rgba(14, 13, 11, 0.06);
	}

	.settings-flow-deck-pill.is-active {
		background: var(--laurel-glow);
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.settings-flow-deck-pill-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--text-muted) 60%, transparent);
		flex-shrink: 0;
		transition: background var(--d-hover) var(--ease-vici);
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
		font-size: var(--t-10);
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

	/* Sign-out as a 12-px rounded rectangle (intentionally NOT a
	   full pill — pairs with the destructive band below). Red text
	   + red-tinted border on top of a subtle ghost-button surface;
	   hover lifts the red wash without flipping to a fully filled
	   destructive button so the action still requires the explicit
	   confirm step beneath it. */
	:global(.settings-signout) {
		width: 100%;
		padding: 14px 20px;
		border: 1px solid rgba(255, 107, 107, 0.25);
		border-radius: 12px;
		background: rgba(242, 236, 220, 0.06);
		color: var(--no);
		font-size: 15px;
		font-weight: 600;
		letter-spacing: -0.005em;
	}

	:global(.settings-signout):hover {
		background: rgba(255, 107, 107, 0.08);
		border-color: rgba(255, 107, 107, 0.45);
	}

	.settings-signout-confirm p {
		font-size: var(--t-13);
		color: var(--text-base);
	}

	/* Delete-account link sits one tier below Sign out in the
	   destructive hierarchy: just a muted-grey underlined text link.
	   The colour only flips to red on hover so the resting state
	   never visually competes with the Sign-out CTA above. */
	.settings-delete-link {
		align-self: center;
		border: none;
		background: none;
		padding: 6px;
		font-size: var(--t-12);
		color: var(--text-muted);
		cursor: pointer;
		text-decoration: underline;
		text-decoration-color: color-mix(in srgb, var(--text-muted) 35%, transparent);
		text-underline-offset: 2px;
	}

	.settings-delete-link:hover {
		color: var(--no);
		text-decoration-color: color-mix(in srgb, var(--no) 55%, transparent);
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

	.settings-toast {
		position: fixed;
		bottom: calc(7.5rem + env(safe-area-inset-bottom, 0px));
		left: 50%;
		z-index: 80;
		padding: 0.625rem 1rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		background: var(--bg-popover);
		color: var(--text-base);
		font-family: var(--font-mono);
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		font-size: var(--t-10);
		box-shadow: 0 12px 32px -12px rgba(0, 0, 0, 0.5);
		transform: translateX(-50%);
		pointer-events: none;
	}
</style>
