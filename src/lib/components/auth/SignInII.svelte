<script lang="ts">
	import { signIn } from '@junobuild/core';
	import IconIc from '$lib/components/icons/IconIC.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	const signInWithII = async () => {
		await signIn({
			internet_identity: {}
		});
	};
</script>

<Button onclick={signInWithII}>
	<IconIc size="20px" />
	<span>Sign in with Internet Identity</span>
</Button>
