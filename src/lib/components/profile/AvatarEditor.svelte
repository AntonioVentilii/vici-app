<script lang="ts">
	import { Check, Shuffle, X } from '@lucide/svelte/icons';
	import { untrack } from 'svelte';
	import { saveMyAvatarParts } from '$lib/stores/avatar.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import { haptic } from '$lib/utils/haptics.utils';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
	import { prefersReducedMotion } from '$lib/utils/reduced-motion.utils';
	import {
		AVATAR_PARTS,
		normalizeParts,
		renderAvatarSvg,
		type ViciAvatarParts,
		type ViciAvatarPartKey
	} from '$lib/utils/vici-avatar.utils';

	interface Props {
		/** The parts to seed the editor with (the user's current avatar). */
		initial: ViciAvatarParts;
		/** Discard and close (the X) — never persists. */
		onClose: () => void;
		/** Persist the draft and close (Done). */
		onSaved?: () => void;
	}

	const { initial, onClose, onSaved }: Props = $props();

	// Draft-then-Done: the editor holds a local draft. The X discards it; only
	// Done persists. Seeded once at open (the sheet is remounted per open), so
	// capturing the prop's initial value is intentional — there's no later
	// `initial` change to track within a single open.
	let draft = $state<ViciAvatarParts>(untrack(() => normalizeParts(initial)));
	let activeTab = $state<TabId>('skin');
	let saving = $state(false);

	type TabId = 'skin' | 'hair' | 'expr' | 'trait' | 'shirt' | 'bg';

	const TABS: ReadonlyArray<{ id: TabId; key: MessageKey }> = [
		{ id: 'skin', key: 'profile.avatar.tab.face' },
		{ id: 'hair', key: 'profile.avatar.tab.hair' },
		{ id: 'expr', key: 'profile.avatar.tab.mood' },
		{ id: 'trait', key: 'profile.avatar.tab.trait' },
		{ id: 'shirt', key: 'profile.avatar.tab.top' },
		{ id: 'bg', key: 'profile.avatar.tab.backdrop' }
	];

	// Per-value option labels — keyed by part then value.
	const optionKey = ({ part, value }: { part: ViciAvatarPartKey; value: string }): MessageKey =>
		`profile.avatar.option.${part}.${value}` as MessageKey;

	const optionLabel = ({ part, value }: { part: ViciAvatarPartKey; value: string }): string =>
		t({ locale: $localeStore, key: optionKey({ part, value }) });

	const set = ({ part, value }: { part: ViciAvatarPartKey; value: string }) => {
		haptic('soft-tick');
		draft = { ...draft, [part]: value };
	};

	const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

	const surpriseMe = () => {
		haptic('double-pulse');
		draft = {
			skin: pick(AVATAR_PARTS.skin),
			hair: pick(AVATAR_PARTS.hair),
			hairStyle: pick(AVATAR_PARTS.hairStyle),
			expr: pick(AVATAR_PARTS.expr),
			trait: pick(AVATAR_PARTS.trait),
			shirt: pick(AVATAR_PARTS.shirt),
			bg: pick(AVATAR_PARTS.bg)
		};
	};

	const done = async () => {
		if (saving) {
			return;
		}

		saving = true;
		haptic('firm-tap');

		try {
			await saveMyAvatarParts(draft);
			onSaved?.();
		} catch (_: unknown) {
			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'profile.avatar.save_failed_title' }),
				message: t({ locale: $localeStore, key: 'profile.avatar.save_failed' }),
				type: 'error'
			});
		} finally {
			saving = false;
		}
	};

	// Plain-language caption under the hero: the mood, and the signature
	// trait (or "no signature trait").
	const caption = $derived(
		draft.trait === 'none'
			? t({
					locale: $localeStore,
					key: 'profile.avatar.caption_plain',
					params: { mood: optionLabel({ part: 'expr', value: draft.expr }) }
				})
			: t({
					locale: $localeStore,
					key: 'profile.avatar.caption',
					params: {
						mood: optionLabel({ part: 'expr', value: draft.expr }),
						trait: optionLabel({ part: 'trait', value: draft.trait })
					}
				})
	);

	// The hero preview animates only when motion is allowed.
	const heroMotion = $derived(!prefersReducedMotion());
	const heroSvg = $derived(
		renderAvatarSvg({
			parts: draft,
			size: 128,
			options: { animate: heroMotion, frame: true, signature: true }
		})
	);

	// A WYSIWYG option tile = the draft with this single change applied,
	// rendered tight (no frame / signature) and static.
	const tileSvg = ({ part, value }: { part: ViciAvatarPartKey; value: string }): string =>
		renderAvatarSvg({
			parts: { ...draft, [part]: value },
			size: 120,
			options: { animate: false, frame: false, signature: false }
		});

	// Escape dismisses the editor (discard — same as the X). Registered on the
	// window so a key press anywhere closes it; SSR-safe via `$effect` (runs
	// only in the browser) and torn down on unmount.
	$effect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onClose();
			}
		};

		window.addEventListener('keydown', onKeyDown);

		return () => {
			window.removeEventListener('keydown', onKeyDown);
		};
	});
