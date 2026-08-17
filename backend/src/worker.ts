// Background worker process (the Fly `worker` process in fly.toml): a single
// poll loop over a registry of named jobs.
//
// Job registry pattern: each domain contributes a `WorkerJob` below; a job
// is a named async function that must be IDEMPOTENT (safe to re-run at any
// cadence; dedupe lives in the domain, e.g. the vxp_awards unique key or the
// deposits tx_ref key) and must isolate its own failures (a throw is caught
// and logged per job, it never stalls the others). Later phases drop their
// functions into the placeholder slots: replace the no-op `run` with the
// domain's exported job function, keep the name stable for the logs.
//
// `everyNthTick` throttles a job to every Nth pass of the env-driven poll
// interval (WORKER_POLL_INTERVAL_MS), for sweeps that are cheap to skip.

import { tickDepositWatchers } from './chains/watchers';
import { applyAssetAllowlist } from './custody/assets';
import { env } from './env';
import { logger } from './lib/logger';
import { pruneResolvedResults } from './social/resolved-results';
import { tournamentDrawTick, tournamentResolveTick } from './tournaments/tournaments';
import { isVxpTreasuryDisabled, reconcileUnpaidAwards } from './vxp/awards';
import { backfillStreakUnderpayments } from './vxp/streak';
import { freezeClosedMonth } from './worlds/affiliation-stats';

export interface WorkerJob {
	name: string;
	/** Run the job once. Must be idempotent; thrown errors are isolated. */
	run: () => Promise<void>;
	/** Run only every Nth tick (default 1 = every tick). */
	everyNthTick?: number;
}

const noop = async (): Promise<void> => {
	// Placeholder slot: the owning phase replaces this with its job function.
};

const HOURLY_TICKS = Math.max(1, Math.round((60 * 60 * 1000) / env.workerPollIntervalMs));

export const jobs: WorkerJob[] = [
	{
		// Adapter-enabled gating happens inside the tick: disabled chains are
		// skipped, so an unconfigured deploy stays a clean no-op.
		name: 'deposit-watchers',
		run: () => tickDepositWatchers()
	},
	{
		name: 'prune-resolved-results',
		run: async () => {
			const { pruned } = await pruneResolvedResults();

			if (pruned > 0) {
				logger.info(`pruned ${pruned} resolved-result rows past retention`);
			}
		},
		everyNthTick: HOURLY_TICKS
	},
	{
		// Pays recorded-unpaid awards: the catch-up after a record-only stretch
		// and the retry for grants that died between insert and transfer. A
		// no-op while VXP_TREASURY_DISABLED=1.
		name: 'vxp-award-reconciliation',
		run: async () => {
			const report = await reconcileUnpaidAwards();

			if (report.scanned > 0) {
				logger.info(
					`vxp reconciliation: ${report.paid} paid, ${report.failed} failed of ${report.scanned} pending`
				);
			}
		}
	},
	{
		// Idempotent underpayment remediation for imported streak awards; the
		// backfill marker keys make re-runs skip anything already topped up.
		// Mints only when the treasury is live; in record-only mode the dry-run
		// report still surfaces the shortfall for the logs.
		name: 'vxp-streak-backfill',
		run: async () => {
			const report = await backfillStreakUnderpayments({ dryRun: isVxpTreasuryDisabled() });

			if (report.underpaid > 0) {
				logger.info(
					`streak backfill: ${report.underpaid} underpaid (${report.minted} minted, ${report.alreadyBackfilled} already, shortfall ${report.totalShortfallBaseUnits})`
				);
			}
		},
		everyNthTick: HOURLY_TICKS
	},
	{
		// Account-lifecycle phase: soft-delete retention sweep.
		name: 'deletion-sweep',
		run: noop,
		everyNthTick: HOURLY_TICKS
	},
	{
		// Draws the current month's bracket once enough leagues exist; the
		// tournament primary-key collision keeps every later pass a no-op.
		name: 'tournament-draw',
		run: () => tournamentDrawTick(),
		everyNthTick: HOURLY_TICKS
	},
	{
		// Resolves every closed, still-open round of the latest in-flight
		// tournament; write-once winners make re-runs no-ops.
		name: 'tournament-resolve',
		run: () => tournamentResolveTick(),
		everyNthTick: HOURLY_TICKS
	},
	{
		// Freezes the just-closed Worlds month for both kinds; shares the
		// all-or-nothing month gate with the lazy claim-time freeze, so
		// whichever path runs first owns the month.
		name: 'affiliation-monthly-freeze',
		run: async () => {
			const { monthAnchor, frozen } = await freezeClosedMonth();

			if (frozen > 0) {
				logger.info(`worlds month ${monthAnchor} frozen (${frozen} snapshot rows)`);
			}
		},
		everyNthTick: HOURLY_TICKS
	}
];

let stopping = false;
let allowlistApplied = false;
let tickCount = 0;

/** One worker pass over the job registry. */
export const tick = async (): Promise<void> => {
	if (!allowlistApplied) {
		await applyAssetAllowlist();
		allowlistApplied = true;
	}

	tickCount += 1;

	const due = jobs.filter((job) => tickCount % (job.everyNthTick ?? 1) === 0);

	for (const job of due) {
		try {
			await job.run();
		} catch (err) {
			logger.error(`worker job ${job.name} failed:`, err);
		}
	}
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const run = async (): Promise<void> => {
	logger.info(`worker started (poll interval ${env.workerPollIntervalMs}ms, ${jobs.length} jobs)`);

	while (!stopping) {
		try {
			await tick();
		} catch (err) {
			logger.error('worker tick failed:', err);
		}

		await sleep(env.workerPollIntervalMs);
	}

	logger.info('worker stopped');
};

// Fly sends SIGINT/SIGTERM on stop/deploy: finish the in-flight tick, skip the
// next one, exit cleanly.
process.on('SIGTERM', () => {
	stopping = true;
});
process.on('SIGINT', () => {
	stopping = true;
});

if (import.meta.main) {
	void run();
}
