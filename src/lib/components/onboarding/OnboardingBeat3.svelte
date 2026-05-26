<script lang="ts">
	import SignInProviderStack from '$lib/components/authn/SignInProviderStack.svelte';
	import { featuredEvent } from '$lib/derived/featured-event.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Onboarding · Beat 3 — lock in the record.
	 *
	 * The final beat surfaces a "narrative summary" of the choices
	 * from Beats 1.a + 1.b + 2 (team / side / handle) right above the
	 * auth surface so the journey reads as a complete sentence before
	 * the user authenticates. The auth row itself mounts the existing
	 * production `SignInActions` (Juno II + Google SSO + Passkey +
	 * dev), so this beat is a thin frame, not a reauth implementation.
	 *
	 * Emits `onComplete` once auth resolves. `onBack` returns to
	 * Beat 2 — the handle picker.
	 */
	interface Props {
		participantId: string | null;
		handle: string | null;
		side: 'YES' | 'NO' | null;
		onBack: () => void;
		onComplete: () => void;
		// When `true`, the user is already signed in — the auth provider
		// stack and the ToS paragraph are both redundant. We render a
		// "Finish setup" CTA in the auth slot that calls `onComplete`
		// directly so the parent can persist the picks to their profile.
		authenticated?: boolean;
	}

	const {
		participantId,
		handle,
		side,
		onBack,
		onComplete,
		authenticated = false
	}: Props = $props();

	const event = $derived($featuredEvent);
	const team = $derived(
		participantId === null ? undefined : event.participants.find((p) => p.id === participantId)
	);

	// Final / resolution date formatted in the active locale. We avoid
	// locale-specific date strings in the catalogues by computing the
	// label here and injecting it as a parameter — `Jul 19` in English,
	// `19 jul.` in Spanish, `19 lug.` in Italian, etc.
	const resolvesLabel = $derived(
		new Intl.DateTimeFormat($localeStore, { month: 'short', day: 'numeric' }).format(
			new Date(event.finalAt_ms)
		)
	);
</script>

