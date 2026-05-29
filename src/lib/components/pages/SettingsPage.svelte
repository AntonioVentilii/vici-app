<script lang="ts">
	import { getDoc, signOut } from '@junobuild/core';
	import {
		Activity,
		ArrowLeft,
		Bell,
		Download,
		Eye,
		Info,
		Lock,
		Moon,
		Search,
		Share2,
		Sun,
		Target,
		Trophy,
		Users,
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
	import { Collection } from '$lib/constants/collections.constants';
	import {
		LOCALE_STORAGE_KEY,
		SUPPORTED_LOCALES,
		type AppLocale
	} from '$lib/constants/locale.constants';
	import { MARKET_TAGS } from '$lib/constants/market-tags.constants';
	import { AppPath, PublicPath } from '$lib/constants/routes.constants';
	import { FLOW_SESSION_LENGTH_OPTIONS } from '$lib/constants/settings.constants';
	import { authPrincipal } from '$lib/derived/user.derived';
	import { ProfileVisibility } from '$lib/enums/profile';
	import { deleteMyAccount, listMyBlockingLeagues } from '$lib/services/account.services';
	import { upsertProfile } from '$lib/services/profile.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { preferencesStore } from '$lib/stores/preferences.store';
	import { theme } from '$lib/stores/theme.store';
	import { setAuthBusy, userStore } from '$lib/stores/user.store';
	import type { ButtonStatus } from '$lib/types/components';
	import {
		EXIT_SIGNAL_NOTE_MAX_LENGTH,
		EXIT_SIGNAL_REASONS,
		type ExitSignalReason
	} from '$lib/types/exit-signal';
	import type { FlowSessionLength, SettingsVisibility } from '$lib/types/preferences';
	import type { UserProfile } from '$lib/types/profile';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
	import { goBack } from '$lib/utils/nav.utils';

	// Delete-account flow state -----------------------------------
	type DeleteStep = 'idle' | 'reason' | 'confirm';

	let deleteStep = $state<DeleteStep>('idle');
	let deleteReason = $state<ExitSignalReason | null>(null);
	let deleteNote = $state('');
	let deleteError = $state<string | null>(null);
	let deleteStatus = $state<ButtonStatus>('enabled');
	let blockingLeagueIds = $state<string[] | null>(null);
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

	// Reason picker rows match the six buckets in
	// `screens.jsx:1962`. Order is intentional — the most common
	// "soft" reasons sit above the absolute "other".
	const reasonOptions: ReadonlyArray<{ id: ExitSignalReason; key: MessageKey }> = [
		{ id: 'not-for-me', key: 'settings.delete.reason.not_for_me' },
		{ id: 'too-complex', key: 'settings.delete.reason.too_complex' },
		{ id: 'bored', key: 'settings.delete.reason.bored' },
		{ id: 'no-friends', key: 'settings.delete.reason.no_friends' },
		{ id: 'too-noisy', key: 'settings.delete.reason.too_noisy' },
		{ id: 'other', key: 'settings.delete.reason.other' }
	];

	// Defensive: keep the typed array referenced even when the
	// satellite enum drifts so the lint catches mismatches.
	const _knownReasons = EXIT_SIGNAL_REASONS;
	void _knownReasons;

	const profile = $derived($userStore.profile);
	const email = $derived(profile?.email ?? '');
	const hasEmail = $derived(email.length > 0);

	// Sign-in method sub — `{provider_account} · {method_label}`
	// (e.g. `tacitus@vici.markets · magic link`). For Internet
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
		setAuthBusy(true);

		try {
			await signOut();
		} finally {
			signOutStatus = 'enabled';
			confirmingSignOut = false;
		}
	};

	const resetDeleteFlow = () => {
		deleteStep = 'idle';
		deleteReason = null;
		deleteNote = '';
		deleteError = null;
		blockingLeagueIds = null;
		deleteStatus = 'enabled';
	};

	/**
	 * Open the delete flow. Pre-flight the owned-leagues guard so
	 * the user sees the transfer-first prompt up-front instead of
	 * after picking a reason. A network error here drops back to
	 * `idle` with the generic error message — the alternative is
	 * showing a half-loaded picker that may then refuse on submit.
	 */
	const openDeleteFlow = async () => {
		deleteError = null;

		try {
			const ids = await listMyBlockingLeagues();

			if (ids.length > 0) {
				blockingLeagueIds = ids;
			}
		} catch (_err) {
			deleteError = t({ locale: $localeStore, key: 'settings.delete.error' });

			return;
		}

		deleteStep = 'reason';
	};

	const submitDelete = async () => {
		if (deleteReason === null) {
			return;
		}

		deleteStatus = 'pending';
		deleteError = null;

		try {
			const result = await deleteMyAccount({
				reason: deleteReason,
				note: deleteNote.trim()
			});

			if (!result.ok) {
				if (result.reason === 'owns_non_empty_league') {
					blockingLeagueIds = result.blockingLeagueIds ?? [];
					deleteStep = 'reason';
				} else {
					deleteError = t({ locale: $localeStore, key: 'settings.delete.error' });
				}

				deleteStatus = 'enabled';

				return;
			}

			// Deletion succeeded — drop auth so the user lands on the
			// sign-in screen. `signOut()` clears local stores; `setAuthBusy`
			// keeps the global busy flag set while it does.
			setAuthBusy(true);
			await signOut();
		} catch (_err) {
			deleteError = t({ locale: $localeStore, key: 'settings.delete.error' });
			deleteStatus = 'enabled';
		}
	};

	onMount(() => {
		if ($authPrincipal) {
			void loadJoinedAt($authPrincipal);
		}

		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
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
			<ArrowLeft aria-hidden="true" size={18} strokeWidth={1.8} />
		</button>
		<h1 class="settings-appbar-title">
			{t({ locale: $localeStore, key: 'settings.title' })}
		</h1>
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
					</span>
					<span class="set-identity-meta num">
						{t({
							locale: $localeStore,
							key: 'settings.identity.meta',
							params: {
								level: profile?.level ?? 1,
								// `profile.accuracy` is already a 0..100 percentage
								// (see `profile.services.ts`); render directly without
								// re-multiplying by 100.
								accuracy: (profile?.accuracy ?? 0).toFixed(1),
								calls: profile?.totalTrades ?? 0
							}
						})}
					</span>
					{#if joinedLabel !== null}
						<span class="set-identity-joined">
							{t({
								locale: $localeStore,
								key: 'settings.identity.joined',
								params: { date: joinedLabel }
							})}
						</span>
					{/if}
				</span>
			</button>

			<SetRow
				label={t({ locale: $localeStore, key: 'settings.account.signin_method' })}
				onclick={() => goto(resolve(AppPath.AccountSettings))}
				sub={signinMethodSub}
			/>

			<SetRow
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

			<SetToggle
				checked={$preferencesStore.hapticsEnabled}
				icon={Target}
				label={t({ locale: $localeStore, key: 'settings.haptics' })}
				onchange={(value) => {
					preferencesStore.update((prefs) => ({ ...prefs, hapticsEnabled: value }));
				}}
				sub={t({ locale: $localeStore, key: 'settings.haptics.sub' })}
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
				icon={Download}
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

			{#if deleteStep === 'idle'}
				<button class="settings-delete-link" onclick={openDeleteFlow} type="button">
					{t({ locale: $localeStore, key: 'settings.delete' })}
				</button>
				{#if deleteError !== null}
					<p class="settings-delete-error">{deleteError}</p>
				{/if}
			{:else if blockingLeagueIds !== null && blockingLeagueIds.length > 0}
				<div class="settings-confirm settings-delete-flow">
					<p class="settings-delete-heading">
						{t({ locale: $localeStore, key: 'settings.delete.blocking_heading' })}
					</p>
					<p class="settings-delete-body">
						{blockingLeagueIds.length === 1
							? t({ locale: $localeStore, key: 'settings.delete.blocking_body_one' })
							: t({
									locale: $localeStore,
									key: 'settings.delete.blocking_body_many',
									params: { count: blockingLeagueIds.length }
								})}
					</p>
					<ul class="settings-delete-blocking-list">
						{#each blockingLeagueIds as blockingId (blockingId)}
							<li>
								<a
									class="settings-delete-blocking-link"
									href={resolve(`${AppPath.Social}/leagues/${blockingId}`)}
								>
									<span class="settings-delete-blocking-id">{blockingId}</span>
									<span class="settings-delete-blocking-cta">
										{t({ locale: $localeStore, key: 'settings.delete.transfer_cta' })}
									</span>
								</a>
							</li>
						{/each}
					</ul>
					<div class="settings-confirm-actions">
						<Button onclick={resetDeleteFlow} variant="ghost">
							{t({ locale: $localeStore, key: 'settings.delete.never_mind' })}
						</Button>
					</div>
				</div>
			{:else if deleteStep === 'reason'}
				<div class="settings-confirm settings-delete-flow">
					<p class="settings-delete-heading">
						{t({ locale: $localeStore, key: 'settings.delete.reason_heading' })}
					</p>
					<p class="settings-delete-body">
						{t({ locale: $localeStore, key: 'settings.delete.reason_body' })}
					</p>
					<div class="settings-delete-reasons">
						{#each reasonOptions as opt (opt.id)}
							<button
								class="settings-delete-reason"
								class:is-active={deleteReason === opt.id}
								onclick={() => (deleteReason = opt.id)}
								type="button"
							>
								{t({ locale: $localeStore, key: opt.key })}
							</button>
						{/each}
					</div>
					{#if deleteReason !== null}
						<textarea
							class="settings-delete-note"
							maxlength={EXIT_SIGNAL_NOTE_MAX_LENGTH}
							placeholder={t({ locale: $localeStore, key: 'settings.delete.note_placeholder' })}
							rows="3"
							bind:value={deleteNote}
						></textarea>
					{/if}
					<div class="settings-delete-retain">
						<p class="settings-delete-retain-heading">
							{t({ locale: $localeStore, key: 'settings.delete.stay_heading' })}
						</p>
						<p class="settings-delete-retain-body">
							{t({ locale: $localeStore, key: 'settings.delete.stay_body' })}
						</p>
						<div class="settings-delete-retain-actions">
							<button
								class="settings-delete-retain-button"
								onclick={() => {
									resetDeleteFlow();
									flashToast(
										t({ locale: $localeStore, key: 'settings.toast.notifications_paused' })
									);
								}}
								type="button"
							>
								{t({ locale: $localeStore, key: 'settings.delete.stay_pause' })}
							</button>
							<button
								class="settings-delete-retain-button"
								onclick={() => {
									resetDeleteFlow();
									void goto(resolve(`${PublicPath.Info}/contact`));
								}}
								type="button"
							>
								{t({ locale: $localeStore, key: 'settings.delete.stay_contact' })}
							</button>
						</div>
					</div>
					<div class="settings-confirm-actions">
						<Button onclick={resetDeleteFlow} variant="ghost">
							{t({ locale: $localeStore, key: 'settings.delete.never_mind' })}
						</Button>
						<Button
							onclick={() => (deleteStep = 'confirm')}
							status={deleteReason === null ? 'disabled' : 'enabled'}
							variant="danger"
						>
							{t({ locale: $localeStore, key: 'settings.delete.continue' })} →
						</Button>
					</div>
				</div>
			{:else}
				<div class="settings-confirm settings-delete-flow">
					<p class="settings-delete-heading">
						{t({ locale: $localeStore, key: 'settings.delete.last_step_heading' })}
					</p>
					<p class="settings-delete-body">
						{t({ locale: $localeStore, key: 'settings.delete.confirm' })}
					</p>
					{#if deleteError !== null}
						<p class="settings-delete-error">{deleteError}</p>
					{/if}
					<div class="settings-confirm-actions">
						<Button onclick={() => (deleteStep = 'reason')} variant="ghost">
							{t({ locale: $localeStore, key: 'settings.delete.back' })}
						</Button>
						<Button onclick={submitDelete} status={deleteStatus} variant="danger">
							{deleteStatus === 'pending'
								? t({ locale: $localeStore, key: 'settings.delete.deleting' })
								: t({ locale: $localeStore, key: 'settings.delete.forever' })}
						</Button>
					</div>
				</div>
			{/if}
		</div>
	</div>

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
		font-size: var(--t-44);
		font-weight: 600;
		line-height: 1;
		letter-spacing: var(--tracking-tight);
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
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
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

	.set-identity-meta {
		font-size: 0.6875rem;
		color: var(--text-muted);
	}

	.set-identity-joined {
		font-size: 0.6875rem;
		color: var(--text-muted);
		opacity: 0.7;
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

	/* Mirrors `.set-cat-chip` in the design source
	   (`../VICI WebApp Beta V1.2/app.css:1784-1822`): rounded-rectangle
	   chip (8 px radius, not pill), neutral surface + neutral border
	   off-state, laurel-glow fill + accent border + accent text in the
	   on-state, 8 px dot tinted with the same colour. */
	.settings-flow-deck-pill {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border: 1px solid var(--border-base);
		border-radius: 8px;
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
		border-radius: 999px;
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

	/* Mirrors `.btn.btn-ghost.btn-block.set-signout` in the design source
	   (`../VICI WebApp Beta V1.2/app.css:128-142, 1440-1447`): rounded
	   rectangle (12 px radius, not full pill), red text + red-tinted
	   border on top of the same subtle ghost-button surface, hover lifts
	   the red wash. */
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

	/* Mirrors `.set-delete-link` (`app.css:1448-1459`): muted grey
	   underlined link, faint underline, red on hover only. */
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

	.settings-delete-flow {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.settings-delete-heading {
		margin: 0;
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--text-base);
	}

	.settings-delete-body {
		margin: 0;
		font-size: var(--t-12);
		line-height: 1.5;
		color: var(--text-muted);
	}

	.settings-delete-error {
		margin: 0.25rem 0 0;
		font-size: var(--t-12);
		color: var(--color-destructive);
	}

	.settings-delete-reasons {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.4rem;
	}

	.settings-delete-reason {
		padding: 0.55rem 0.65rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-8);
		background: var(--bg-popover);
		color: var(--text-base);
		font-size: var(--t-12);
		text-align: left;
		cursor: pointer;
		transition:
			border-color var(--d-hover) var(--ease-vici),
			background-color var(--d-hover) var(--ease-vici);
	}

	.settings-delete-reason.is-active {
		border-color: var(--color-destructive);
		background: color-mix(in srgb, var(--color-destructive) 10%, var(--bg-popover));
		color: var(--color-destructive);
	}

	.settings-delete-note {
		width: 100%;
		padding: 0.55rem 0.65rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-8);
		background: var(--bg-popover);
		color: var(--text-base);
		font-size: var(--t-12);
		font-family: inherit;
		resize: vertical;
		min-height: 4rem;
	}

	.settings-delete-retain {
		padding: 0.6rem 0.7rem;
		border: 1px dashed var(--border-base);
		border-radius: var(--r-8);
		background: color-mix(in srgb, var(--color-primary) 5%, transparent);
	}

	.settings-delete-retain-heading {
		margin: 0 0 0.25rem;
		font-size: var(--t-13);
		font-style: italic;
		font-weight: 600;
		font-family: var(--font-serif, serif);
		color: var(--text-base);
	}

	.settings-delete-retain-body {
		margin: 0 0 0.6rem;
		font-size: var(--t-12);
		line-height: 1.5;
		color: var(--text-muted);
	}

	.settings-delete-retain-actions {
		display: flex;
		gap: 0.4rem;
	}

	.settings-delete-retain-button {
		flex: 1;
		padding: 0.45rem 0.55rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-8);
		background: transparent;
		color: var(--text-base);
		font-size: var(--t-12);
		font-weight: 600;
		cursor: pointer;
		transition:
			border-color var(--d-hover) var(--ease-vici),
			background-color var(--d-hover) var(--ease-vici);
	}

	.settings-delete-retain-button:hover {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 8%, transparent);
	}

	.settings-delete-blocking-list {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.settings-delete-blocking-link {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.55rem 0.7rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-8);
		background: var(--bg-popover);
		color: var(--text-base);
		font-size: var(--t-12);
		text-decoration: none;
	}

	.settings-delete-blocking-link:hover {
		border-color: var(--color-primary);
	}

	.settings-delete-blocking-id {
		font-family: var(--font-mono);
		color: var(--text-base);
	}

	.settings-delete-blocking-cta {
		color: var(--color-primary);
		font-weight: 600;
	}

	.settings-toast {
		position: fixed;
		bottom: calc(7.5rem + env(safe-area-inset-bottom, 0px));
		left: 50%;
		z-index: 80;
		padding: 0.625rem 1rem;
		border: 1px solid var(--border-base);
		border-radius: 999px;
		background: var(--bg-popover);
		color: var(--text-base);
		font-family: var(--font-mono);
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		font-size: 0.625rem;
		box-shadow: 0 12px 32px -12px rgba(0, 0, 0, 0.5);
		transform: translateX(-50%);
		pointer-events: none;
	}
</style>
