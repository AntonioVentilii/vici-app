<script lang="ts">
	import { Menu, X } from 'lucide-svelte/icons';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import LanguagePicker from '$lib/components/layout/LanguagePicker.svelte';
	import Logo from '$lib/components/layout/Logo.svelte';
	import WelcomeThemePicker from '$lib/components/layout/WelcomeThemePicker.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { PublicPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	let scrolled = $state(false);
	let menuOpen = $state(false);

	onMount(() => {
		const onScroll = () => {
			scrolled = window.scrollY > 8;
		};

		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });

		return () => window.removeEventListener('scroll', onScroll);
	});

	$effect(() => {
		if (typeof document === 'undefined') {
			return;
		}

		document.body.style.overflow = menuOpen ? 'hidden' : '';

		return () => {
			document.body.style.overflow = '';
		};
	});

	$effect(() => {
		if (!menuOpen || typeof window === 'undefined') {
			return;
		}

		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				menuOpen = false;
			}
		};

		window.addEventListener('keydown', onKey);

		return () => window.removeEventListener('keydown', onKey);
	});

	const closeMenu = () => {
		menuOpen = false;
	};
</script>

<nav
	class="welcome-nav"
	class:is-open={menuOpen}
	class:is-scrolled={scrolled}
	aria-label={t({ locale: $localeStore, key: 'a11y.landing' })}
