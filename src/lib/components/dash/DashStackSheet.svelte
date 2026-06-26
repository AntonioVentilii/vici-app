<script lang="ts">
	/**
	 * Holdings breakdown sheet — opened from the Dash holdings card. Leads with a
	 * "Your VXP" hero equal to total holdings, then a two-segment split bar whose
	 * widths track the available / in-play magnitudes, then two colour-keyed bucket
	 * rows (Available, In play) that sum back to the hero. Pure presentation: the
	 * formatted figures and bigint magnitudes arrive from the host. The invite CTA
	 * opens a native share sheet (clipboard fallback) over the viewer's canonical
	 * referral link rather than routing into Arena.
	 */
	import { nonNullish } from '@dfinity/utils';
	import { Check, ChevronRight, Gift, History } from '@lucide/svelte/icons';
	import { resolve } from '$app/paths';
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { REFERRAL_VXP_BONUS_BASE_UNITS } from '$lib/constants/referral.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { getMyReferralCode } from '$lib/services/referral.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { writeToClipboard } from '$lib/utils/clipboard.utils';
	import { haptic } from '$lib/utils/haptics.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { formatVxpBalance } from '$lib/utils/playground-display.utils';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		/** Total holdings, formatted — the sheet header figure (available + in play). */
		holdingsDisplay: string;
		/** Spendable VXP, formatted — the Available bucket value. */
		availableDisplay: string;
		/** Backed VXP currently in play, formatted — the In play bucket value. */
		inPlayDisplay: string;
		/** Spendable magnitude (base units) — drives the Available split segment width. */
		availableValue: bigint;
		/** Backed magnitude (base units) — drives the In play split segment width. */
		inPlayValue: bigint;
		/** Open calls behind the in-play stake — pluralises the In play sub-label. */
		openCallCount: number;
	}

	let {
		isOpen,
		onClose,
		holdingsDisplay,
		availableDisplay,
		inPlayDisplay,
		availableValue,
		inPlayValue,
		openCallCount
	}: Props = $props();

	const hasAvailable = $derived(availableValue > ZERO);
	const hasInPlay = $derived(inPlayValue > ZERO);
	const hasBar = $derived(hasAvailable || hasInPlay);

	const inPlaySubKey = $derived(
		openCallCount === 0
			? ('dash.build.sheet_inplay_sub_none' as const)
			: openCallCount === 1
				? ('dash.build.sheet_inplay_sub_one' as const)
				: ('dash.build.sheet_inplay_sub_many' as const)
	);

	// Native share over the viewer's canonical `/i/{code}` referral link, with a
	// clipboard-copy + "copied" fallback. Fetched lazily once the sheet opens so a
	// closed sheet never pings the satellite; mirrors the Arena invite hero so the
	// two surfaces share one link and one copy.
	let inviteCode = $state<string | undefined>(undefined);
	let copied = $state(false);
	let copyResetTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		if (!isOpen || nonNullish(inviteCode)) {
			return;
		}

		let alive = true;

		void (async () => {
			try {
				const code = await getMyReferralCode();

				if (alive) {
					inviteCode = code;
				}
			} catch {
				// Guard on `alive` so a late rejection after unmount can't reset
				// state on a destroyed component.
				if (alive) {
					inviteCode = undefined;
				}
			}
		})();

		return () => {
			alive = false;
		};
	});

	const triggerCopyFeedback = (): void => {
		copied = true;

		if (copyResetTimer) {
			clearTimeout(copyResetTimer);
		}

		copyResetTimer = setTimeout(() => {
			copied = false;
		}, 1800);
	};

	const copyInvite = async (url: string): Promise<void> => {
		const ok = await writeToClipboard(url);

		if (ok) {
			triggerCopyFeedback();
			haptic('light-tap');
		}
	};

	// Resolve the referral code on-demand: the lazy `$effect` may not have
	// resolved yet when the first tap lands, so fetch here too rather than
	// no-op. Mirrors the lazy load and shares the same cached service call.
	const resolveInviteCode = async (): Promise<string | undefined> => {
		if (nonNullish(inviteCode)) {
			return inviteCode;
		}

		try {
			inviteCode = await getMyReferralCode();
		} catch {
			inviteCode = undefined;
		}

		return inviteCode;
	};

	const shareInvite = async (): Promise<void> => {
		const code = await resolveInviteCode();

		if (!code || typeof window === 'undefined') {
			return;
		}

		const url = `${window.location.origin}/i/${code}`;

		const shareText = t({
			locale: $localeStore,
			key: 'profile.dashboard.referrals.share_text',
			params: {
				code,
				amount: formatVxpBalance({ value: REFERRAL_VXP_BONUS_BASE_UNITS })
			}
		});
		const shareTitle = t({ locale: $localeStore, key: 'profile.dashboard.referrals.share_title' });

		if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
			try {
				await navigator.share({ title: shareTitle, text: shareText, url });

				return;
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message.toLowerCase() : '';

				if (message.includes('abort')) {
					return;
				}
			}
		}

		await copyInvite(url);
	};