<section class="ob2-beat ob2-beat-3" aria-labelledby="ob2-beat3-title">
	<header class="ob2-beat-header">
		<span class="ob2-progress" aria-hidden="true">
			<span class="ob2-progress-dot is-filled"></span>
			<span class="ob2-progress-dot is-filled"></span>
			<span class="ob2-progress-dot is-filled"></span>
		</span>
		<span class="allcaps ob2-step-label">
			{t({
				locale: $localeStore,
				key: 'onboarding.beat_label',
				params: { current: 3, total: 3 }
			})}
		</span>
	</header>

	<h1 id="ob2-beat3-title" class="ob2-h1">
		{t({ locale: $localeStore, key: 'onboarding.beat3.title' })}
	</h1>

	<p class="ob2-sub">
		<span class="serif-italic ob2-handle-preview">
			@{handle ?? t({ locale: $localeStore, key: 'onboarding.beat3.handle_placeholder' })}
		</span>
		<span>
			{t({
				locale: $localeStore,
				key: 'onboarding.beat3.sub',
				params: { resolves: resolvesLabel }
			})}
		</span>
	</p>

	{#if team}
		{@const teamColor = team.color ?? 'var(--laurel)'}
		<aside
			style:--team-color={teamColor}
			class="ob2-summary"
			aria-label={t({ locale: $localeStore, key: 'onboarding.beat3.summary_eyebrow' })}
		>
			<div class="ob2-summary-row">
				<span
					style:background="color-mix(in srgb, {teamColor} 13%, transparent)"
					style:color={teamColor}
					class="ob2-summary-flag"
					aria-hidden="true"
				>
					{team.glyph ?? ''}
				</span>
				<div class="ob2-summary-text">
					<p class="ob2-summary-q">
						{t({
							locale: $localeStore,
							key: 'onboarding.beat3.summary_backing',
							params: { team: team.name }
						})}
					</p>
					<p class="ob2-summary-meta num">
						{#if side !== null}
							{t({
								locale: $localeStore,
								key: 'onboarding.beat3.summary_meta_side',
								params: { side, event: event.title, resolves: resolvesLabel }
							})}
						{:else}
							{t({
								locale: $localeStore,
								key: 'onboarding.beat3.summary_meta',
								params: { event: event.title, resolves: resolvesLabel }
							})}
						{/if}
					</p>
				</div>
			</div>
		</aside>
	{/if}

	<div class="ob2-auth-slot">
		{#if authenticated}
			<button class="ob2-btn-primary" onclick={onComplete} type="button">
				{t({ locale: $localeStore, key: 'onboarding.beat3.finish_cta' })}
			</button>
		{:else}
			<SignInProviderStack onSuccess={onComplete} />
		{/if}
	</div>

	{#if !authenticated}
		<p class="ob2-tos">
			{t({ locale: $localeStore, key: 'onboarding.beat3.tos.prefix' })}
			<a class="ob2-tos-link" href="/info/terms" rel="noopener" target="_blank">
				{t({ locale: $localeStore, key: 'onboarding.beat3.tos.terms' })}
			</a>
			{t({ locale: $localeStore, key: 'onboarding.beat3.tos.and' })}
			<a class="ob2-tos-link" href="/info/privacy" rel="noopener" target="_blank">
				{t({ locale: $localeStore, key: 'onboarding.beat3.tos.privacy' })}
			</a>{t({ locale: $localeStore, key: 'onboarding.beat3.tos.suffix' })}
			<span class="serif-italic">
				{t({ locale: $localeStore, key: 'onboarding.beat3.tos.tail' })}
			</span>
		</p>
	{/if}

	<button class="ob2-skip-link" onclick={onBack} type="button">
		{t({ locale: $localeStore, key: 'onboarding.beat3.back' })}
	</button>
</section>

<style lang="postcss">
	.ob2-beat {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.25rem 1.1rem 1.5rem;
		color: var(--text-base);
	}

	.ob2-beat-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.ob2-progress {
		display: inline-flex;
		gap: 6px;
	}

	.ob2-progress-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--border-base);
		transition: background 160ms ease;
	}

	.ob2-progress-dot.is-filled {
		background: var(--laurel);
	}

	.ob2-step-label {
		font-size: var(--t-11, 0.7rem);
		color: var(--text-muted);
	}

	.ob2-h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.5rem, 6vw, 2rem);
		line-height: var(--leading-tight);
		color: var(--text-base);
	}

	.ob2-sub {
		margin: 0;
		font-size: var(--t-14);
		color: var(--text-muted);
		display: inline-flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.4rem;
	}

	.ob2-handle-preview {
		color: var(--laurel);
		font-weight: 600;
	}

	.ob2-summary {
		padding: 0.85rem 1rem;
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		border: 1px solid color-mix(in srgb, var(--team-color) 28%, var(--border-base));
		border-radius: var(--r-12);
	}

	.ob2-summary-row {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}

	.ob2-summary-flag {
		font-size: 1.5rem;
		line-height: 1;
		padding: 0.4rem 0.6rem;
		border-radius: var(--r-pill);
	}

	.ob2-summary-text {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.ob2-summary-q {
		margin: 0;
		font-size: var(--t-14);
		color: var(--text-base);
	}

	.ob2-summary-meta {
		margin: 0;
		font-size: var(--t-12);
		color: var(--text-muted);
	}

	.ob2-auth-slot {
		margin-top: 0.5rem;
	}

	.ob2-btn-primary {
		appearance: none;
		width: 100%;
		padding: 0.85rem 1rem;
		font: inherit;
		font-size: var(--t-14);
		font-weight: 700;
		color: var(--text-on-accent, #fff);
		background: var(--laurel);
		border: 1px solid var(--laurel);
		border-radius: var(--r-12);
		cursor: pointer;
		transition:
			background 140ms ease,
			color 140ms ease,
			border-color 140ms ease;
	}

	.ob2-btn-primary:hover:not(:disabled) {
		background: color-mix(in srgb, var(--laurel) 88%, var(--text-base));
	}

	.ob2-btn-primary:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.ob2-tos {
		margin: 0.5rem 0 0;
		font-size: var(--t-11, 0.7rem);
		line-height: var(--leading-relaxed);
		color: var(--text-muted);
		text-align: center;
	}

	.ob2-tos-link {
		color: var(--text-base);
		text-decoration: underline;
		text-underline-offset: 0.18em;
	}

	.ob2-tos-link:hover {
		color: var(--laurel);
	}

	.ob2-skip-link {
		appearance: none;
		align-self: center;
		margin-top: 0.25rem;
		padding: 0.4rem 0.7rem;
		font: inherit;
		font-size: var(--t-12);
		color: var(--text-muted);
		background: none;
		border: none;
		cursor: pointer;
		text-decoration: underline;
	}

	.ob2-skip-link:hover {
		color: var(--text-base);
	}
</style>
