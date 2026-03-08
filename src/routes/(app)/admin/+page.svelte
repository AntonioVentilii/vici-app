<script lang="ts">
	import Protected from '$lib/components/authn/Protected.svelte';
	import PermissionGuard from '$lib/components/authz/PermissionGuard.svelte';
	import AdminPage from '$lib/components/pages/AdminPage.svelte';
	import { Permission } from '$lib/types/permission';
</script>

<Protected
	description="Sign in with an admin account to manage markets and resolve predictions."
	title="Admin Access"
>
	<PermissionGuard permission={Permission.VIEW_ADMIN_PANEL}>
		<AdminPage />
	</PermissionGuard>
</Protected>
