<script lang="ts">
	import type { Icon as LucideIcon } from 'lucide-svelte';
	import {
		ArrowLeft,
		Check,
		Flame,
		Sparkles,
		Swords,
		Target,
		TrendingUp,
		Users
	} from 'lucide-svelte/icons';
	import { goto } from '$app/navigation';
	import Button from '$lib/components/ui/Button.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { inboxStore, markAllInboxRead } from '$lib/stores/inbox.store';
	import { localeStore } from '$lib/stores/locale.store';
	import type { InboxNotificationKind } from '$lib/types/inbox';
	import { t } from '$lib/utils/i18n.utils';

	const kindIcons: Record<InboxNotificationKind, typeof LucideIcon> = {
		resolve: Check,
		streak: Flame,
		social: Users,
		challenge: Swords,
		level: Sparkles,
		market: Target
	};
</script>

<div class="notifications-page">
	<header class="notifications-appbar">
		<button
			class="notifications-back"
			aria-label="Back to settings"
			onclick={() => goto(AppPath.Settings)}
			type="button"
		>
			<ArrowLeft size={18} strokeWidth={1.8} />
		</button>
		<h1 class="notifications-title">{t({ locale: $localeStore, key: 'notifications.title' })}</h1>
		<Button onclick={markAllInboxRead} size="sm" variant="ghost">Mark read</Button>
	</header>

	<ul class="notifications-list">
		{#each $inboxStore as notification (notification.id)}
			{@const KindIcon = kindIcons[notification.kind] ?? TrendingUp}
			<li class="notification-card" class:is-unread={notification.unread}>
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
			</li>
		{/each}
	</ul>
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
		padding: 0.5rem 0 1rem;
	}

	.notifications-back {
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

	.notifications-title {
		margin: 0;
		font-size: var(--t-18);
		font-weight: 600;
		text-align: center;
	}

	.notifications-list {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.notification-card {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 0.625rem;
		align-items: flex-start;
		padding: 0.875rem;
		border-radius: var(--r-12);
		border: 1px solid var(--border-base);
		background: var(--bg-raised);
	}

	.notification-card.is-unread {
		border-color: color-mix(in srgb, var(--laurel) 30%, var(--border-base));
		background: color-mix(in srgb, var(--laurel) 4%, var(--bg-raised));
	}

	.notification-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: var(--r-8);
		background: var(--ink-line);
		color: var(--laurel);
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
		color: var(--parchment);
	}

	.notification-body {
		margin: 0;
		font-size: var(--t-12);
		color: var(--parchment-mute);
	}

	.notification-when {
		margin-top: 0.125rem;
		font-size: var(--t-11);
		color: var(--parchment-faint);
	}

	.notification-dot {
		width: 0.375rem;
		height: 0.375rem;
		margin-top: 0.375rem;
		border-radius: 50%;
		background: var(--laurel);
	}
</style>
