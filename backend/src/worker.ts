// Background worker process (the Fly `worker` process in fly.toml). The loop
// and its lifecycle are wired now so the process shape stays stable while the
// domain jobs (sweeps, pruning, scheduled awards) land with their phases; a
// tick with no registered jobs is a deliberate no-op.

import { env } from './env';
import { logger } from './lib/logger';

let stopping = false;
let wake: (() => void) | undefined;

/** One worker pass. Job functions register here as the domains are ported;
 * each must be idempotent and isolate its own failures so one bad job cannot
 * stall the others. */
export const tick = async (): Promise<void> => {
	// no jobs yet
};

/** A sleep the shutdown signal can cut short, so a stop/deploy never waits
 * out the remainder of the poll interval. */
const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => {
		const timer = setTimeout(() => {
			wake = undefined;
			resolve();
		}, ms);

		wake = () => {
			clearTimeout(timer);
			wake = undefined;
			resolve();
		};
	});

const run = async (): Promise<void> => {
	logger.info(`worker started (poll interval ${env.workerPollIntervalMs}ms)`);

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

// Fly sends SIGINT/SIGTERM on stop/deploy: finish the in-flight tick,
// interrupt any pending sleep, exit cleanly.
const stop = (): void => {
	stopping = true;
	wake?.();
};

process.on('SIGTERM', stop);
process.on('SIGINT', stop);

if (import.meta.main) {
	void run();
}
