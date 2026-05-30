<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import { PENDING_ONBOARDING_STORAGE_KEY } from '$lib/constants/profile.constants';
	import { AppPath, PublicPath } from '$lib/constants/routes.constants';
	import { authBusy, userSignedIn } from '$lib/derived/user.derived';
	import { joinLeagueByInvite, lookupLeagueByInvite } from '$lib/services/leagues.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import { userStore } from '$lib/stores/user.store';
	import { LEAGUE_INVITE_CODE_REGEX } from '$lib/types/league';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * League-invite landing page — the single canonical URL the "Invite"
	 * buttons copy (`{origin}/league/{code}`). Mirrors the `/i/[code]`
	 * referral landing. The `[code]` slug is a 6-char `[A-Z0-9]` invite
	 * code enforced by `LEAGUE_INVITE_CODE_REGEX`. Branches on auth state:
	 *
	 *   1. **Invalid code shape** — toast + bail to the leagues list.
	 *   2. **Signed-out (or mid-onboarding)** — stash the code into the
	 *      `vici:pending-onboarding` payload and route to `/signup`. The
	 *      (app) layout's pending-onboarding drain then auto-joins the
	 *      league once the new account is in place.
	 *   3. **Signed-in & onboarded** — resolve the league, join it (or
	 *      route straight in if already a member), then land on the
	 *      league detail page.
	 */

	let resolved = false;

	const rawCode = $derived(page.params.code ?? '');
	const normalizedCode = $derived(rawCode.toUpperCase().trim());
	const onboardingCompleted = $derived(
		$userStore.profile?.preferences?.onboardingCompleted === true
	);

	const leaguesListPath = `${resolve(AppPath.Arena)}/leagues`;

	onMount(() => {
		document.title = 'Join league · VICI';
	});

	$effect(() => {
		if (!browser) {
			return;
		}

		// Wait for the auth handshake before deciding what to do — reacting
		// too early would always read `userSignedIn=false`.
		if ($authBusy) {
			return;
		}

		// One-shot — we navigate away in every branch, and the `onMount`
		// mutation guard would otherwise re-fire on the post-nav re-render.
		if (untrack(() => resolved)) {
			return;
		}

		untrack(() => {
			resolved = true;
		});

		void handleInvite();
	});

	const stashCodeForSignup = () => {
		try {
			const raw = localStorage.getItem(PENDING_ONBOARDING_STORAGE_KEY);
			const parsed: Record<string, unknown> =
				raw !== null && typeof raw === 'string'
					? ((): Record<string, unknown> => {
							try {
								const v = JSON.parse(raw);

								return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
							} catch {
								return {};
							}
						})()
					: {};
			parsed.leagueInvite = normalizedCode;
			localStorage.setItem(PENDING_ONBOARDING_STORAGE_KEY, JSON.stringify(parsed));
		} catch {
			// Best-effort: signup still works without the stashed invite —
			// the user can join manually with the code afterwards.
		}
	};

	const goLeaguesList = () => {
		void goto(leaguesListPath, { replaceState: true });
	};

	const handleInvite = async () => {
		if (!LEAGUE_INVITE_CODE_REGEX.test(normalizedCode)) {
			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'league_invite.invalid_title' }),
				message: t({ locale: $localeStore, key: 'league_invite.invalid_body' }),
				type: 'error',
				duration: 4000
			});
			goLeaguesList();

			return;
		}

		// Signed-out OR signed-in but mid-onboarding → stash + route to signup.
		// The (app) layout drain redeems the invite once the profile exists.
		if (!$userSignedIn || !onboardingCompleted) {
			stashCodeForSignup();
			void goto(resolve(PublicPath.SignUp), { replaceState: true });

			return;
		}

		// Existing signed-in user — resolve the league first so we can route
		// the user in and name the league in the toast, regardless of the
		// join outcome.
		try {
			const league = await lookupLeagueByInvite({ inviteCode: normalizedCode });

			if (!league) {
				notificationsStore.add({
					title: t({ locale: $localeStore, key: 'league_invite.unknown_title' }),
					message: t({ locale: $localeStore, key: 'league_invite.unknown_body' }),
					type: 'error',
					duration: 4000
				});
				goLeaguesList();

				return;
			}

			try {
				await joinLeagueByInvite({ inviteCode: normalizedCode });

				notificationsStore.add({
					title: t({
						locale: $localeStore,
						key: 'league_invite.joined_title',
						params: { name: league.name }
					}),
					message: t({ locale: $localeStore, key: 'league_invite.joined_body' }),
					type: 'success',
					duration: 3500
				});
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : '';

				// Already a member is a no-op success — fall through and route in.
				if (message !== 'Already a member of this league.') {
					console.error('League invite join failed', err);
					notificationsStore.add({
						title: t({ locale: $localeStore, key: 'league_invite.error_title' }),
						message: t({ locale: $localeStore, key: 'league_invite.error_body' }),
						type: 'error',
						duration: 4000
					});
					goLeaguesList();

					return;
				}
			}

			void goto(`${leaguesListPath}/${league.id}`, { replaceState: true });
		} catch (err: unknown) {
			console.error('League invite resolve failed', err);
			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'league_invite.error_title' }),
				message: t({ locale: $localeStore, key: 'league_invite.error_body' }),
				type: 'error',
				duration: 4000
			});
			goLeaguesList();
		}
	};
</script>

<div
	class="flex min-h-screen w-full flex-col items-center justify-center p-6"
	aria-live="polite"
	role="status"
>
	<LoadingSpinner size="md" />
	<p class="text-muted-foreground mt-4 text-sm">
		{t({ locale: $localeStore, key: 'league_invite.resolving' })}
	</p>
</div>
