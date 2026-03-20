<script lang="ts">
	import { upsertProfile } from '$lib/services/profile.services';
	import { userStore, type UserStoreData } from '$lib/stores/user.store';
	import type { UserProfile } from '$lib/types/profile';

	interface Props {
		profile: UserProfile;
	}

	const { profile }: Props = $props();

	interface AvatarOption {
		emoji: string;
		color: string;
	}

	const avatarOptions: AvatarOption[] = [
		{ emoji: '🦊', color: 'bg-orange-100' },
		{ emoji: '🐧', color: 'bg-blue-100' },
		{ emoji: '🦁', color: 'bg-amber-100' },
		{ emoji: '🐼', color: 'bg-slate-100' },
		{ emoji: '🦄', color: 'bg-pink-100' },
		{ emoji: '🐲', color: 'bg-emerald-100' }
	];

	let pending = $state(false);

	const selectAvatar = async (option: { emoji: string; color: string }) => {
		pending = true;
		try {
			// Mocking avatar URL as an emoji for now, or we could generate an image
			const updatedProfile = {
				...profile,
				avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${option.emoji}`
			};
			await upsertProfile({ key: profile.owner, data: updatedProfile });
			// Update local store
			userStore.update((s: UserStoreData) => ({ ...s, profile: updatedProfile }));
		} finally {
			pending = false;
		}
	};
</script>

<div class="space-y-6">
	<h3 class="text-sm font-bold tracking-widest text-slate-400 uppercase">Choose Your Identity</h3>

	<div class="grid grid-cols-3 gap-4 sm:grid-cols-6">
		{#each avatarOptions as option (option.emoji)}
			<button
				class="group relative flex aspect-square items-center justify-center rounded-2xl {option.color} transition-all hover:scale-110 hover:shadow-lg focus:ring-4 focus:ring-indigo-100"
				disabled={pending}
				onclick={() => selectAvatar(option)}
			>
				<span class="text-4xl transition-transform group-hover:rotate-12">{option.emoji}</span>
				{#if profile.avatar?.includes(option.emoji)}
					<div
						class="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white shadow-sm ring-2 ring-white"
					>
						✓
					</div>
				{/if}
			</button>
		{/each}
	</div>
</div>
