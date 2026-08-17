// Background worker process (the Fly `worker` process in fly.toml). The loop
// and its lifecycle are wired now so the process shape stays stable while the
// domain jobs (sweeps, pruning, scheduled awards) land with their phases; a
// tick with no registered jobs is a deliberate no-op.

import { env } from './env';
import { logger } from './lib/logger';

let stopping = false;

/** One worker pass. Job functions register here as the domains are ported;
 * each must be idempotent and isolate its own failures so one bad job cannot
 * stall the others. */
export const tick = async (): Promise<void> => {
	// no jobs yet
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

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
