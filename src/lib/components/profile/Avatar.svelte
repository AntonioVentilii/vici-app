<script lang="ts">
	import type { PrincipalText } from '@junobuild/schema';
	import ViciAvatar from '$lib/components/ui/ViciAvatar.svelte';
	import { hasUploadedAvatar, resolveAvatarUrl } from '$lib/utils/avatar.utils';

	interface Props {
		avatar?: string | null;
		owner: PrincipalText;
		nickname?: string | null;
		class?: string;
	}

	const { avatar, owner, nickname, class: className = '' }: Props = $props();

	// Real uploads win; otherwise we render the deterministic generated face
	// seeded by the user's immutable principal (`owner`) — never the nickname,
	// which can change and would otherwise change the user's face.
	const isUploaded = $derived(hasUploadedAvatar(avatar));
</script>

<div class="overflow-hidden rounded-full {className}">
	{#if isUploaded}
		<img
			class="h-full w-full object-cover"
			alt={nickname ?? 'Avatar'}
			referrerpolicy="no-referrer"
			src={resolveAvatarUrl({ avatar, owner })}
		/>
	{:else}
		<!-- Generated default face, seeded by the principal. The decorative
			 SVG is aria-hidden inside ViciAvatar; this wrapper carries the
			 named-user semantics so the avatar stays announced. -->
		<span class="vici-avatar-fill h-full w-full" aria-label={nickname ?? 'Avatar'} role="img">
			<ViciAvatar seed={owner} />
		</span>
	{/if}
</div>

<style lang="postcss">
	.vici-avatar-fill {
		display: block;
	}

	/* The generated face is sized by the caller's wrapper, not its own
		 pixel `size` prop, so it matches the uploaded `<img>` exactly. */
	.vici-avatar-fill :global(.vici-avatar) {
		width: 100% !important;
		height: 100% !important;
	}

	.vici-avatar-fill :global(.vici-avatar svg) {
		width: 100%;
		height: 100%;
	}
</style>
