import type { AffiliationStatsDoc } from '$lib/types/affiliation-stats';

/**
 * Lifetime accuracy of an affiliation as a 0..1 ratio. Returns `0`
 * when no calls have resolved yet (avoids a divide-by-zero).
 */
export const affiliationLifetimeAccuracy = (stats: AffiliationStatsDoc): number =>
	stats.totalCalls > 0 ? stats.wins / stats.totalCalls : 0;

/**
 * Current-month accuracy of an affiliation as a 0..1 ratio. Returns
 * `0` when no calls have resolved in the active month.
 */
export const affiliationMonthlyAccuracy = (stats: AffiliationStatsDoc): number =>
	stats.monthTotalCalls > 0 ? stats.monthWins / stats.monthTotalCalls : 0;

/**
 * Format a 0..1 accuracy as a one-decimal percentage string (e.g.
 * `72.5%`).
 */
export const formatAccuracyPercent = (accuracy: number): string =>
	`${(accuracy * 100).toFixed(1)}%`;