>
	<div class="welcome-nav-inner">
		<div class="welcome-nav-logo">
			<Logo href={PublicPath.Welcome} />
		</div>

		<div class="welcome-nav-links">
			<a href="#markets">{t({ locale: $localeStore, key: 'nav.markets' })}</a>
			<a href="#flow">{t({ locale: $localeStore, key: 'nav.flow' })}</a>
			<a href="#leaderboard">{t({ locale: $localeStore, key: 'nav.leaderboard' })}</a>
			<a href="#trust">{t({ locale: $localeStore, key: 'nav.trust' })}</a>
		</div>

		<div class="welcome-nav-cta">
			<div class="welcome-nav-pickers">
				<LanguagePicker />
				<WelcomeThemePicker />
				<span class="welcome-nav-divider" aria-hidden="true"></span>
				<Button onclick={() => goto(PublicPath.SignIn)} size="sm" variant="ghost">
					{t({ locale: $localeStore, key: 'nav.signin' })}
				</Button>
			</div>
			<Button onclick={() => goto(PublicPath.SignUp)} size="sm">
				{t({ locale: $localeStore, key: 'nav.cta' })}
			</Button>
			<button
				class="welcome-nav-ham"
				aria-expanded={menuOpen}
				aria-label={menuOpen
					? t({ locale: $localeStore, key: 'a11y.close' })
					: t({ locale: $localeStore, key: 'a11y.language' })}
				onclick={() => (menuOpen = !menuOpen)}
				type="button"
			>
				{#if menuOpen}
					<X aria-hidden="true" size={20} strokeWidth={2} />
				{:else}
					<Menu aria-hidden="true" size={20} strokeWidth={2} />
				{/if}
			</button>
		</div>
	</div>

	{#if menuOpen}
		<div id="welcome-nav-sheet" class="welcome-nav-sheet">
			<nav class="welcome-nav-sheet-links" aria-label="Mobile primary">
				<a href="#markets" onclick={closeMenu}>
					<span class="num">01</span>
					<span>{t({ locale: $localeStore, key: 'nav.markets' })}</span>
				</a>
				<a href="#flow" onclick={closeMenu}>
					<span class="num">02</span>
					<span>{t({ locale: $localeStore, key: 'nav.flow' })}</span>
				</a>
				<a href="#leaderboard" onclick={closeMenu}>
					<span class="num">03</span>
					<span>{t({ locale: $localeStore, key: 'nav.leaderboard' })}</span>
				</a>
				<a href="#trust" onclick={closeMenu}>
					<span class="num">04</span>
					<span>{t({ locale: $localeStore, key: 'nav.trust' })}</span>
				</a>
			</nav>

			<div class="welcome-nav-sheet-controls">
				<LanguagePicker />
				<WelcomeThemePicker />
			</div>

			<div class="welcome-nav-sheet-foot">
				<Button
					onclick={() => {
						closeMenu();
						goto(PublicPath.SignIn);
					}}
					variant="ghost"
				>
					{t({ locale: $localeStore, key: 'nav.signin' })}
				</Button>
				<Button
					onclick={() => {
						closeMenu();
						goto(PublicPath.SignUp);
					}}
				>
					{t({ locale: $localeStore, key: 'nav.cta' })}
				</Button>
			</div>
		</div>
	{/if}
</nav>

{#if menuOpen}
	<button
		class="welcome-nav-scrim"
		aria-hidden="true"
		onclick={closeMenu}
		tabindex={-1}
		type="button"
	></button>
{/if}

<style lang="postcss">
	.welcome-nav {
		position: sticky;
		top: 0;
		z-index: 50;
		background: color-mix(in srgb, var(--background) 40%, transparent);
		backdrop-filter: blur(16px);
		border-bottom: 1px solid transparent;
		transition:
			background 200ms var(--ease-vici),
			border-color 200ms var(--ease-vici),
			box-shadow 200ms var(--ease-vici);
	}

	.welcome-nav.is-scrolled,
	.welcome-nav.is-open {
		background: color-mix(in srgb, var(--background) 78%, transparent);
		border-bottom-color: var(--border);
		box-shadow: 0 8px 24px -16px rgba(0, 0, 0, 0.4);
	}

	.welcome-nav-inner {
		max-width: 80rem;
		margin: 0 auto;
		padding: 0.75rem clamp(1.25rem, 4vw, 2rem);
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.welcome-nav-logo {
		display: inline-flex;
		flex-shrink: 0;
	}

	.welcome-nav-links {
		display: none;
		flex: 1;
		justify-content: center;
		gap: 1.75rem;
		font-size: var(--t-14);
		font-weight: 600;
		color: var(--muted-foreground);
	}

	.welcome-nav-links a:hover {
		color: var(--foreground);
	}

	.welcome-nav-cta {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.welcome-nav-pickers {
		display: none;
		align-items: center;
		gap: 0.5rem;
	}

	.welcome-nav-divider {
		width: 1px;
		height: 1.25rem;
		background: var(--border);
		margin: 0 0.15rem;
	}

	.welcome-nav-ham {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: color-mix(in srgb, var(--foreground) 4%, transparent);
		color: var(--foreground);
		cursor: pointer;
		transition:
			background 200ms var(--ease-vici),
			border-color 200ms var(--ease-vici);
	}

	.welcome-nav-ham:hover {
		background: color-mix(in srgb, var(--foreground) 8%, transparent);
		border-color: color-mix(in srgb, var(--foreground) 25%, transparent);
	}

	.welcome-nav-sheet {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		z-index: 60;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1.5rem clamp(1.25rem, 4vw, 2rem) 2rem;
		border-top: 1px solid var(--border);
		background: color-mix(in srgb, var(--background) 96%, transparent);
		backdrop-filter: blur(20px);
		box-shadow: 0 24px 48px -24px rgba(0, 0, 0, 0.45);
	}

	.welcome-nav-sheet-links {
		display: flex;
		flex-direction: column;
	}

	.welcome-nav-sheet-links a {
		display: flex;
		align-items: baseline;
		gap: 0.875rem;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--border);
		color: var(--foreground);
		font-size: var(--t-18);
		font-weight: 600;
		text-decoration: none;
	}

	.welcome-nav-sheet-links a .num {
		flex: 0 0 1.75rem;
		color: var(--muted-foreground);
		font-size: var(--t-12);
		font-weight: 700;
		letter-spacing: 0.08em;
	}

	.welcome-nav-sheet-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}

	.welcome-nav-sheet-foot {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.welcome-nav-scrim {
		position: fixed;
		inset: 0;
		z-index: 40;
		padding: 0;
		border: 0;
		background: color-mix(in srgb, var(--background) 35%, transparent);
		appearance: none;
		cursor: default;
	}

	@media (min-width: 48rem) {
		.welcome-nav-pickers {
			display: inline-flex;
		}

		.welcome-nav-ham {
			display: none;
		}
	}

	@media (min-width: 64rem) {
		.welcome-nav-links {
			display: flex;
		}
	}
</style>
