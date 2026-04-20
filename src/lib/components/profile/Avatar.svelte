<script lang="ts">
	import type { PrincipalText } from '@junobuild/schema';
	import { resolveAvatarUrl } from '$lib/utils/avatar.utils';

	interface Props {
		avatar?: string | null;
		owner: PrincipalText;
		nickname?: string | null;
		class?: string;
	}

	const { avatar, owner, nickname, class: className = '' }: Props = $props();
</script>

<div class="overflow-hidden rounded-full {className}">
	<img
		class="h-full w-full object-cover"
		alt={nickname ?? 'Avatar'}
		src={resolveAvatarUrl({ avatar, owner })}
	/>
</div>
