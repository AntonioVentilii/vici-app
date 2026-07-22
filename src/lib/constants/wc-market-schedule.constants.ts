/**
 * World-Cup question normalization.
 *
 * Historically this module also held a hardcoded `question -> Show Date`
 * release calendar that gated feed visibility. That calendar has been retired:
 * release visibility now derives from each market's on-chain `start_ns`
 * (surfaced as {@link Market.startDate}; see `$lib/utils/wc-schedule.utils`).
 *
 * The one piece that outlived the calendar is {@link normalizeWcQuestion} — the
 * canonical way to key a market by its question text, still used by the Flow-art
 * layer to match art to markets.
 */

/**
 * Normalizes a market question into a stable key: trimmed, internal whitespace
 * collapsed to single spaces, lower-cased. Accents and apostrophes are
 * intentionally preserved — they are part of the team names that distinguish
 * questions.
 */
export const normalizeWcQuestion = (question: string): string =>
	question.trim().replace(/\s+/g, ' ').toLowerCase();
