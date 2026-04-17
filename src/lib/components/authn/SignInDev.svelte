<script lang="ts">
	import { signIn } from '@junobuild/core';
	import IconRobot from '$lib/components/icons/IconRobot.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import type { ButtonStatus } from '$lib/types/components';

	interface Props {
		status?: ButtonStatus;
		onSuccess?: () => void;
	}

	let { status = $bindable('enabled'), onSuccess }: Props = $props();

	const signInWithDev = async () => {
		status = 'pending';

		try {
			await signIn({
				dev: {}
			});

			onSuccess?.();
		} catch (e: unknown) {
			console.error('Dev sign-in failed', e);
		} finally {
			status = 'enabled';
		}
	};
</script>

<Button onclick={signInWithDev} {status}>
	<IconRobot size="20px" />
	Sign in for Dev
</Button>
