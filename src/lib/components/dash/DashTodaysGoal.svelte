<script lang="ts">
	/**
	 * Dash "Today's goal" card — resumes the user's daily call goal.
	 *
	 * Reads the persisted cross-session counter (`dailyGoalDone` /
	 * `dailyGoalDate` on the profile) through `rolloverDailyGoal`, so a
	 * partway session that was left and reopened on the same day still
	 * reflects real progress. When work remains it nudges back into Flow;
	 * once the target is met it settles into a calm "complete" state with
	 * no nudge — the goal is done, not a moment to celebrate loudly.
	 *
	 * Renders nothing before any progress exists today: a cold start is
	 * already covered by the forward-looking hero, so an empty "0 / 10"
	 * card would only add noise.
	 */
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { AppPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { rolloverDailyGoal } from '$lib/utils/daily-goal.utils';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		// Persisted daily-goal counter from the profile.
		done: number;
		date: string | undefined;
		// Calls needed to complete today's goal.
		target: number;
	}

	let { done, date, target }: Props = $props();

	// Client-only ticking clock so the rollover recomputes across local
	// midnight — a dashboard left open overnight must not keep showing
	// yesterday's progress. SSR-safe: the interval only arms in `$effect`,
	// which never runs on the server.
	let now = $state(new Date());

	$effect(() => {
		const id = setInterval(() => {
			now = new Date();
		}, 60_000);

		return () => clearInterval(id);
	});

	// Effective progress for *today* — an earlier day's count reads as 0.
	const todayDone = $derived(Math.min(target, rolloverDailyGoal({ done, date, now })));
	const remaining = $derived(Math.max(0, target - todayDone));
	const complete = $derived(todayDone >= target);
	const pct = $derived(target > 0 ? Math.round((todayDone / target) * 100) : 0);

	const remainingNudge = $derived(
		t({
			locale: $localeStore,
			key: remaining === 1 ? 'dash.goal.remaining_one' : 'dash.goal.remaining_many',
			params: { count: remaining }
		})
	);

	const ariaLabel = $derived(
		complete ? t({ locale: $localeStore, key: 'dash.goal.complete' }) : remainingNudge
	);

	const onContinue = (): void => {
		if (complete) {
			return;
		}

		void goto(resolve(AppPath.Flow));
	};
</script>

{#if todayDone > 0}
	<div class="dash-section">
		<button
			class="dash-goal"
			aria-label={ariaLabel}
			disabled={complete}
			onclick={onContinue}
			type="button"
		>
			<div class="head">
				<span class="ey">{t({ locale: $localeStore, key: 'dash.goal.eyebrow' })}</span>
				<span class="count">
					{t({
						locale: $localeStore,
						key: 'dash.goal.progress',
						params: { done: todayDone, target }
					})}
				</span>
			</div>
			<div class="track"><span style:width="{pct}%" class="fill"></span></div>
			<div class="foot">
				{#if complete}
					<span class="msg done">{t({ locale: $localeStore, key: 'dash.goal.complete' })}</span>
				{:else}
					<span class="msg">{remainingNudge}</span>
					<span class="cta">
						{t({ locale: $localeStore, key: 'dash.goal.continue' })}
						<span aria-hidden="true">→</span>
					</span>
				{/if}
			</div>
		</button>
	</div>
{/if}

<style lang="postcss">
	.dash-goal {
		appearance: none;
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 11px;
		padding: 14px 16px;
		border-radius: 14px;
		border: 1px solid var(--border-base);
		background: var(--bg-surface);
		color: var(--text-base);
		font-family: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 160ms var(--ease-vici),
			transform 160ms var(--ease-vici);
	}

	.dash-goal:not(:disabled):hover {
		border-color: var(--border-strong);
		transform: translateY(-1px);
	}

	.dash-goal:not(:disabled):active {
		transform: translateY(0);
	}

	.dash-goal:disabled {
		cursor: default;
	}

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
	}

	.ey {
		font-family: var(--font-mono);
		font-size: 9.5px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.count {
		font-family: var(--font-mono);
		font-size: var(--text-body-sm);
		letter-spacing: 0.04em;
		color: var(--text-base);
		white-space: nowrap;
	}

	.track {
		height: 6px;
		background: color-mix(in srgb, var(--parchment) 6%, transparent);
		border-radius: 999px;
		overflow: hidden;
	}

	.fill {
		display: block;
		height: 100%;
		background: var(--laurel);
		border-radius: 999px;
		transition: width 420ms var(--ease-vici);
	}

	.foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.msg {
		font-size: var(--text-body-sm);
		line-height: 1.4;
		color: var(--text-muted);
	}

	.msg.done {
		color: var(--laurel);
	}

	.cta {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-family: var(--font-mono);
		font-size: var(--text-eyebrow);
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--laurel);
	}

	@media (prefers-reduced-motion: reduce) {
		.dash-goal,
		.fill {
			transition: none;
		}

		.dash-goal:not(:disabled):hover {
			transform: none;
		}
	}
</style>
