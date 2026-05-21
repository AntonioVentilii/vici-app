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
	<div class="passkey-auth">
		{#if isSignUp}
			<div class="passkey-nickname">
				<label for="nickname"> Your Nickname </label>
				<input id="nickname" placeholder="Enter a nickname..." type="text" bind:value={nickname} />
			</div>
		{/if}

		<div class="passkey-actions">
			<Button class="signin-provider-button w-full" onclick={handlePasskeyAction} {status}>
				<IconPasskey size="20px" />
				<span>{isSignUp ? 'Create Passkey' : 'Sign in with Passkey'}</span>
			</Button>

			<button class="passkey-toggle" onclick={toggleMode} type="button">
				{isSignUp ? 'Already have a passkey? Sign in' : 'First time? Create a passkey'}
			</button>
		</div>
	</div>
{/if}

<style lang="postcss">
	.passkey-auth,
	.passkey-actions,
	.passkey-nickname {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.passkey-nickname label {
		padding-inline: 0.25rem;
		color: var(--text-muted);
		font-size: 0.625rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.passkey-nickname input {
		width: 100%;
		border: 1px solid var(--border-base);
		border-radius: var(--r-8);
		background: var(--bg-surface);
		padding: 0.7rem 0.8rem;
		color: var(--text-base);
		font-size: var(--t-14);
		outline: none;
	}

	.passkey-nickname input:focus {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px var(--laurel-glow);
	}

	.passkey-toggle {
		align-self: center;
		border: 0;
		background: transparent;
		padding: 0.1rem 0;
		color: var(--text-muted);
		font: inherit;
		font-size: var(--t-12);
		text-decoration: underline;
		text-decoration-color: var(--border-strong);
		text-underline-offset: 0.2em;
		cursor: pointer;
	}

	.passkey-toggle:hover {
		color: var(--text-base);
		text-decoration-color: var(--color-primary);
	}
</style>
