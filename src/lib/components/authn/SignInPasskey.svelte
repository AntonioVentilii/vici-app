<script lang="ts">
	import { notEmptyString } from '@dfinity/utils';
	import { isWebAuthnAvailable, signIn, signUp } from '@junobuild/core';
	import { onMount } from 'svelte';
	import IconPasskey from '$lib/components/icons/IconPasskey.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import type { ButtonStatus } from '$lib/types/components';

	interface Props {
		status?: ButtonStatus;
		onSuccess?: () => void;
	}

	let { status = $bindable('enabled'), onSuccess }: Props = $props();

	let isSignUp = $state(false);
	let isAvailable = $state(true);
	let nickname = $state('');

	onMount(async () => {
		isAvailable = await isWebAuthnAvailable();
	});

	const toggleMode = () => {
		isSignUp = !isSignUp;
		nickname = '';
	};

	const handlePasskeyAction = async () => {
		status = 'pending';

		try {
			if (isSignUp) {
				await signUp({
					webauthn: {
						options: {
							passkey: {
								user: {
									displayName: notEmptyString(nickname) ? nickname : 'Vici User'
								}
							}
						}
					}
				});
			} else {
				await signIn({
					webauthn: {}
				});
			}

			onSuccess?.();
		} catch (e: unknown) {
			console.error(`Passkey ${isSignUp ? 'sign-up' : 'sign-in'} failed`, e);
		} finally {
			status = 'enabled';
		}
	};
</script>

{#if isAvailable}
	<div class="flex flex-col gap-3">
		{#if isSignUp}
			<div class="flex flex-col gap-1.5">
				<label
					class="text-muted-foreground px-1 text-[10px] font-bold tracking-wider uppercase"
					for="nickname"
				>
					Your Nickname
				</label>
				<input
					id="nickname"
					class="bg-foreground/5 text-foreground ring-border focus:ring-primary w-full rounded-xl border-none px-3 py-2 text-sm ring-1 ring-inset focus:ring-2"
					placeholder="Enter a nickname..."
					type="text"
					bind:value={nickname}
				/>
			</div>
		{/if}

		<div class="flex flex-col gap-2">
			<Button onclick={handlePasskeyAction} {status}>
				<IconPasskey size="20px" />
				<span>{isSignUp ? 'Create Passkey' : 'Sign in with Passkey'}</span>
			</Button>

			<button
				class="text-muted-foreground hover:text-foreground text-xs underline"
				onclick={toggleMode}
				type="button"
			>
				{isSignUp ? 'Already have a passkey? Sign in' : 'First time? Create a passkey'}
			</button>
		</div>
	</div>
{/if}
