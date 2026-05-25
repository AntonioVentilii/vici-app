<script lang="ts">
	import { ArrowLeft } from 'lucide-svelte/icons';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ReferralCard from '$lib/components/profile/ReferralCard.svelte';
	import FriendsList from '$lib/components/social/FriendsList.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { authPrincipal } from '$lib/derived/user.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { userStore } from '$lib/stores/user.store';
	import { t } from '$lib/utils/i18n.utils';

	type FriendsTab = 'active' | 'requests';

	interface Props {
		// When true, hide the page's own appbar — the container is
		// expected to render one (e.g. the tabbed Social parent).
		embedded?: boolean;
	}

	const { embedded = false }: Props = $props();

	const tabParam = $derived(page.url.searchParams.get('tab'));
	const initialTab: FriendsTab = $derived(tabParam === 'requests' ? tabParam : 'active');
</script>

<div class="friends-page" class:is-embedded={embedded}>
	{#if !embedded}
		<header class="friends-appbar">
			<button
				class="friends-back"
				aria-label={t({ locale: $localeStore, key: 'friends.back_profile' })}
				onclick={() => goto(resolve(AppPath.Profile))}
				type="button"
			>
				<ArrowLeft aria-hidden="true" size={18} strokeWidth={1.8} />
			</button>
			<h1 class="friends-title">{t({ locale: $localeStore, key: 'social.friends.title' })}</h1>
			<span class="friends-appbar-spacer" aria-hidden="true"></span>
		</header>
	{/if}

	<div class="friends-body">
		<!-- prototype FriendsScreen leads with the invite hero so the
		     friends ↔ invite loop is immediately discoverable. We reuse
		     the same ReferralCard that already lives on the profile
		     dashboard so the invite copy / referral counter / share
		     affordance stay in lockstep across both surfaces. -->
		{#if $userStore.profile}
			<ReferralCard profile={$userStore.profile} />
		{/if}

		{#if $authPrincipal}
			<FriendsList {initialTab} userPrincipal={$authPrincipal} />
		{/if}
	</div>
</div>

<style lang="postcss">
	.friends-page {
		max-width: 40rem;
		margin: 0 auto;
		padding-bottom: 5rem;
	}

	.friends-appbar {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0 1rem;
	}

	.friends-back {
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

	.friends-title {
		margin: 0;
		font-size: var(--t-18);
		font-weight: 600;
		text-align: center;
		color: var(--text-base);
	}

	.friends-appbar-spacer {
		width: 2.125rem;
	}

	.friends-body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
</style>
