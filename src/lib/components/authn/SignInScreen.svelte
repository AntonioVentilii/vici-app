<script lang="ts">
	import { goto } from '$app/navigation';
	import SignInActions from '$lib/components/authn/SignInActions.svelte';
	import { AppPath, PublicPath } from '$lib/constants/routes.constants';

	interface Props {
		// Mode: `signin` for returning users (welcome-back framing),
		// `signup` for new accounts (currently routes to the onboarding
		// flow once Phase 2 lands).
		mode?: 'signin' | 'signup';
		// Callback for after a successful auth handshake. Defaults to
		// navigating to `AppPath.Home`; routes calling this from a
		// layout can pass a different post-auth target.
		onSuccess?: () => void;
	}

	const {
		mode = 'signin',
		onSuccess = () => {
			void goto(AppPath.Home);
		}
	}: Props = $props();

	const isSignUp = $derived(mode === 'signup');

	const handleSwitch = () => {
		goto(isSignUp ? PublicPath.SignIn : PublicPath.SignUp);
	};
</script>

<div class="signin-wrap">
	<div class="signin-card">
		<header class="signin-head">
			<p class="allcaps signin-eyebrow">
				{isSignUp ? 'Welcome' : 'Welcome back'}
			</p>
			<h1 class="signin-title">
				{#if isSignUp}
					Start predicting on
					<span class="serif-italic signin-wordmark">VICI.</span>
				{:else}
					Sign in to
					<span class="serif-italic signin-wordmark">VICI.</span>
				{/if}
			</h1>
			<p class="signin-sub">
				{isSignUp
					? 'Create an account to track your calls and your streak.'
					: 'Pick up where you left off.'}
			</p>
		</header>

		<div class="signin-providers">
			<SignInActions {onSuccess} />
		</div>

		<footer class="signin-foot">
			<span class="signin-foot-mute">
				{isSignUp ? 'Already have an account?' : 'New to VICI?'}
			</span>
			<button class="signin-link" onclick={handleSwitch} type="button">
				{isSignUp ? 'Sign in →' : 'Create an account →'}
			</button>
		</footer>
	</div>

	<p class="signin-legal">
		By continuing you agree to the <a href="/legal/terms">Terms</a> and
		<a href="/legal/privacy">Privacy Policy</a>. VICI is play-money during preview. No financial
		advice.
	</p>
</div>

<style lang="postcss">
	.signin-wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.25rem;
		min-height: 100dvh;
		padding: 1.5rem;
		background: var(--bg-base);
	}

	.signin-card {
		width: 100%;
		max-width: 22rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 2rem 1.5rem;
		background: var(--bg-surface);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		box-shadow: var(--inset-hi), var(--shadow-modal);
	}

	.signin-head {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.signin-eyebrow {
		margin-top: 0.5rem;
		color: var(--text-muted);
		letter-spacing: var(--tracking-allcaps);
	}

	.signin-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--t-32);
		line-height: var(--leading-snug);
		font-weight: 600;
		letter-spacing: var(--tracking-snug);
		color: var(--text-base);
	}

	.signin-wordmark {
		color: var(--laurel);
	}

	.signin-sub {
		margin: 0;
		font-size: var(--t-14);
		color: var(--text-muted);
	}

	.signin-providers {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.signin-providers :global(> div) {
		width: 100%;
	}

	.signin-foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border-base);
		font-size: var(--t-13);
	}

	.signin-foot-mute {
		color: var(--text-muted);
	}

	.signin-link {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		font-weight: 600;
		color: var(--laurel);
		text-decoration: underline;
		text-decoration-color: var(--parchment-faint);
		text-underline-offset: 0.2em;
		cursor: pointer;
		transition: text-decoration-color var(--d-hover) var(--ease-vici);
	}

	.signin-link:hover {
		text-decoration-color: var(--laurel);
	}

	.signin-legal {
		max-width: 22rem;
		margin: 0;
		padding: 0 0.5rem;
		text-align: center;
		font-size: var(--t-12);
		line-height: var(--leading-normal);
		color: var(--parchment-faint);
	}

	.signin-legal :global(a) {
		color: var(--text-muted);
	}
</style>
