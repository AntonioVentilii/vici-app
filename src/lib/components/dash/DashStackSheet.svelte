<script lang="ts">
	/**
	 * Stack breakdown sheet — opened from the holdings card. Breaks the stack
	 * into lifetime earned, currently in-play, and referral earnings, then
	 * offers an invite CTA into Arena. Pure presentation: all figures arrive
	 * pre-formatted from the host; referral totals come from the real referral
	 * list (count of settled referrals × the per-referral reward).
	 */
	import { Gift } from '@lucide/svelte/icons';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import { AppPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		/** Total holdings, formatted whole-VXP — the sheet header figure. */
		holdingsDisplay: string;
		/** Lifetime VXP earned (points accumulator), formatted. */
		lifetimeDisplay: string;
		/** Backed VXP currently in play, formatted. */
		inPlayDisplay: string;
		/** VXP earned from referrals, formatted. */
		referralVxpDisplay: string;
		/** Number of settled referrals behind that VXP. */
		referralCount: number;
	}

	let {
		isOpen,
		onClose,
		holdingsDisplay,
		lifetimeDisplay,
		inPlayDisplay,
		referralVxpDisplay,
		referralCount
	}: Props = $props();

	const openInvite = (): void => {
		onClose();
		void goto(resolve(AppPath.Arena));
	};
</script>

<BottomSheet {isOpen} {onClose}>
	<div class="db-sheet">
		<div class="db-sheet-h">
			<span class="db-sheet-title">{t({ locale: $localeStore, key: 'dash.holdings.eyebrow' })}</span
			>
			<span class="db-sheet-bal num">{holdingsDisplay} <em>VXP</em></span>
		</div>
		<div class="db-hd-row">
			<span class="db-hd-k">{t({ locale: $localeStore, key: 'dash.build.sheet_lifetime' })}</span>
			<span class="db-hd-v num">{lifetimeDisplay}</span>
		</div>
		<div class="db-hd-row">
			<span class="db-hd-k">{t({ locale: $localeStore, key: 'dash.build.sheet_in_play' })}</span>
			<span class="db-hd-v num">{inPlayDisplay}</span>
		</div>
		<div class="db-hd-row">
			<span class="db-hd-k">{t({ locale: $localeStore, key: 'dash.build.sheet_referrals' })}</span>
			<span class="db-hd-v num">
				{referralVxpDisplay}
				<em>
					{t({
						locale: $localeStore,
						key:
							referralCount === 1
								? 'dash.build.sheet_referrals_one'
								: 'dash.build.sheet_referrals_many',
						params: { count: referralCount }
					})}
				</em>
			</span>
		</div>
		<button class="db-hd-cta" onclick={openInvite} type="button">
			<Gift aria-hidden="true" size={15} strokeWidth={1.8} />
			{t({ locale: $localeStore, key: 'dash.build.sheet_invite_cta' })}
		</button>
	</div>
</BottomSheet>
