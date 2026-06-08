<script lang="ts">
	/**
	 * Two nav variants on the landing surface: `.dnav` (≥1024px,
	 * horizontal pattern with scroll-spy + smooth scroll) and
	 * `.lp-nav` / `.lp-pill` (<1024px, pill morph + slide-down sheet).
	 * CSS in `src/landing.css` flips visibility at the 1024px
	 * breakpoint so both render in the markup and the right one
	 * shows.
	 */
	import { Globe, Lock } from '@lucide/svelte/icons';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Logo from '$lib/components/layout/Logo.svelte';
	import {
		LOCALE_STORAGE_KEY,
		SUPPORTED_LOCALES,
		type AppLocale
	} from '$lib/constants/locale.constants';
	import { PublicPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { theme } from '$lib/stores/theme.store';
	import { t } from '$lib/utils/i18n.utils';

	// Landing in-page sections the nav links to. `status` (the
	// accuracy-as-status board) reuses the `nav.leaderboard` label
	// ("Social"); `faq` uses the universal "FAQ" literal.
	const sections = [
		{ id: 'status', labelKey: 'nav.leaderboard' as const },
		{ id: 'faq', labelKey: null }
	] as const;

	type NavSection = (typeof sections)[number];

	// "FAQ" is a universal literal (same in every supported locale); other
	// sections resolve through the i18n catalog.
	const navLabel = (section: NavSection): string =>
		section.labelKey === null ? 'FAQ' : t({ locale: $localeStore, key: section.labelKey });
	// Theme labels resolve from the canonical `ui.theme.*` catalog — the
	// same source AppearancePicker uses — so the appearance tooltips/aria
	// stay localized and in sync rather than hardcoded English.
	const THEME_IDS = ['dark', 'light', 'peach'] as const;
	const themeOpts = $derived(
		THEME_IDS.map((id) => ({
			id,
			label: t({ locale: $localeStore, key: `ui.theme.${id}` as const })
		}))
	);

	let scrolled = $state(false);
	let active = $state<string>('');
	let menuOpen = $state(false);
	let langOpen = $state(false);
	let dnavLangOpen = $state(false);
	let langRef: HTMLDivElement | null = $state(null);
	let langPopRef: HTMLUListElement | null = $state(null);
	let dnavLangRef: HTMLDivElement | null = $state(null);
	let langPopPos = $state<{ top: number; right: number } | null>(null);

	const LOCALES = SUPPORTED_LOCALES;

	onMount(() => {
		if (typeof document !== 'undefined') {
			// `data-theme` is owned by the canonical theme store + the
			// no-FOUC inline script in `app.html`; we only stamp the brand
			// accent here.
			document.documentElement.setAttribute('data-accent', 'laurel');
		}

		// Hysteresis (8px to engage, 4px to release) so iOS momentum/rubber-band
		// jitter around the threshold can't rapidly toggle the scrolled state and
		// make the nav background tremble. A small deadband, not a single edge.
		const onScroll = () => {
			const y = window.scrollY;
			scrolled = scrolled ? y > 4 : y > 8;
		};

		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });

		// Scroll spy
		const els = sections
			.map((s) => document.getElementById(s.id))
			.filter((el): el is HTMLElement => Boolean(el));
		const io =
			els.length === 0
				? null
				: new IntersectionObserver(
						(entries) => {
							entries.forEach((e) => {
								if (e.isIntersecting && e.intersectionRatio > 0.3) {
									active = e.target.id;
								}
							});
						},
						{ rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.3, 0.6] }
					);

		if (io) {
			els.forEach((el) => io.observe(el));
		}

		return () => {
			window.removeEventListener('scroll', onScroll);

			if (io) {
				io.disconnect();
			}
		};
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

		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				menuOpen = false;
			}
		};

		window.addEventListener('keydown', onKey);

		return () => window.removeEventListener('keydown', onKey);
	});

	// Outside-click for the lang popovers
	$effect(() => {
		if (!langOpen && !dnavLangOpen) {
			return;
		}

		const onDoc = (e: MouseEvent) => {
			const target = e.target as Node | null;

			// The mobile popover lives outside `.lp-pill` to escape its
			// `overflow: hidden` + `backdrop-filter` containing block, so
			// "inside the popover" is checked separately from the globe ref.
			if (
				langOpen &&
				langRef &&
				target &&
				!langRef.contains(target) &&
				!(langPopRef && langPopRef.contains(target))
			) {
				langOpen = false;
			}

			if (dnavLangOpen && dnavLangRef && target && !dnavLangRef.contains(target)) {
				dnavLangOpen = false;
			}
		};

		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				langOpen = false;
				dnavLangOpen = false;
			}
		};

		document.addEventListener('mousedown', onDoc);
		window.addEventListener('keydown', onKey);

		return () => {
			document.removeEventListener('mousedown', onDoc);
			window.removeEventListener('keydown', onKey);
		};
	});

	// Track the globe's viewport rect so the mobile lang popover — which
	// is rendered outside `.lp-pill` to escape the pill's clipping — can
	// anchor itself under the globe via `position: fixed`.
	$effect(() => {
		if (!langOpen || typeof window === 'undefined') {
			langPopPos = null;

			return;
		}

		const update = () => {
			if (!langRef) {
				return;
			}

			const r = langRef.getBoundingClientRect();
			langPopPos = { top: r.bottom + 8, right: window.innerWidth - r.right };
		};

		update();
		window.addEventListener('scroll', update, { passive: true });
		window.addEventListener('resize', update, { passive: true });

		return () => {
			window.removeEventListener('scroll', update);
			window.removeEventListener('resize', update);
		};
	});

	const closeMenu = () => {
		menuOpen = false;
	};

	const onLinkClick =
		(id: string) =>
		(e: MouseEvent): void => {
			if (typeof document === 'undefined') {
				return;
			}

			const el = document.getElementById(id);

			if (!el) {
				return;
			}

			e.preventDefault();
			const y = el.getBoundingClientRect().top + window.scrollY - 72;
			window.scrollTo({ top: y, behavior: 'smooth' });
			history.replaceState(null, '', `#${id}`);
		};

	const setLocaleAndClose = (loc: AppLocale) => {
		localeStore.set({ key: LOCALE_STORAGE_KEY, value: loc });
		langOpen = false;
		dnavLangOpen = false;
	};
