<script lang="ts">
	import { signOut } from '@junobuild/core';
	import { Wrench, X } from 'lucide-svelte/icons';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { AppPath, PublicPath } from '$lib/constants/routes.constants';
	import { userSignedIn } from '$lib/derived/user.derived';
	import { isDev } from '$lib/env/app.env';

	const enabled = isDev();

	let open = $state(false);

	const resolvedPath = (path: AppPath | PublicPath): string => {
		switch (path) {
			case AppPath.Home:
				return resolve('/');
			case AppPath.Flow:
				return resolve('/flow');
			case AppPath.Portfolio:
				return resolve('/portfolio');
			case AppPath.Profile:
				return resolve('/profile');
			case PublicPath.SignIn:
				return resolve('/signin');
			case PublicPath.SignUp:
				return resolve('/signup');
			default:
				return resolve('/');
		}
	};

	const jumpTo = async (path: AppPath | PublicPath) => {
		open = false;
		await goto(resolvedPath(path));
	};

	const handleSignOut = async () => {
		open = false;

		try {
			await signOut();
		} catch {
			// Already signed out / network glitch — push to /signin
			// regardless so the panel doesn't get stuck.
		}

		await goto(resolve('/signin'), { replaceState: true });
	};
</script>

{#if enabled}
	<div class="tweaks-root" class:is-open={open}>
		<button
			class="tweaks-fab"
			aria-label="Open dev tweaks panel"
			onclick={() => (open = !open)}
			type="button"
		>
			{#if open}
				<X size={18} strokeWidth={2} />
			{:else}
				<Wrench size={18} strokeWidth={2} />
			{/if}
		</button>

		{#if open}
			<aside class="tweaks-panel" aria-label="Dev tweaks">
				<header class="tweaks-head">
					<span class="allcaps">Tweaks · DEV</span>
				</header>

				<section class="tweaks-section">
					<span class="allcaps tweaks-label">Quick jumps</span>
					<div class="tweaks-jumps">
						<button onclick={() => jumpTo(AppPath.Home)} type="button">Home (/)</button>
						<button onclick={() => jumpTo(AppPath.Flow)} type="button">Flow</button>
						<button onclick={() => jumpTo(AppPath.Portfolio)} type="button">Portfolio</button>
						<button onclick={() => jumpTo(AppPath.Profile)} type="button">Profile</button>
						<button onclick={() => jumpTo(PublicPath.SignIn)} type="button">Sign in</button>
						<button onclick={() => jumpTo(PublicPath.SignUp)} type="button">Sign up</button>
					</div>
				</section>

				<section class="tweaks-section">
					<span class="allcaps tweaks-label">Session</span>
					<div class="tweaks-jumps">
						{#if $userSignedIn}
							<button class="tweaks-danger" onclick={handleSignOut} type="button">
								Sign out
							</button>
						{:else}
							<span class="tweaks-status">Signed out</span>
						{/if}
					</div>
				</section>

				<p class="tweaks-foot">Theme switcher (Dark / Light / Peach) lands in a later phase.</p>
			</aside>
		{/if}
	</div>
{/if}

<style lang="postcss">
	.tweaks-root {
		position: fixed;
		bottom: calc(env(safe-area-inset-bottom, 0px) + 84px);
		right: 1rem;
		z-index: 80;
		display: flex;
		flex-direction: column-reverse;
		align-items: flex-end;
		gap: 0.5rem;
		pointer-events: none;
	}

	.tweaks-fab,
	.tweaks-panel {
		pointer-events: auto;
	}

	.tweaks-fab {
		width: 36px;
		height: 36px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-popover);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-pill);
		color: var(--text-muted);
		box-shadow: var(--shadow-toast);
		cursor: pointer;
		transition:
			color var(--d-hover) var(--ease-vici),
			transform var(--d-hover) var(--ease-vici),
			border-color var(--d-hover) var(--ease-vici);
	}

	.tweaks-fab:hover {
		color: var(--laurel);
		border-color: var(--laurel);
	}

	.tweaks-root.is-open .tweaks-fab {
		color: var(--laurel);
		border-color: var(--laurel);
	}

	.tweaks-panel {
		width: 16rem;
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		padding: 0.875rem 1rem;
		background: var(--bg-popover);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-12);
		box-shadow: var(--inset-hi), var(--shadow-modal);
		font-size: var(--t-13);
	}

	.tweaks-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--border-base);
		color: var(--laurel);
		font-size: var(--t-12);
	}

	.tweaks-section {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.tweaks-label {
		font-size: 10px;
		color: var(--text-muted);
	}

	.tweaks-jumps {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.4rem;
	}

	.tweaks-jumps button {
		font: inherit;
		padding: 0.4rem 0.5rem;
		background: var(--bg-surface);
		border: 1px solid var(--border-base);
		border-radius: var(--r-4);
		color: var(--text-base);
		text-align: left;
		cursor: pointer;
		transition: background-color var(--d-hover) var(--ease-vici);
	}

	.tweaks-jumps button:hover {
		background: var(--bg-elevated);
	}

	.tweaks-jumps .tweaks-danger {
		color: var(--no);
		border-color: rgba(255, 107, 107, 0.3);
	}

	.tweaks-jumps .tweaks-danger:hover {
		background: var(--no-wash);
	}

	.tweaks-status {
		font-size: var(--t-12);
		color: var(--text-muted);
	}

	.tweaks-foot {
		margin: 0;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border-base);
		font-size: 11px;
		color: var(--parchment-faint);
		font-family: var(--font-display);
	}
</style>
