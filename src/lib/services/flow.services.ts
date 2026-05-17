import { refreshAllBalances, refreshOrders, refreshPositions } from '$lib/utils/refresh.utils';
import { executeOutcomeTrade, type TradeParams } from '$lib/utils/trade.utils';

/**
 * Batches refresh side-effects across a "Flow" session of rapid sequential
 * trades, so the UI re-fetches positions/orders/balances once at the end
 * instead of after every trade.
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

		if (!this.isActive) {
			await tradePromise;
			this.refresh();
		}
	}

	async endSession() {
		this.isActive = false;

		await Promise.allSettled(this.pendingTrades);

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
