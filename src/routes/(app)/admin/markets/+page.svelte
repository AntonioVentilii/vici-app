<script lang="ts">
	import Protected from '$lib/components/authn/Protected.svelte';
	import PermissionGuard from '$lib/components/authz/PermissionGuard.svelte';
	import AdminMarketsPage from '$lib/components/pages/AdminMarketsPage.svelte';
	import { Permission } from '$lib/enums/permission';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';
</script>

<Protected
	description={t({ locale: $localeStore, key: 'authn.admin.sub' })}
	title={t({ locale: $localeStore, key: 'authn.admin.title' })}
>
	<PermissionGuard permission={Permission.VIEW_ADMIN_PANEL}>
		<AdminMarketsPage />
	</PermissionGuard>
</Protected>
