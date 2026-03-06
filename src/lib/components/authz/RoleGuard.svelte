<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { userRole } from '$lib/derived/user.derived';
	import type { UserRole } from '$lib/types/user';

	interface Props {
		children: Snippet;
		requiredRole: UserRole;
		showWarning?: boolean;
	}

	const { children, requiredRole, showWarning = false }: Props = $props();

	const isAuthorized = $derived($userRole === requiredRole);

	const handleRefresh = () => {
		window.location.reload();
	};
</script>

{#if isAuthorized}
	{@render children()}
{:else if showWarning}
	<div class="flex flex-col items-center justify-center py-20 text-center">
		<div class="mb-12 max-w-md">
			<h2 class="text-4xl font-black text-slate-950">Access Denied</h2>
			<p class="mt-4 text-lg text-slate-600">
				You do not have the required permissions to access this area.
			</p>
			<p class="mt-2 text-sm text-slate-500">
				Required role: <span class="font-bold text-indigo-600 capitalize">{requiredRole}</span>.
			</p>
		</div>

		<div class="rounded-3xl border border-slate-100 bg-white p-12 shadow-2xl">
			<div class="flex flex-col items-center gap-6">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-red-500 to-orange-600 text-2xl font-bold text-white shadow-xl"
				>
					!
				</div>
				<Button onclick={handleRefresh}>Refresh Session</Button>
			</div>
		</div>
	</div>
{/if}
