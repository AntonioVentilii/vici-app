<script lang="ts">
	import { signIn } from '@junobuild/core';
	import IconGoogle from '$lib/components/icons/IconGoogle.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import type { ButtonState } from '$lib/types/components';

	interface Props {
		state?: ButtonState;
		onSuccess?: () => void;
	}

	const { state = $bindable('enabled'), onSuccess }: Props = $props();

	const signInWithGoogle = async () => {
		await signIn({
			google: {}
		});

		onSuccess?.();
	};
</script>

<div class="relative w-full">
	<Button class="w-full opacity-70 grayscale" onclick={signInWithGoogle} {state}>
		<IconGoogle size="20px" />
		<span>Sign in with Google</span>
	</Button>

	<div class="pointer-events-none absolute -top-2 -right-2 z-10">
		<span
			class="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm"
		>
			Coming Soon
		</span>
	</div>
</div>
