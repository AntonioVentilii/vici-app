import { refreshAllBalances, refreshOrders, refreshPositions } from '$lib/utils/refresh.utils';
import { executeOutcomeTrade, type TradeParams } from '$lib/utils/trade.utils';

/**
 * Service to manage trades during a "Flow" session.
 * It batches side-effects like UI refreshes to improve efficiency.
 */
export class FlowTradeService {
	private pendingTrades: Promise<void>[] = [];
	private isActive = false;

	startSession() {
		this.isActive = true;
		this.pendingTrades = [];
	}

	async executeTrade(params: TradeParams): Promise<void> {
		const tradePromise = (async () => {
			try {
				await executeOutcomeTrade(params);
			} catch (e) {
				console.error('Flow trade failed', e);
				throw e;
			}
		})();

		this.pendingTrades.push(tradePromise);

		// If we are not in a formal session, refresh immediately (standard behavior)
		if (!this.isActive) {
			await tradePromise;
			this.refresh();
		}
	}

	/**
	 * Finalize the session and perform a single global refresh of all state.
	 */
	async endSession() {
		this.isActive = false;

		// Wait for all trades to settle (success or failure)
		await Promise.allSettled(this.pendingTrades);

		// Single batch refresh
		this.refresh();

		this.pendingTrades = [];
	}

	private refresh() {
		refreshPositions();
		refreshOrders();
		refreshAllBalances();
	}
}

export const flowTradeService = new FlowTradeService();