</script>

<div
	class="avatar-editor"
	aria-label={t({ locale: $localeStore, key: 'profile.avatar.title' })}
	aria-modal="true"
	role="dialog"
	tabindex="-1"
>
	<!-- Header -->
	<div class="avatar-editor-head">
		<div class="avatar-editor-head-text">
			<h2 class="avatar-editor-title">
				{t({ locale: $localeStore, key: 'profile.avatar.title' })}
			</h2>
			<span class="avatar-editor-sub"
				>{t({ locale: $localeStore, key: 'profile.avatar.subtitle' })}</span
			>
		</div>
		<button
			class="avatar-editor-close"
			aria-label={t({ locale: $localeStore, key: 'profile.avatar.discard' })}
			onclick={onClose}
			type="button"
		>
			<X aria-hidden="true" size={16} strokeWidth={2} />
		</button>
	</div>

	<!-- Live hero -->
	<div class="avatar-editor-hero">
		<span class="avatar-editor-hero-art" aria-hidden="true">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html heroSvg}
		</span>
		<span class="avatar-editor-caption">{caption}</span>
	</div>

	<!-- Tabs -->
	<div class="avatar-editor-tabs" role="tablist">
		{#each TABS as tab (tab.id)}
			<button
				class="avatar-editor-tab"
				class:is-active={activeTab === tab.id}
				aria-selected={activeTab === tab.id}
				onclick={() => {
					haptic('soft-tick');
					activeTab = tab.id;
				}}
				role="tab"
				type="button"
			>
				{t({ locale: $localeStore, key: tab.key })}
			</button>
		{/each}
	</div>

	<!-- Option grid -->
	<div class="avatar-editor-body">
		{#if activeTab === 'hair'}
			<p class="avatar-editor-group-label">
				{t({ locale: $localeStore, key: 'profile.avatar.group.colour' })}
			</p>
			<div class="avatar-editor-grid">
				{#each AVATAR_PARTS.hair as value (value)}
					{@render tile({ part: 'hair', value })}
				{/each}
			</div>
			<p class="avatar-editor-group-label avatar-editor-group-label-second">
				{t({ locale: $localeStore, key: 'profile.avatar.group.style' })}
			</p>
			<div class="avatar-editor-grid">
				{#each AVATAR_PARTS.hairStyle as value (value)}
					{@render tile({ part: 'hairStyle', value })}
				{/each}
			</div>
		{:else}
			<div class="avatar-editor-grid" class:is-wide={activeTab === 'bg'}>
				{#each AVATAR_PARTS[activeTab] as value (value)}
					{@render tile({ part: activeTab, value })}
				{/each}
			</div>
		{/if}
	</div>

	<!-- Sticky footer -->
	<div class="avatar-editor-foot">
		<button class="avatar-editor-surprise" onclick={surpriseMe} type="button">
			<Shuffle aria-hidden="true" size={16} strokeWidth={1.8} />
			{t({ locale: $localeStore, key: 'profile.avatar.surprise' })}
		</button>
		<button class="avatar-editor-done" disabled={saving} onclick={done} type="button">
			{t({ locale: $localeStore, key: 'profile.avatar.done' })}
		</button>
	</div>
</div>

{#snippet tile({ part, value }: { part: ViciAvatarPartKey; value: string })}
	{@const selected = draft[part] === value}
	<button
		class="avatar-editor-opt"
		aria-label={optionLabel({ part, value })}
		aria-pressed={selected}
		onclick={() => set({ part, value })}
		type="button"
	>
		<span class="avatar-editor-opt-art" class:is-selected={selected}>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html tileSvg({ part, value })}
			{#if selected}
				<span class="avatar-editor-opt-check" aria-hidden="true">
					<Check size={11} strokeWidth={3.2} />
				</span>
			{/if}
		</span>
		<span class="avatar-editor-opt-label" class:is-selected={selected}>
			{optionLabel({ part, value })}
		</span>
	</button>
{/snippet}

<style lang="postcss">
	/* Lock background scroll while the full-screen editor is open. */
	:global(body:has(.avatar-editor)) {
		overflow: hidden;
	}

	.avatar-editor {
		position: fixed;
		inset: 0;
		z-index: 120;
		display: flex;
		flex-direction: column;
		background: var(--bg-base);
		color: var(--text-base);
	}

	.avatar-editor-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		padding: calc(14px + env(safe-area-inset-top, 0px)) 18px 10px;
		border-bottom: 1px solid var(--border-base);
	}

	.avatar-editor-head-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.avatar-editor-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--t-18);
		font-weight: 700;
	}

	.avatar-editor-sub {
		font-family: var(--font-mono);
		font-size: var(--t-10);
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.avatar-editor-close {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 6px;
		border: 0;
		border-radius: var(--r-pill);
		background: transparent;
		color: var(--text-base);
		cursor: pointer;
	}

	.avatar-editor-hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 16px 18px 12px;
	}

	.avatar-editor-hero-art {
		display: block;
		width: 128px;
		height: 128px;
		border-radius: 50%;
		overflow: hidden;
		background: var(--bg-surface);
		box-shadow: 0 6px 22px rgba(0, 0, 0, 0.35);
	}

	.avatar-editor-hero-art :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}

	.avatar-editor-caption {
		font-family: var(--font-display);
		font-style: italic;
		font-size: var(--t-13);
		color: var(--text-muted);
	}

	.avatar-editor-tabs {
		display: flex;
		gap: 4px;
		padding: 0 14px 10px;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}

	.avatar-editor-tab {
		flex: 1 0 auto;
		min-width: 64px;
		padding: 8px 12px;
		border: 0;
		border-radius: 9px;
		background: var(--bg-surface);
		color: var(--text-muted);
		font: inherit;
		font-size: var(--t-13);
		font-weight: 700;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background var(--d-state, 120ms) ease,
			color var(--d-state, 120ms) ease;
	}

	.avatar-editor-tab.is-active {
		background: var(--brand);
		color: var(--color-primary-foreground);
	}

	.avatar-editor-body {
		flex: 1;
		overflow-y: auto;
		padding: 6px 18px 24px;
	}

	.avatar-editor-group-label {
		margin: 2px 0 10px;
		font-family: var(--font-mono);
		font-size: var(--t-10);
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.avatar-editor-group-label-second {
		margin-top: 18px;
	}

	.avatar-editor-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
	}

	.avatar-editor-grid.is-wide {
		grid-template-columns: repeat(4, 1fr);
	}

	.avatar-editor-opt {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
	}

	.avatar-editor-opt-art {
		position: relative;
		width: 100%;
		aspect-ratio: 1 / 1;
		border: 2px solid var(--border-base);
		border-radius: 14px;
		overflow: hidden;
		transition:
			border-color var(--d-state, 120ms) ease,
			box-shadow var(--d-state, 120ms) ease;
	}

	.avatar-editor-opt-art.is-selected {
		border-color: var(--brand);
		box-shadow: 0 0 0 3px var(--brand-glow);
	}

	.avatar-editor-opt-art :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}

	.avatar-editor-opt-check {
		position: absolute;
		top: 5px;
		right: 5px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--brand);
		color: var(--color-primary-foreground);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
	}

	.avatar-editor-opt-label {
		font-size: var(--t-11);
		font-weight: 600;
		color: var(--text-muted);
	}

	.avatar-editor-opt-label.is-selected {
		color: var(--text-base);
	}

	.avatar-editor-foot {
		display: flex;
		gap: 10px;
		padding: 12px 18px calc(12px + env(safe-area-inset-bottom, 0px));
		border-top: 1px solid var(--border-base);
		background: var(--bg-base);
	}

	.avatar-editor-surprise {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 12px 16px;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		background: transparent;
		color: var(--text-base);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.avatar-editor-done {
		flex: 1;
		padding: 12px 16px;
		border: 0;
		border-radius: var(--r-pill);
		background: var(--brand);
		color: var(--color-primary-foreground);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.avatar-editor-done:disabled {
		opacity: 0.6;
		cursor: default;
	}
</style>
