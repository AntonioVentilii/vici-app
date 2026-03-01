<script lang="ts">
	import { signIn } from '@junobuild/core';
	import IconIc from '$lib/components/icons/IconIC.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	interface Props {
		onSuccess?: () => void;
	}

	const { onSuccess }: Props = $props();

	const signInWithII = async () => {
		await signIn({
			internet_identity: {}
		});

		onSuccess?.();
	};
</script>

<Button onclick={signInWithII}>
	<IconIc size="20px" />
	<span>Sign in with Internet Identity</span>
</Button>
