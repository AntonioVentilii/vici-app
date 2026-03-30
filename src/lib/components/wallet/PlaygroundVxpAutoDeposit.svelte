<script lang="ts">
	import { isNullish } from '@dfinity/utils';
	import { get } from 'svelte/store';
	import { balance as getLedgerBalance, transactionFee } from '$lib/api/icrc-ledger.api';
	import { ZERO } from '$lib/constants/app.constants';
	import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
	import { depositCollateral } from '$lib/services/collateral.services';
	import { getIdentity } from '$lib/services/identity.services';
	import { balanceDomainStore } from '$lib/stores/balance-domain.store';
	import { getIcrcAccount } from '$lib/utils/transactions.utils';

	/**
	 * Playground-only sweep of VXP ledger balance into clearing (ViciXp).
	 *
	 * Timer + deposit loop lives in `$effect` keyed on `isPlayground`; cleanup clears timeouts and
	 * drops `alive` so async work cannot reschedule after teardown or domain switch.
	 *
	 * Does not run when the tab is closed. In-flight `depositCollateral` cannot be aborted on
	 * unmount. Fee headroom: `2 × ledger fee` (approve + `transfer_from`).
	 */
	const POLL_MS = 10_000;

	const feeReserveMultiplier = 2n;

	const isPlayground = $derived($balanceDomainStore.value === 'playground');

	let inFlight = $state(false);

	$effect(() => {
		if (!isPlayground) {
			return;
		}

		let alive = true;
		let timeoutId: ReturnType<typeof setTimeout> | undefined;

		const clearTimer = () => {
			if (timeoutId !== undefined) {
				clearTimeout(timeoutId);
				timeoutId = undefined;
			}
		};

		const playgroundNow = (): boolean => get(balanceDomainStore).value === 'playground';

		const scheduleNext = () => {
			if (!alive || !playgroundNow()) {
				return;
			}
			clearTimer();
			timeoutId = setTimeout(() => {
				void run();
			}, POLL_MS);
		};

		const run = async () => {
			if (!alive || !playgroundNow()) {
				return;
			}

			if (inFlight) {
				scheduleNext();
				return;
			}

			const identity = await getIdentity();

			if (!alive || !playgroundNow() || isNullish(identity)) {
				scheduleNext();
				return;
			}

			const { ledgerCanisterId } = VXP_TOKEN;
			const account = getIcrcAccount(identity.getPrincipal());

			let rawBalance: bigint;
			let fee: bigint;

			try {
				[rawBalance, fee] = await Promise.all([
					getLedgerBalance({ identity, ledgerCanisterId, account }),
					transactionFee({ identity, ledgerCanisterId })
				]);
			} catch (e: unknown) {
				console.warn('Playground VXP auto-deposit: balance/fee read failed', e);
				scheduleNext();
				return;
			}

			if (!alive || !playgroundNow()) {
				return;
			}

			const reserve = fee * feeReserveMultiplier;
			const amount = rawBalance > reserve ? rawBalance - reserve : ZERO;

			if (amount <= ZERO) {
				scheduleNext();
				return;
			}

			inFlight = true;

			try {
				await depositCollateral({
					assetPrincipal: ledgerCanisterId,
					amount,
					domain: { ViciXp: null }
				});
			} catch (e: unknown) {
				console.warn('Playground VXP auto-deposit failed', e);
			} finally {
				inFlight = false;
			}

			if (!alive || !playgroundNow()) {
				return;
			}

			scheduleNext();
		};

		scheduleNext();

		return () => {
			alive = false;
			clearTimer();
			inFlight = false;
		};
	});
</script>
