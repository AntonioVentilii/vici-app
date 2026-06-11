<script lang="ts">
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import { maintenanceStore } from '$lib/stores/maintenance.store';
	import { t } from '$lib/utils/i18n.utils';
</script>

{#if $maintenanceStore}
	<!-- Above the toasts (z-50): while the satellite is stopped for a deploy
	     nothing behind this is actionable anyway. -->
	<div
		class="bg-background fixed inset-0 z-[60] flex items-center justify-center"
		aria-live="assertive"
		role="status"
	>
		<div class="flex max-w-sm flex-col items-center gap-2 px-6 text-center">
			<LoadingSpinner center={false} size="lg" />
			<p class="text-foreground mt-4 text-lg font-black">
				{t({ locale: $localeStore, key: 'maintenance.title' })}
			</p>
			<p class="text-muted-foreground text-sm">
				{t({ locale: $localeStore, key: 'maintenance.body' })}
			</p>
		</div>
	</div>
{/if}
