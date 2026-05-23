<script lang="ts">
	import type { Doc } from '@junobuild/core';
	import { Check, UserPlus, X } from 'lucide-svelte/icons';
	import { onMount, untrack } from 'svelte';
	import Avatar from '$lib/components/profile/Avatar.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import PrincipalText from '$lib/components/ui/PrincipalText.svelte';
	import {
		acceptFriendRequest,
		cancelFriendRequest,
		rejectFriendRequest,
		sendFriendRequest,
		unfriendUser
	} from '$lib/services/relation.services';
	import {
		friendRequestsStore,
		friendsListStore,
		friendsRelationsLoadedStore,
		refreshFriendRelations,
		sentFriendRequestsStore
	} from '$lib/stores/friends.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import { profilesStore } from '$lib/stores/profiles.store';
	import type { Relation } from '$lib/types/relation';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		userPrincipal: string;
		initialTab?: TabType;
	}

	type TabType = 'active' | 'requests';
	type RequestsSubTab = 'received' | 'sent';

	const { userPrincipal, initialTab = 'active' }: Props = $props();

	let activeTab = $state<TabType>(untrack(() => initialTab));
	let requestsSubTab = $state<RequestsSubTab>('received');

	const activeFriends = $derived($friendsListStore);
	const pendingRequests = $derived($friendRequestsStore);
	const sentRequests = $derived($sentFriendRequestsStore);
	const friendProfiles = $derived($profilesStore);

	// Only show the cold-load spinner when the store has never been
	// populated for this principal. Subsequent visits to the page render
	// the cached relations immediately while a background refresh runs —
	// the standard stale-while-revalidate pattern.
	const loading = $derived(!$friendsRelationsLoadedStore);
	let newFriendPrincipal = $state('');
	let adding = $state(false);
	let processingKey = $state<string | null>(null);
	let confirmingUnfriendId = $state<string | null>(null);
	let unfriendingId = $state<string | null>(null);

	const friendsErrorTitle = $derived(t({ locale: $localeStore, key: 'social.friends.title' }));

	const otherParticipant = (relation: Relation): string | undefined =>
		relation.participants.find((p) => p !== userPrincipal);

	onMount(() => {
		// Fire-and-forget: spinner state is now driven by
		// `friendsRelationsLoadedStore`, so we don't need to gate UI on
		// this promise.
		void refreshFriendRelations();
	});

	const handleAddFriend = async () => {
		const trimmed = newFriendPrincipal.trim();

		if (!trimmed) {
			notificationsStore.add({
				title: friendsErrorTitle,
				message: t({ locale: $localeStore, key: 'friends.add.error.empty' }),
				type: 'warning'
			});

			return;
		}

		adding = true;

		try {
			await sendFriendRequest({ target: trimmed, sender: userPrincipal });
			newFriendPrincipal = '';
			await refreshFriendRelations();
		} catch (err: unknown) {
			console.error(err);
			notificationsStore.add({
				title: friendsErrorTitle,
				message:
					err instanceof Error && err.message
						? err.message
						: t({ locale: $localeStore, key: 'social.friends.error.send_failed' }),
				type: 'error'
			});
		} finally {
			adding = false;
		}
	};

	const handleAccept = async (doc: Doc<Relation>) => {
		processingKey = doc.key;

		try {
			await acceptFriendRequest({ currentRelation: doc });
			await refreshFriendRelations();
		} catch (err: unknown) {
			console.error(err);
			notificationsStore.add({
				title: friendsErrorTitle,
				message:
					err instanceof Error && err.message
						? err.message
						: t({ locale: $localeStore, key: 'social.friends.error.send_failed' }),
				type: 'error'
			});
		} finally {
			processingKey = null;
		}
	};

	const handleReject = async (doc: Doc<Relation>) => {
		processingKey = doc.key;

		try {
			await rejectFriendRequest({ currentRelation: doc });
			await refreshFriendRelations();
		} catch (err: unknown) {
			console.error(err);
			notificationsStore.add({
				title: friendsErrorTitle,
				message:
					err instanceof Error && err.message
						? err.message
						: t({ locale: $localeStore, key: 'social.friends.error.send_failed' }),
				type: 'error'
			});
		} finally {
			processingKey = null;
		}
	};

	// Atomicity is guaranteed satellite-side: the cancel is a
	// version-locked delete of the relation doc, so a race with the
	// recipient's accept/reject between read and write traps with a
	// version mismatch. We surface that error verbatim — refreshing the
	// store afterwards re-syncs the UI with the actual on-chain state
	// (e.g. the relation now appears under "Active" if accept won the
	// race).
	const handleCancel = async (doc: Doc<Relation>) => {
		processingKey = doc.key;

		try {
			await cancelFriendRequest({ currentRelation: doc });
			await refreshFriendRelations();
		} catch (err: unknown) {
			console.error(err);
			notificationsStore.add({
				title: friendsErrorTitle,
				message:
					err instanceof Error && err.message
						? err.message
						: t({ locale: $localeStore, key: 'social.friends.error.cancel_failed' }),
				type: 'error'
			});
			await refreshFriendRelations();
		} finally {
			processingKey = null;
		}
	};

	const handleUnfriend = async (friendId: string) => {
		unfriendingId = friendId;

		try {
			await unfriendUser({ target: friendId, sender: userPrincipal });
			confirmingUnfriendId = null;
			await refreshFriendRelations();
		} catch (err: unknown) {
			console.error(err);
			notificationsStore.add({
				title: friendsErrorTitle,
				message: t({ locale: $localeStore, key: 'social.friends.error.unfriend_failed' }),
				type: 'error'
			});
		} finally {
			unfriendingId = null;
		}
	};
