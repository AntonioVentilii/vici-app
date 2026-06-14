<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import type { LeagueMemberRole } from '$lib/types/league-member';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		role: LeagueMemberRole;
	}

	const { role }: Props = $props();

	// Members are the default — a chip on every row would be noise, so only
	// owner/admin earn one. Owner takes the gold (laurel) tone to read as the
	// league's lead; admin stays neutral.
</script>

{#if role === 'owner' || role === 'admin'}
	<Badge size="xs" variant={role === 'owner' ? 'warning' : 'default'}>
		{t({
			locale: $localeStore,
			key: role === 'owner' ? 'leagues.detail.role_owner' : 'leagues.detail.role_admin'
		})}
	</Badge>
{/if}
