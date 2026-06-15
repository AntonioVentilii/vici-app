<script lang="ts">
	import { fade } from 'svelte/transition';
	import { clickOutside } from '$lib/actions/click-outside';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import type { LeagueMemberRole } from '$lib/types/league-member';
	import { t } from '$lib/utils/i18n.utils';
	import { prefersReducedMotion } from '$lib/utils/reduced-motion.utils';
	import { isMobileViewport } from '$lib/utils/viewport.utils';

	interface Props {
		role: LeagueMemberRole;
	}

	const { role }: Props = $props();

	// Members are the default — a chip on every row would be noise, so only
	// owner/admin earn one. Owner takes the gold (laurel) tone to read as the
	// league's lead; admin stays neutral.

	const label = $derived(
		t({
			locale: $localeStore,
			key: role === 'owner' ? 'leagues.detail.role_owner' : 'leagues.detail.role_admin'
		})
	);

	// On mobile the chips share a cramped row with rank, avatar and stats, so we
	// shrink them to a single-letter initial and reveal the full word in a tap
	// tooltip — desktop has the room to spell it out inline.
	const mobile = $derived(isMobileViewport());
	let showTooltip = $state(false);
</script>

{#if role === 'owner' || role === 'admin'}
	{#if mobile}
		<span class="relative inline-flex" use:clickOutside={() => (showTooltip = false)}>
			<button
				class="inline-flex rounded-full focus-visible:outline-none"
				aria-label={label}
				onclick={(event) => {
					event.stopPropagation();
					showTooltip = !showTooltip;
				}}
				type="button"
			>
				<Badge size="xs" variant={role === 'owner' ? 'warning' : 'default'}>
					{label.charAt(0)}
				</Badge>
			</button>

			{#if showTooltip}
				<span
					class="bg-popover border-border-strong shadow-modal text-foreground absolute top-full left-1/2 z-50 mt-1 -translate-x-1/2 rounded-[6px] border px-2 py-1 text-[10px] font-semibold whitespace-nowrap backdrop-blur-md"
					role="tooltip"
					transition:fade={prefersReducedMotion() ? { duration: 0 } : { duration: 120 }}
				>
					{label}
				</span>
			{/if}
		</span>
	{:else}
		<Badge size="xs" variant={role === 'owner' ? 'warning' : 'default'}>
			{label}
		</Badge>
	{/if}
{/if}
