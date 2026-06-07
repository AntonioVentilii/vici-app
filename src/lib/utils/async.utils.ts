/**
 * Race a promise against a hard timeout. Resolves/rejects with the
 * operation if it settles first; otherwise rejects with a labelled
 * `Error` after `timeoutMs`.
 *
 * Use this to bound any IC update call whose UI shows a spinner — a call
 * that never resolves *and* never rejects leaves the spinner stuck and
 * the caller's `finally` cleanup unreachable. The `label` flows into the
 * error message so the failure is attributable in logs.
 *
 * Note: this does not cancel the underlying `operation` (promises aren't
 * cancellable) — it only stops the caller waiting on it.
 */
export const withTimeout = <T>({
	operation,
	timeoutMs,
	label
}: {
	operation: Promise<T>;
	timeoutMs: number;
	label: string;
}): Promise<T> =>
	Promise.race<T>([
		operation,
		new Promise<T>((_, reject) => {
			setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
		})
	]);
