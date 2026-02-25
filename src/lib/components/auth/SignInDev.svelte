<script lang="ts">
	import { signIn } from '@junobuild/core';
	import IconRobot from '$lib/components/icons/IconRobot.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	const signInWithDev = async () => {
		// Sign in for local development and E2E only
		await signIn({
			dev: {}
		});
	};
</script>

<Button onclick={signInWithDev}>
	<IconRobot size="20px" />
	Sign in for Dev
</Button>
