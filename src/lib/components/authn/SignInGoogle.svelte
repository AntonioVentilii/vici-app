<script lang="ts">
	import { signIn } from '@junobuild/core';
	import IconGoogle from '$lib/components/icons/IconGoogle.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { isDev } from '$lib/env/app.env';
	import type { ButtonStatus } from '$lib/types/components';

	interface Props {
		status?: ButtonStatus;
		onSuccess?: () => void;
	}

	let { status = $bindable('enabled'), onSuccess }: Props = $props();

	const signInWithGoogle = async () => {
		status = 'pending';

		try {
			await signIn({
				google: {
					options: {
						redirect: {
							clientId: isDev()
								? '794351932143-em7c7j4rko2ok5fhk4crhv6f44ifmpqv.apps.googleusercontent.com'
								: '215111139647-7hat1jefroe7tkgu5kds4s8sv4dgf3fu.apps.googleusercontent.com',
							redirectUrl: `${window.location.origin}/auth/callback/google`
						}
					}
				}
			});
			onSuccess?.();
		} catch (err) {
			console.error('Failed to start Google sign-in:', err);
		} finally {
			status = 'enabled';
		}
	};
</script>

<div class="relative w-full">
	<Button class="w-full" onclick={signInWithGoogle} {status}>
		<IconGoogle size="20px" />
		<span>Sign in with Google</span>
	</Button>
</div>
