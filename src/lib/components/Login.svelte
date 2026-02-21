<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import { signIn } from '@junobuild/core';

	const signInWithDev = async () => {
		// Sign in for local development and E2E only
		await signIn({
			dev: {}
		});
	};
</script>

<Button onclick={signInWithDev}>Sign in for dev</Button>