</script>

<BottomSheet {isOpen} {onClose}>
	<div class="db-sheet">
		<div class="db-sheet-h">
			<span class="db-sheet-title"
				>{t({ locale: $localeStore, key: 'dash.build.sheet_your_vxp' })}</span
			>
			<span class="db-sheet-bal num">{holdingsDisplay} <em>VXP</em></span>
		</div>

		{#if hasBar}
			<div class="db-split" aria-hidden="true">
				{#if hasAvailable}
					<span style:flex-grow={Number(availableValue)} class="db-split-seg avail"></span>
				{/if}
				{#if hasInPlay}
					<span style:flex-grow={Number(inPlayValue)} class="db-split-seg inplay"></span>
				{/if}
			</div>
		{/if}

		<div class="db-bucket">
			<span class="db-bucket-dot avail" aria-hidden="true"></span>
			<span class="db-bucket-t">
				<span>{t({ locale: $localeStore, key: 'dash.holdings.available' })}</span>
				<em>{t({ locale: $localeStore, key: 'dash.build.sheet_avail_sub' })}</em>
			</span>
			<span class="db-bucket-v num">{availableDisplay}</span>
		</div>
		<div class="db-bucket">
			<span class="db-bucket-dot inplay" aria-hidden="true"></span>
			<span class="db-bucket-t">
				<span>{t({ locale: $localeStore, key: 'dash.build.in_play' })}</span>
				<em>{t({ locale: $localeStore, key: inPlaySubKey, params: { count: openCallCount } })}</em>
			</span>
			<span class="db-bucket-v num">{inPlayDisplay}</span>
		</div>

		<a
			class="db-hd-link"
			href={`${resolve(AppPath.DashTransactions)}?source=sheet`}
			onclick={onClose}
		>
			<History aria-hidden="true" size={16} strokeWidth={1.8} />
			<span class="db-hd-link-t">
				<span>{t({ locale: $localeStore, key: 'dash.build.sheet_history' })}</span>
				<em>{t({ locale: $localeStore, key: 'dash.build.sheet_history_sub' })}</em>
			</span>
			<ChevronRight aria-hidden="true" size={16} strokeWidth={1.8} />
		</a>

		<button class="db-hd-cta" onclick={() => void shareInvite()} type="button">
			{#if copied}
				<Check aria-hidden="true" size={15} strokeWidth={2.2} />
			{:else}
				<Gift aria-hidden="true" size={15} strokeWidth={1.8} />
			{/if}
			{t({ locale: $localeStore, key: 'dash.build.sheet_invite_cta' })}
		</button>
	</div>
</BottomSheet>

<style lang="postcss">
	.db-split {
		display: flex;
		gap: 3px;
		height: 8px;
		margin-bottom: 16px;
		border-radius: 999px;
		overflow: hidden;
	}

	.db-split-seg {
		flex-basis: 0;
		min-width: 4px;
		border-radius: 999px;
	}

	.db-split-seg.avail {
		background: var(--accent);
	}

	.db-split-seg.inplay {
		background: var(--fg-faint);
	}

	.db-bucket {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 11px 0;
		border-bottom: 1px solid var(--border-base);
		font-family: var(--font-mono);
	}

	.db-bucket-dot {
		width: 9px;
		height: 9px;
		flex-shrink: 0;
		border-radius: 999px;
	}

	.db-bucket-dot.avail {
		background: var(--accent);
	}

	.db-bucket-dot.inplay {
		background: var(--fg-faint);
	}

	.db-bucket-t {
		display: flex;
		flex: 1;
		min-width: 0;
		flex-direction: column;
		gap: 1px;
	}

	.db-bucket-t span {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-base);
	}

	.db-bucket-t em {
		font-style: normal;
		font-size: 11px;
		color: var(--text-muted);
	}

	.db-bucket-v {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-base);
	}
</style>
