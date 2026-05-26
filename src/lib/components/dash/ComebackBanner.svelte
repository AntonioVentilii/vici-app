<script lang="ts">
	import { Gift } from 'lucide-svelte/icons';
	import { ZERO } from '$lib/constants/app.constants';
	import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
	import { VXP_COMEBACK_GRANT } from '$lib/constants/vxp-economy.constants';
	import { claimComebackGrant, type VxpComebackReason } from '$lib/services/vxp-awards.services';
	import { balancesStore } from '$lib/stores/balances.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { notificationsStore } from '$lib/stores/notification.store';
	import { userStore } from '$lib/stores/user.store';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	// Banner is gated on three signs that the user is in the
	// "comeback" state — signed in, VXP balance loaded and exactly
	// zero. The server validates the engagement gate (≥1 paid
	// onboarding milestone), so we don't duplicate that check here
	// — let the call fall through, render the appropriate reason if
	// the server says "not eligible yet".
	const signedIn = $derived($userStore.user !== undefined);
	const vxpBalance = $derived($balancesStore?.[VXP_TOKEN.id]);
	const balanceIsZero = $derived(vxpBalance !== undefined && vxpBalance === ZERO);
	const dismissed = $state({ value: false });
	const claiming = $state({ value: false });

	const visible = $derived(signedIn && balanceIsZero && !dismissed.value);

	// Toast copy per server reason. The "success" branch is handled
	// separately because it carries a numeric amount param.
	const reasonToastKey: Record<VxpComebackReason, MessageKey> = {
		already_claimed_paid: 'dash.comeback.toast.already_paid',
		already_claimed_pending: 'dash.comeback.toast.pending',
		already_claimed_failed: 'dash.comeback.toast.previously_failed',
		balance_not_zero: 'dash.comeback.toast.not_zero',
		not_engaged_yet: 'dash.comeback.toast.not_engaged',
		transfer_failed: 'dash.comeback.toast.transfer_failed'
	};

	const handleClaim = async () => {
		if (claiming.value) {
			return;
		}

		claiming.value = true;

		try {
			const result = await claimComebackGrant();

			if (result.paidNow) {
				notificationsStore.add({
					title: t({ locale: $localeStore, key: 'dash.comeback.toast.paid_title' }),
					message: t({
						locale: $localeStore,
						key: 'dash.comeback.toast.paid',
						params: { amount: VXP_COMEBACK_GRANT }
					}),
					type: 'success'
				});
				dismissed.value = true;

				return;
			}

			const reasonKey: MessageKey = result.reason
				? reasonToastKey[result.reason]
				: 'dash.comeback.toast.unknown';

			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'dash.comeback.toast.not_paid_title' }),
				message: t({
					locale: $localeStore,
					key: reasonKey,
					params: result.errorMessage ? { reason: result.errorMessage } : undefined
				}),
				type: result.reason === 'already_claimed_paid' ? 'info' : 'warning'
			});

			// If the server says "already paid" or "balance not zero", the
			// banner condition is already wrong on this device — hide it
			// so the user doesn't keep tapping a dead CTA.
			if (result.reason === 'already_claimed_paid' || result.reason === 'balance_not_zero') {
				dismissed.value = true;
			}
		} catch (err: unknown) {
			console.error('ComebackBanner: claim failed', err);

			notificationsStore.add({
				title: t({ locale: $localeStore, key: 'dash.comeback.toast.transport_failed_title' }),
				message: t({ locale: $localeStore, key: 'common.error.generic' }),
				type: 'error'
			});
		} finally {
			claiming.value = false;
		}
	};
</script>

{#if visible}
	<aside
		class="border-laurel-glow bg-laurel-glow/30 text-foreground/90 flex items-start gap-3 rounded-2xl border px-4 py-4"
		aria-live="polite"
		role="status"
	>
		<span
			class="bg-laurel/15 text-laurel mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
			aria-hidden="true"
		>
			<Gift size={18} strokeWidth={1.8} />
		</span>
		<div class="flex min-w-0 flex-1 flex-col gap-1">
			<span class="text-foreground text-sm font-semibold">
				{t({ locale: $localeStore, key: 'dash.comeback.title' })}
			</span>
			<p class="text-muted-foreground text-xs leading-relaxed">
				{t({
					locale: $localeStore,
					key: 'dash.comeback.body',
					params: { amount: VXP_COMEBACK_GRANT }
				})}
			</p>
			<div class="mt-2 flex items-center gap-3">
				<button
					class="bg-laurel hover:bg-laurel-deep text-ink inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60"
					disabled={claiming.value}
					onclick={handleClaim}
					type="button"
				>
					{claiming.value
						? t({ locale: $localeStore, key: 'dash.comeback.cta_pending' })
						: t({ locale: $localeStore, key: 'dash.comeback.cta' })}
				</button>
				<button
					class="text-muted-foreground hover:text-foreground text-xs"
					onclick={() => (dismissed.value = true)}
					type="button"
				>
					{t({ locale: $localeStore, key: 'dash.comeback.dismiss' })}
				</button>
			</div>
		</div>
	</aside>
{/if}
