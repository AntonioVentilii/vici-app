<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import type { LeagueMemberRole } from '$lib/types/league-member';
	import { t } from '$lib/utils/i18n.utils';
	import { isMobileViewport } from '$lib/utils/viewport.utils';

	interface Props {
		role: LeagueMemberRole;
		// Roomy contexts (e.g. the member detail sheet) opt out of the mobile
		// collapse and always spell the role out.
		expanded?: boolean;
	}

	const { role, expanded = false }: Props = $props();

	// Members are the default — a chip on every row would be noise, so only
	// owner/admin earn one. Owner takes the gold (laurel) tone to read as the
	// league's lead; admin stays neutral.

	const label = $derived(
		t({
			locale: $localeStore,
			key: role === 'owner' ? 'leagues.detail.role_owner' : 'leagues.detail.role_admin'
		})
	);

	// On the cramped mobile leaderboard rows the chip would crowd the name, so
	// it collapses to its initial; the full word stays reachable via the chip's
	// title and via the member sheet, which renders the badge expanded.
	const collapsed = $derived(isMobileViewport() && !expanded);
	// Codepoint-aware first character so a non-BMP / combined localized initial
	// doesn't split mid-grapheme.
	const initial = $derived([...label][0] ?? '');
</script>

{#if role === 'owner' || role === 'admin'}
	<Badge
		size="xs"
		title={collapsed ? label : undefined}
		variant={role === 'owner' ? 'warning' : 'default'}
	>
		{collapsed ? initial : label}
	</Badge>
{/if}
