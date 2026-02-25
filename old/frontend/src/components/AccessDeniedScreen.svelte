<script lang="ts">
	import { auth } from '../stores/auth';
	import Button from './ui/Button.svelte';
	import { ShieldAlert } from 'lucide-svelte';

	$: status = $auth.loginStatus;
</script>

<div class="flex flex-1 items-center justify-center px-4 py-16">
	<div class="max-w-md space-y-6 text-center">
		<div class="flex justify-center">
			<div class="rounded-full bg-red-100 p-6">
				<ShieldAlert size={48} class="text-red-600" />
			</div>
		</div>
		<div class="space-y-2">
			<h1 class="text-foreground text-3xl font-bold">Access Denied</h1>
			<p class="text-muted-foreground">
				You need to be logged in to access this page. Please log in to continue.
			</p>
		</div>
		<Button on:click={() => auth.login()} disabled={status === 'logging-in'} size="lg">
			{status === 'logging-in' ? 'Connecting...' : 'Login to Continue'}
		</Button>
	</div>
</div>