</script>

<!-- ─── Desktop nav (≥1024px) ─── -->
<nav
	class="dnav"
	class:is-scrolled={scrolled}
	aria-label={t({ locale: $localeStore, key: 'a11y.landing' })}
>
	<a class="dnav-skip" href="#main">
		{t({ locale: $localeStore, key: 'welcome.nav.skip_to_content' })}
	</a>
	<div class="dnav-inner">
		<span class="dnav-logo"><Logo href={PublicPath.Welcome} /></span>
		<div class="dnav-links">
			{#each sections as section (section.id)}
				<a
					class:is-active={active === section.id}
					aria-current={active === section.id ? 'page' : undefined}
					href="#{section.id}"
					onclick={onLinkClick(section.id)}
				>
					<span class="ltext">{navLabel(section)}</span>
					<span class="dot" aria-hidden="true"></span>
				</a>
			{/each}
		</div>
		<div class="dnav-right">
			<div bind:this={dnavLangRef} class="dnav-lang-wrap">
				<button
					class="dnav-globe"
					aria-expanded={dnavLangOpen}
					aria-haspopup="listbox"
					aria-label={t({ locale: $localeStore, key: 'a11y.language' })}
					onclick={() => (dnavLangOpen = !dnavLangOpen)}
					type="button"
				>
					<Globe aria-hidden="true" />
				</button>
				{#if dnavLangOpen}
					<ul
						class="dnav-lang-pop"
						aria-label={t({ locale: $localeStore, key: 'a11y.language' })}
						role="listbox"
					>
						{#each LOCALES as l (l.id)}
							<li>
								<button
									class="dnav-lang-item"
									class:active={$localeStore === l.id}
									aria-selected={$localeStore === l.id}
									onclick={() => setLocaleAndClose(l.id)}
									role="option"
									type="button"
								>
									<span class="num dnav-lang-short">{l.short}</span>
									<span class="dnav-lang-label">{l.label}</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
			<div
				class="dnav-theme"
				aria-label={t({ locale: $localeStore, key: 'a11y.appearance' })}
				role="radiogroup"
			>
				{#each themeOpts as o (o.id)}
					<button
						class="dnav-theme-dot dnav-app-{o.id}"
						class:active={$theme === o.id}
						aria-checked={$theme === o.id}
						aria-label={o.label}
						data-tooltip={o.label.toUpperCase()}
						onclick={() => theme.set(o.id)}
						role="radio"
						type="button"
					>
						<span class="inner" aria-hidden="true"></span>
					</button>
				{/each}
			</div>
			<span class="dnav-divider" aria-hidden="true"></span>
			<a class="dnav-signin" href={PublicPath.SignIn}>
				{t({ locale: $localeStore, key: 'nav.signin' })}
			</a>
			<a class="btn btn-primary dnav-cta" href={PublicPath.SignUp}>
				{t({ locale: $localeStore, key: 'nav.cta' })}
			</a>
		</div>
	</div>
</nav>

<!-- ─── Pill nav (mobile/tablet, <1024px) ─── -->
<nav
	class="lp-nav lp-root"
	class:is-open={menuOpen}
	class:is-scrolled={scrolled}
	aria-label={t({ locale: $localeStore, key: 'a11y.landing' })}
>
	<div class="lp-nav-inner">
		<div class="lp-pill" class:open={menuOpen}>
			<div class="lp-pill-topline">
				<span class="lp-logo">
					<Logo href={PublicPath.Welcome} />
				</span>
				<div class="lp-pill-right">
					<div bind:this={langRef} class="lp-lang-wrap">
						<button
							class="lp-globe"
							aria-expanded={langOpen}
							aria-haspopup="listbox"
							aria-label={t({ locale: $localeStore, key: 'a11y.language' })}
							onclick={() => (langOpen = !langOpen)}
							type="button"
						>
							<Globe aria-hidden="true" />
						</button>
					</div>
					<button
						class="btn btn-primary lp-cta"
						onclick={() => goto(PublicPath.SignUp)}
						type="button"
					>
						{t({ locale: $localeStore, key: 'nav.cta' })}
					</button>
					<button
						class="lp-ham"
						class:open={menuOpen}
						aria-expanded={menuOpen}
						aria-label={menuOpen
							? t({ locale: $localeStore, key: 'a11y.close' })
							: t({ locale: $localeStore, key: 'a11y.language' })}
						onclick={() => (menuOpen = !menuOpen)}
						type="button"
					>
						<svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
							<line class="t" x1="6" x2="18" y1="12" y2="12" />
							<line class="b" x1="6" x2="18" y1="12" y2="12" />
						</svg>
					</button>
				</div>
			</div>

			{#if menuOpen}
				<div class="lp-pill-body">
					<div class="lp-trust lp-trust-hero">
						<Lock size={14} strokeWidth={1.8} />
						<span>
							{t({ locale: $localeStore, key: 'welcome.nav.free_prefix' })}
							<b>{t({ locale: $localeStore, key: 'welcome.nav.public_data' })}</b>
						</span>
					</div>

					<div class="lp-eyebrow-bridge">
						{t({ locale: $localeStore, key: 'welcome.nav.explore' })}
					</div>

					<nav class="lp-menu-links">
						{#each sections as section, i (section.id)}
							<a href="#{section.id}" onclick={closeMenu}>
								<span class="ix">0{i + 1}</span>
								<span class="ltext">{navLabel(section)}</span>
							</a>
						{/each}
					</nav>

					<div class="lp-appearance">
						<span class="lp-appearance-lbl">
							{t({ locale: $localeStore, key: 'a11y.appearance' })}
						</span>
						<div
							class="lp-appearance-dots"
							aria-label={t({ locale: $localeStore, key: 'a11y.appearance' })}
							role="radiogroup"
						>
							{#each themeOpts as o (o.id)}
								<button
									class="lp-appearance-dot lp-app-{o.id}"
									class:active={$theme === o.id}
									aria-checked={$theme === o.id}
									aria-label={o.label}
									data-tooltip={o.label.toUpperCase()}
									onclick={() => theme.set(o.id)}
									role="radio"
									type="button"
								>
									<span class="inner" aria-hidden="true"></span>
								</button>
							{/each}
						</div>
					</div>

					<div class="lp-pill-footer">
						<a class="lp-signin-link" href={PublicPath.SignIn} onclick={closeMenu}>
							{t({ locale: $localeStore, key: 'welcome.nav.already_member' })}
							<span class="em">{t({ locale: $localeStore, key: 'nav.signin' })}</span>
						</a>
						<span class="lp-latin">
							{t({ locale: $localeStore, key: 'welcome.nav.latin_motto' })}
							<span class="acc">Vici.</span>
						</span>
					</div>
				</div>
			{/if}
		</div>

		<!-- Lang popover lives outside `.lp-pill` so it isn't clipped by
		     the pill's `overflow: hidden` + `backdrop-filter` containing
		     block. Anchored under the globe via `position: fixed` using
		     the rect tracked in `langPopPos`. -->
		{#if langOpen && langPopPos}
			<ul
				bind:this={langPopRef}
				style:top="{langPopPos.top}px"
				style:right="{langPopPos.right}px"
				class="lp-lang-pop"
				aria-label={t({ locale: $localeStore, key: 'a11y.language' })}
				role="listbox"
			>
				{#each LOCALES as l (l.id)}
					<li>
						<button
							class="lp-lang-item"
							class:active={$localeStore === l.id}
							aria-selected={$localeStore === l.id}
							onclick={() => setLocaleAndClose(l.id)}
							role="option"
							type="button"
						>
							<span class="num lp-lang-short">{l.short}</span>
							<span class="lp-lang-label">{l.label}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</nav>

{#if menuOpen}
	<button
		class="lp-scrim"
		aria-hidden="true"
		onclick={() => (menuOpen = false)}
		tabindex={-1}
		type="button"
	></button>
{/if}