</script>

<div class="friends-card">
	<div class="friends-tabs" role="tablist">
		<button
			class="friends-tab"
			class:is-active={activeTab === 'active'}
			aria-selected={activeTab === 'active'}
			onclick={() => (activeTab = 'active')}
			role="tab"
			type="button"
		>
			{t({
				locale: $localeStore,
				key: 'social.friends.tab.active_count',
				params: { count: activeFriends.length }
			})}
		</button>
		<button
			class="friends-tab"
			class:is-active={activeTab === 'requests'}
			aria-selected={activeTab === 'requests'}
			onclick={() => (activeTab = 'requests')}
			role="tab"
			type="button"
		>
			{t({
				locale: $localeStore,
				key: 'social.friends.tab.requests_count',
				params: { count: pendingRequests.length }
			})}
		</button>
	</div>

	{#if activeTab === 'active'}
		<div class="friends-add">
			<span class="friends-add-icon" aria-hidden="true">
				<UserPlus size={16} strokeWidth={1.8} />
			</span>
			<input
				class="friends-add-input"
				aria-label={t({ locale: $localeStore, key: 'social.friends.add.cta' })}
				disabled={adding}
				onkeydown={(event) => {
					if (event.key === 'Enter') {
						void handleAddFriend();
					}
				}}
				placeholder={t({ locale: $localeStore, key: 'social.friends.add.placeholder' })}
				type="text"
				bind:value={newFriendPrincipal}
			/>
			<Button
				onclick={handleAddFriend}
				size="sm"
				status={adding
					? 'pending'
					: newFriendPrincipal.trim().length === 0
						? 'disabled'
						: 'enabled'}
			>
				{#snippet busyLabel()}{t({
						locale: $localeStore,
						key: 'social.friends.add.sending'
					})}{/snippet}
				{t({ locale: $localeStore, key: 'social.friends.add.cta' })}
			</Button>
		</div>
	{/if}

	<div class="friends-body">
		{#if loading}
			<div class="friends-loading">
				<LoadingSpinner />
			</div>
		{:else if activeTab === 'active'}
			{#if activeFriends.length === 0}
				<p class="friends-empty">
					{t({ locale: $localeStore, key: 'social.friends.empty.active' })}
				</p>
			{:else}
				<ul class="friends-list">
					{#each activeFriends as relation (relation.participants.toSorted().join('#'))}
						{@const friendId = otherParticipant(relation)}
						{@const profile = friendId ? friendProfiles.get(friendId) : undefined}
						{@const isConfirming = friendId !== undefined && confirmingUnfriendId === friendId}

						<li class="friends-row">
							<span class="friends-avatar">
								<Avatar
									class="h-full w-full"
									avatar={profile?.avatar}
									nickname={profile?.nickname ??
										t({ locale: $localeStore, key: 'social.friends.fallback.nickname' })}
									owner={profile?.owner ?? friendId ?? ''}
								/>
							</span>
							<div class="friends-row-copy">
								<span class="friends-row-name">
									@{profile?.nickname ??
										t({ locale: $localeStore, key: 'social.friends.unknown_nickname' })}
								</span>
								<span class="friends-row-meta num">
									{#if friendId}
										<PrincipalText principal={friendId} />
									{/if}
								</span>
							</div>
							{#if !isConfirming}
								<Button
									onclick={() => friendId && (confirmingUnfriendId = friendId)}
									size="sm"
									status={unfriendingId === friendId ? 'pending' : 'enabled'}
									variant="ghost"
								>
									{t({ locale: $localeStore, key: 'social.friends.action.unfriend' })}
								</Button>
							{/if}
						</li>

						{#if isConfirming && friendId}
							<li class="friends-confirm">
								<div class="friends-confirm-copy">
									<p class="friends-confirm-title">
										{t({ locale: $localeStore, key: 'friends.unfriend.confirm.title' })}
									</p>
									<p class="friends-confirm-body">
										{t({ locale: $localeStore, key: 'social.friends.confirm.unfriend' })}
									</p>
								</div>
								<div class="friends-confirm-actions">
									<Button
										onclick={() => (confirmingUnfriendId = null)}
										size="sm"
										status={unfriendingId === friendId ? 'disabled' : 'enabled'}
										variant="ghost"
									>
										{t({ locale: $localeStore, key: 'friends.unfriend.confirm.cancel' })}
									</Button>
									<Button
										onclick={() => handleUnfriend(friendId)}
										size="sm"
										status={unfriendingId === friendId ? 'pending' : 'enabled'}
										variant="danger"
									>
										{t({ locale: $localeStore, key: 'social.friends.action.unfriend' })}
									</Button>
								</div>
							</li>
						{/if}
					{/each}
				</ul>
			{/if}
		{:else if activeTab === 'requests'}
			<div class="friends-subtabs" role="tablist">
				<button
					class="friends-subtab"
					class:is-active={requestsSubTab === 'received'}
					aria-selected={requestsSubTab === 'received'}
					onclick={() => (requestsSubTab = 'received')}
					role="tab"
					type="button"
				>
					{t({
						locale: $localeStore,
						key: 'social.friends.subtab.received_count',
						params: { count: pendingRequests.length }
					})}
				</button>
				<button
					class="friends-subtab"
					class:is-active={requestsSubTab === 'sent'}
					aria-selected={requestsSubTab === 'sent'}
					onclick={() => (requestsSubTab = 'sent')}
					role="tab"
					type="button"
				>
					{t({
						locale: $localeStore,
						key: 'social.friends.subtab.sent_count',
						params: { count: sentRequests.length }
					})}
				</button>
			</div>

			{#if requestsSubTab === 'received'}
				{#if pendingRequests.length === 0}
					<p class="friends-empty">
						{t({ locale: $localeStore, key: 'social.friends.empty.requests' })}
					</p>
				{:else}
					<ul class="friends-list">
						{#each pendingRequests as doc (doc.key)}
							{@const friendId = otherParticipant(doc.data)}
							{@const profile = friendId ? friendProfiles.get(friendId) : undefined}
							{@const isProcessing = processingKey === doc.key}

							<li class="friends-row">
								<span class="friends-avatar">
									<Avatar
										class="h-full w-full"
										avatar={profile?.avatar}
										nickname={profile?.nickname ??
											t({ locale: $localeStore, key: 'social.friends.fallback.nickname' })}
										owner={profile?.owner ?? friendId ?? ''}
									/>
								</span>
								<div class="friends-row-copy">
									<span class="friends-row-name">
										@{profile?.nickname ??
											t({ locale: $localeStore, key: 'social.friends.unknown_nickname' })}
									</span>
									<span class="friends-row-meta num">
										{#if friendId}
											<PrincipalText principal={friendId} />
										{/if}
									</span>
								</div>
								<div class="friends-row-actions">
									<Button
										aria-label={t({ locale: $localeStore, key: 'social.friends.action.reject' })}
										onclick={() => handleReject(doc)}
										size="sm"
										status={isProcessing ? 'pending' : 'enabled'}
										variant="outline"
									>
										<X aria-hidden="true" size={14} strokeWidth={1.8} />
									</Button>
									<Button
										aria-label={t({ locale: $localeStore, key: 'social.friends.action.accept' })}
										onclick={() => handleAccept(doc)}
										size="sm"
										status={isProcessing ? 'pending' : 'enabled'}
									>
										<Check aria-hidden="true" size={14} strokeWidth={1.8} />
									</Button>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			{:else if sentRequests.length === 0}
				<p class="friends-empty">
					{t({ locale: $localeStore, key: 'social.friends.empty.sent' })}
				</p>
			{:else}
				<ul class="friends-list">
					{#each sentRequests as doc (doc.key)}
						{@const friendId = otherParticipant(doc.data)}
						{@const profile = friendId ? friendProfiles.get(friendId) : undefined}
						{@const isProcessing = processingKey === doc.key}

						<li class="friends-row">
							<span class="friends-avatar">
								<Avatar
									class="h-full w-full"
									avatar={profile?.avatar}
									nickname={profile?.nickname ??
										t({ locale: $localeStore, key: 'social.friends.fallback.nickname' })}
									owner={profile?.owner ?? friendId ?? ''}
								/>
							</span>
							<div class="friends-row-copy">
								<span class="friends-row-name">
									@{profile?.nickname ??
										t({ locale: $localeStore, key: 'social.friends.unknown_nickname' })}
								</span>
								<span class="friends-row-meta num">
									{#if friendId}
										<PrincipalText principal={friendId} />
									{/if}
								</span>
							</div>
							<div class="friends-row-actions">
								<span class="friends-pending-badge">
									{t({ locale: $localeStore, key: 'social.friends.pending_badge' })}
								</span>
								<Button
									onclick={() => handleCancel(doc)}
									size="sm"
									status={isProcessing ? 'pending' : 'enabled'}
									variant="outline"
								>
									{t({ locale: $localeStore, key: 'social.friends.action.cancel' })}
								</Button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</div>
</div>

<style lang="postcss">
	.friends-card {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 0.875rem;
		border: 1px solid var(--border-base);
		border-radius: 1.25rem;
		background: var(--bg-popover);
		box-shadow: var(--shadow-card);
	}

	.friends-tabs {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.25rem;
		padding: 0.25rem;
		border: 1px solid var(--border-base);
		border-radius: 0.85rem;
		background: var(--bg-surface);
	}

	.friends-tab {
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

	.friends-tab.is-active {
		background: var(--bg-popover);
		color: var(--text-base);
		box-shadow: var(--shadow-card);
	}

	.friends-subtabs {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.25rem;
		padding: 0.2rem;
		margin-bottom: 0.25rem;
		border: 1px solid var(--border-base);
		border-radius: 0.7rem;
		background: var(--bg-surface);
	}

	.friends-subtab {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.4rem 0.5rem;
		border: 0;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--text-muted);
		font-size: var(--t-12);
		font-weight: 600;
		cursor: pointer;
		transition:
			background-color var(--d-hover) var(--ease-vici),
			color var(--d-hover) var(--ease-vici);
	}

	.friends-subtab.is-active {
		background: var(--bg-popover);
		color: var(--text-base);
		box-shadow: var(--shadow-card);
	}

	.friends-pending-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.15rem 0.5rem;
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--text-muted) 18%, transparent);
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.friends-add {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.45rem 0.45rem 0.45rem 0.75rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		background: var(--bg-surface);
	}

	.friends-add-icon {
		display: inline-flex;
		flex-shrink: 0;
		color: var(--text-muted);
	}

	.friends-add-input {
		flex: 1;
		min-width: 0;
		border: 0;
		background: transparent;
		color: var(--text-base);
		font-size: var(--t-13);
		font-family: var(--font-mono);
		outline: none;
	}

	.friends-add-input::placeholder {
		color: var(--text-muted);
	}

	.friends-body {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-height: 4rem;
	}

	.friends-loading {
		display: flex;
		justify-content: center;
		padding: 1.25rem 0;
	}

	.friends-empty {
		margin: 0;
		padding: 1.5rem 0.5rem;
		color: var(--text-muted);
		font-size: var(--t-13);
		text-align: center;
	}

	.friends-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.friends-row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 0.65rem;
		align-items: center;
		padding: 0.75rem 0.85rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: var(--bg-surface);
	}

	.friends-avatar {
		display: flex;
		overflow: hidden;
		width: 2.25rem;
		height: 2.25rem;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		background: var(--bg-popover);
	}

	.friends-row-copy {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 0.1rem;
	}

	.friends-row-name {
		overflow: hidden;
		color: var(--text-base);
		font-size: var(--t-13);
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.friends-row-meta {
		color: var(--text-muted);
		font-size: var(--t-12);
	}

	.friends-row-actions {
		display: inline-flex;
		gap: 0.4rem;
	}

	.friends-confirm {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.85rem;
		border: 1px solid color-mix(in srgb, var(--color-destructive) 30%, var(--border-base));
		border-radius: var(--r-12);
		background: color-mix(in srgb, var(--color-destructive) 6%, var(--bg-surface));
	}

	.friends-confirm-copy {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.friends-confirm-title {
		margin: 0;
		color: var(--text-base);
		font-size: var(--t-13);
		font-weight: 700;
	}

	.friends-confirm-body {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--t-12);
		line-height: var(--leading-snug);
	}

	.friends-confirm-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}
</style>
