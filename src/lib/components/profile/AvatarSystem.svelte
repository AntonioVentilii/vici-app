<script lang="ts">
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import { upsertProfile } from '$lib/services/profile.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { userStore, type UserStoreData } from '$lib/stores/user.store';
	import type { UserProfile } from '$lib/types/profile';
	import { dicebearAvatarUrl } from '$lib/utils/avatar.utils';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		profile: UserProfile;
	}

	const { profile }: Props = $props();

	interface AvatarOption {
		emoji: string;
		color: string;
	}

	const avatarOptions: AvatarOption[] = [
		{ emoji: '🦊', color: 'bg-primary/10' },
		{ emoji: '🐧', color: 'bg-hold-wash' },
		{ emoji: '🦁', color: 'bg-amber-100' },
		{ emoji: '🐼', color: 'bg-foreground/8' },
		{ emoji: '🦄', color: 'bg-pink-100' },
		{ emoji: '🐲', color: 'bg-success/10' }
	];

	let pending = $state(false);

	/**
	 * Stable per-user + style seed so the same emoji looks different across principals.
	 */
	const avatarSeed = (emoji: string): string => `${profile.owner}|${profile.nickname}|${emoji}`;

	/**
	 * DiceBear encodes the seed in the URL; match that for save + selected state.
	 */
	const avatarUrlForEmoji = (emoji: string): string => dicebearAvatarUrl(avatarSeed(emoji));

	const isSelected = (emoji: string): boolean => profile.avatar === avatarUrlForEmoji(emoji);

	const selectAvatar = async (option: { emoji: string; color: string }) => {
		pending = true;

		try {
			const avatar = avatarUrlForEmoji(option.emoji);
			const updatedProfile: UserProfile = {
				...profile,
				avatar
			};
			await upsertProfile({ key: profile.owner, data: updatedProfile });
			userStore.update((s: UserStoreData) => ({ ...s, profile: updatedProfile }));
		} catch (e) {
			console.error('Failed to save avatar', e);
		} finally {
			pending = false;
		}
	};
</script>

<div class="space-y-6">
	<h3 class="text-muted-foreground text-sm font-bold tracking-widest uppercase">
		{t({ locale: $localeStore, key: 'profile.avatar_style' })}
	</h3>

	<div class="grid grid-cols-3 gap-4 sm:grid-cols-6">
		{#each avatarOptions as option (option.emoji)}
			<BaseButton
				class="group relative flex aspect-square items-center justify-center rounded-2xl {option.color} focus:ring-primary/20 transition-all hover:scale-110 hover:shadow-lg focus:ring-4"
				onclick={() => selectAvatar(option)}
				status={pending ? 'pending' : 'enabled'}
			>
				<span class="text-4xl transition-transform group-hover:rotate-12">{option.emoji}</span>
				{#if isSelected(option.emoji)}
					<div
						class="bg-primary text-primary-foreground ring-card absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-[10px] shadow-sm ring-2"
					>
						✓
					</div>
				{/if}
			</BaseButton>
		{/each}
	</div>
</div>
