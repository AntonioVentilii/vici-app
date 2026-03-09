<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { UserRole } from '$lib/types/user';

	let {
		principal = '',
		role = UserRole.ADMIN,
		onPrincipalChange,
		onRoleChange,
		onAddRole
	}: {
		principal: string;
		role: UserRole;
		onPrincipalChange: (val: string) => void;
		onRoleChange: (val: UserRole) => void;
		onAddRole: () => void;
	} = $props();

	const validRoles = Object.values(UserRole).filter((role) => role !== UserRole.CONTROLLER);
</script>

<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
	<h2 class="mb-6 text-xl font-semibold text-slate-900">Assign Role</h2>

	<form
		class="space-y-6"
		onsubmit={(e) => {
			e.preventDefault();

			onAddRole();
		}}
	>
		<div>
			<label class="block text-sm font-medium text-slate-900" for="admin-principal">
				User Principal ID
			</label>
			<div class="mt-2">
				<input
					id="admin-principal"
					class="focus:ring-brand-600 block w-full rounded-md border-0 py-1.5 text-slate-900 shadow-sm ring-1 ring-slate-300 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
					oninput={(e) => onPrincipalChange(e.currentTarget.value)}
					placeholder="aaaaa-aa..."
					required
					type="text"
					value={principal}
				/>
			</div>
			<div class="mt-2 text-sm text-slate-500">
				Enter the Internet Identity Principal of the user you wish to grant rights to.
			</div>
		</div>

		<div>
			<label class="block text-sm font-medium text-slate-900" for="user-role"> Role </label>
			<div class="mt-2">
				<select
					id="user-role"
					class="focus:ring-brand-600 block w-full rounded-md border-0 py-2 pr-10 pl-3 text-slate-900 shadow-sm ring-1 ring-slate-300 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
					onchange={(e) => onRoleChange(e.currentTarget.value as UserRole)}
					value={role}
				>
					{#each validRoles as role (role)}
						<option value={role}>{role}</option>
					{/each}
				</select>
			</div>
			<p class="mt-2 text-sm text-slate-500">Select the permission level for this user.</p>
		</div>

		<Button onclick={onAddRole} state={!principal ? 'disabled' : 'enabled'}>Assign Role</Button>
	</form>
</div>
