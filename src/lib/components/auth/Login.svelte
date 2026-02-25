<script lang="ts">
	import { signIn } from '@junobuild/core';
	import Button from '$lib/components/ui/Button.svelte';

	const signInWithDev = async () => {
		// Sign in for local development and E2E only
		await signIn({
			dev: {}
		});
	};
</script>

<Button onclick={signInWithDev}>Sign in for dev</Button>
