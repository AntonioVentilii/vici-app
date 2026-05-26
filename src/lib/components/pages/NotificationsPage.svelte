<script lang="ts">
	import type { Icon as LucideIcon } from 'lucide-svelte';
	import {
		ArrowLeft,
		Bell,
		Check,
		Flame,
		Sparkles,
		Swords,
		Target,
		TrendingUp,
		UserPlus,
		Users
	} from 'lucide-svelte/icons';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { refreshFriendRelations } from '$lib/stores/friends.store';
	import { combinedInboxStore, markAllInboxRead } from '$lib/stores/inbox.store';
	import { localeStore } from '$lib/stores/locale.store';
	import type { InboxNotificationKind } from '$lib/types/inbox';
	import { t } from '$lib/utils/i18n.utils';

	const kindIcons: Record<InboxNotificationKind, typeof LucideIcon> = {
		resolve: Check,
		streak: Flame,
		social: Users,
		challenge: Swords,
		level: Sparkles,
		market: Target,
		friend_request: UserPlus
	};

	onMount(() => {
		void refreshFriendRelations();
	});
</script>

<div class="notifications-page">
	<header class="notifications-appbar">
		<button
			class="notifications-back"
			aria-label={t({ locale: $localeStore, key: 'notifications.back_settings' })}
			onclick={() => goto(resolve(AppPath.Settings))}
			type="button"
		>
			<ArrowLeft aria-hidden="true" size={18} strokeWidth={1.8} />
		</button>
		<h1 class="notifications-title">{t({ locale: $localeStore, key: 'notifications.title' })}</h1>
		<Button onclick={markAllInboxRead} size="sm" variant="ghost">
			{t({ locale: $localeStore, key: 'notifications.mark_read' })}
		</Button>
	</header>

	{#if $combinedInboxStore.length === 0}
		<!-- Polished empty state — dashed surface with serif-italic
		     headline. The bell icon is faint by design (no foreground
		     attention since there's no event to draw the eye). -->
		<div class="notifications-empty" aria-live="polite" role="status">
			<Bell class="notifications-empty-icon" aria-hidden="true" size={28} strokeWidth={1.4} />
			<p class="notifications-empty-title serif-italic">
				{t({ locale: $localeStore, key: 'notifications.empty.title' })}
			</p>
			<p class="notifications-empty-body">
				{t({ locale: $localeStore, key: 'notifications.empty.body' })}
			</p>
		</div>
	{:else}
		<ul class="notifications-list">
			{#each $combinedInboxStore as notification (notification.id)}
				{@const KindIcon = kindIcons[notification.kind] ?? TrendingUp}
				<li class="notification-item" class:is-unread={notification.unread}>
					{#if notification.href}
						<a class="notification-card notification-card-link" href={notification.href}>
							<span class="notification-icon" aria-hidden="true">
								<KindIcon size={16} strokeWidth={1.8} />
							</span>
							<div class="notification-copy">
								<span class="notification-title">{notification.title}</span>
								<p class="notification-body">{notification.body}</p>
								<span class="notification-when num">{notification.when}</span>
							</div>
							{#if notification.unread}
								<span class="notification-dot" aria-hidden="true"></span>
							{/if}
						</a>
					{:else}
						<div class="notification-card">
							<span class="notification-icon" aria-hidden="true">
								<KindIcon size={16} strokeWidth={1.8} />
							</span>
							<div class="notification-copy">
								<span class="notification-title">{notification.title}</span>
								<p class="notification-body">{notification.body}</p>
								<span class="notification-when num">{notification.when}</span>
							</div>
							{#if notification.unread}
								<span class="notification-dot" aria-hidden="true"></span>
							{/if}
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style lang="postcss">
	.notifications-page {
		max-width: 40rem;
		margin: 0 auto;
		padding-bottom: 5rem;
	}

	.notifications-appbar {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0 1rem;
	}

	.notifications-back {
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

	.notifications-title {
		margin: 0;
		font-size: var(--t-18);
		font-weight: 600;
		text-align: center;
		color: var(--text-base);
	}

	.notifications-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.notification-item {
		display: block;
	}

	.notification-card {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 0.625rem;
		align-items: flex-start;
		padding: 0.875rem;
		border-radius: var(--r-12);
		border: 1px solid var(--border-base);
		background: var(--bg-surface);
		box-shadow: var(--shadow-card);
		color: var(--text-base);
		text-decoration: none;
	}

	.notification-card-link {
		cursor: pointer;
		transition:
			background-color var(--d-hover) var(--ease-vici),
			border-color var(--d-hover) var(--ease-vici);
	}

	.notification-card-link:hover {
		border-color: var(--border-strong);
		background: color-mix(in srgb, var(--color-primary) 4%, var(--bg-surface));
	}

	.notification-item.is-unread .notification-card {
		border-color: color-mix(in srgb, var(--color-primary) 30%, var(--border-base));
		background: color-mix(in srgb, var(--color-primary) 4%, var(--bg-surface));
	}

	.notification-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: var(--r-8);
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
		color: var(--color-primary);
	}

	.notification-copy {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}

	.notification-title {
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--text-base);
	}

	.notification-body {
		margin: 0;
		font-size: var(--t-12);
		color: var(--text-muted);
	}

	.notification-when {
		margin-top: 0.125rem;
		font-size: 0.6875rem;
		color: var(--text-muted);
	}

	.notification-dot {
		width: 0.375rem;
		height: 0.375rem;
		margin-top: 0.375rem;
		border-radius: 50%;
		background: var(--color-primary);
	}

	.notifications-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 2.5rem 1.5rem;
		border: 1px dashed var(--border-base);
		border-radius: var(--r-12);
		background: transparent;
		text-align: center;
	}

	.notifications-empty :global(.notifications-empty-icon) {
		color: var(--parchment-faint);
		margin-bottom: 0.25rem;
	}

	.notifications-empty-title {
		margin: 0;
		font-size: var(--t-18);
		color: var(--text-base);
	}

	.notifications-empty-body {
		margin: 0;
		max-width: 24rem;
		font-size: var(--t-13);
		line-height: 1.55;
		color: var(--text-muted);
	}
</style>
