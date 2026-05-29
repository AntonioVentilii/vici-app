<script lang="ts">
	import { VXP_STAKE_LADDER, type VxpStake } from '$lib/constants/vxp-economy.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		currentStake: VxpStake;
		atCap: boolean;
		stakePct: number;
		stakeIdx: number;
		yesPct: number;
		noPct: number;
		stakeYesWin: number;
		stakeNoWin: number;
		onStakeRangeChange: (e: Event) => void;
		onSelectStake: (rung: VxpStake) => void;
	}

	let {
		currentStake,
		atCap,
		stakePct,
		stakeIdx,
		yesPct,
		noPct,
		stakeYesWin,
		stakeNoWin,
		onStakeRangeChange,
		onSelectStake
	}: Props = $props();
</script>

<section class={`flow-back-block flow-stake${atCap ? ' is-cap' : ''}`} data-no-card-gesture="true">
	<div class="flow-stake-head">
		<span class="eyebrow flow-stake-label">
			{atCap
				? t({ locale: $localeStore, key: 'card.call_size_cap' })
				: t({ locale: $localeStore, key: 'card.call_size' })}
		</span>
		<span class="flow-stake-value num">
			{currentStake}
			<span class="flow-stake-unit">VXP</span>
		</span>
	</div>
	<div class="flow-stake-slider-wrap">
		<div class="flow-stake-track" aria-hidden="true">
			<div style:width="{stakePct}%" class="flow-stake-fill"></div>
		</div>
		<div style:left="{stakePct}%" class="flow-stake-handle" aria-hidden="true"></div>
		<input
			class="flow-stake-range"
			aria-label={t({ locale: $localeStore, key: 'card.call_size' })}
			max={VXP_STAKE_LADDER.length - 1}
			min={0}
			onchange={onStakeRangeChange}
			oninput={onStakeRangeChange}
			step={1}
			type="range"
			value={Math.max(0, stakeIdx)}
		/>
	</div>
	<div class="flow-stake-pegs" role="radiogroup">
		{#each VXP_STAKE_LADDER as rung (rung)}
			<button
				class="flow-stake-peg num"
				class:is-active={rung === currentStake}
				aria-checked={rung === currentStake}
				onclick={(e) => {
					e.stopPropagation();
					onSelectStake(rung);
				}}
				role="radio"
				type="button"
			>
				{rung}
			</button>
		{/each}
	</div>
	<div class="flow-stake-payout">
		<div class="flow-stake-payout-row">
			<span class="flow-stake-payout-lbl allcaps">
				{t({ locale: $localeStore, key: 'card.if_yes_at', params: { pct: yesPct } })}
			</span>
			<span class="num text-yes">+{stakeYesWin} VXP</span>
		</div>
		<div class="flow-stake-payout-row">
			<span class="flow-stake-payout-lbl allcaps">
				{t({ locale: $localeStore, key: 'card.if_no_at', params: { pct: noPct } })}
			</span>
			<span class="num text-yes">+{stakeNoWin} VXP</span>
		</div>
		<div class="flow-stake-payout-row">
			<span class="flow-stake-payout-lbl allcaps">
				{t({ locale: $localeStore, key: 'card.if_wrong' })}
			</span>
			<span class="num text-no">−{currentStake} VXP</span>
		</div>
	</div>
</section>

<style lang="postcss">
	/* Shared block wrapper (from the FlowCardBack `.flow-back-block` rule)
	   and the section surface (from the grouped `.flow-resolution,
	   .flow-community, .flow-stake, .flow-split` rule) — duplicated here so
	   the extracted section keeps its spacing + surface under Svelte's
	   per-component style scoping. */
	.flow-back-block {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.flow-stake {
		padding: 0.75rem 0.85rem;
		border-radius: var(--r-12);
		border: 1px solid var(--border-base);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		box-shadow: var(--inset-hi);
	}

	/* Cap state: when the user hits the top rung of the stake ladder
	   we flip every accent surface — wash, border, label, value,
	   slider fill, handle, active peg — from laurel to `--no` red so
	   the user feels the upper bound visually instead of having to
	   read it. */
	.flow-stake.is-cap {
		background: linear-gradient(
			180deg,
			rgba(255, 107, 107, 0.06),
			rgba(226, 184, 66, 0.02) 70%,
			transparent
		);
		border-color: rgba(255, 107, 107, 0.3);
	}
	.flow-stake-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}
	.flow-stake-label {
		color: var(--text-muted);
	}
	.flow-stake.is-cap .flow-stake-label {
		color: var(--no);
	}
	.flow-stake-value {
		font-size: var(--t-16);
		font-weight: 700;
		color: var(--laurel);
	}
	.flow-stake.is-cap .flow-stake-value {
		color: var(--no);
	}
	.flow-stake-unit {
		font-size: 9.5px;
		letter-spacing: var(--tracking-allcaps);
		color: var(--text-muted);
		font-weight: 700;
		margin-left: 3px;
	}

	.flow-stake-slider-wrap {
		position: relative;
		height: 22px;
		margin: 0.4rem 0 0.3rem;
	}
	.flow-stake-track {
		position: absolute;
		top: 50%;
		left: 0;
		right: 0;
		transform: translateY(-50%);
		height: 6px;
		border-radius: var(--r-pill);
		background: var(--border-base);
		overflow: hidden;
	}
	.flow-stake-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--laurel), #ffd27a);
		border-radius: inherit;
		transition: width 220ms var(--ease-vici);
	}
	.flow-stake.is-cap .flow-stake-fill {
		background: linear-gradient(90deg, var(--laurel), var(--no));
	}
	.flow-stake-handle {
		position: absolute;
		top: 50%;
		width: 14px;
		height: 14px;
		border-radius: var(--r-pill);
		background: var(--bg-surface);
		border: 2px solid var(--laurel);
		transform: translate(-50%, -50%);
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
		pointer-events: none;
		transition:
			background 220ms var(--ease-vici),
			border-color 220ms var(--ease-vici),
			box-shadow 220ms var(--ease-vici);
	}
	.flow-stake.is-cap .flow-stake-handle {
		background: var(--no);
		border-color: var(--no);
		box-shadow:
			0 0 0 1px var(--no),
			0 3px 8px rgba(255, 107, 107, 0.4);
	}
	.flow-stake-range {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		cursor: pointer;
		margin: 0;
	}

	.flow-stake-pegs {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.35rem;
	}
	.flow-stake-peg {
		appearance: none;
		padding: 0.4rem 0;
		font-size: var(--t-12);
		font-weight: 600;
		color: var(--text-muted);
		background: transparent;
		border: 0;
		border-radius: var(--r-pill);
		cursor: pointer;
		transition:
			color 120ms ease,
			background 120ms ease;
	}
	.flow-stake-peg:hover {
		color: var(--text-base);
	}
	.flow-stake-peg:active {
		background: rgba(242, 236, 220, 0.05);
	}
	.flow-stake-peg.is-active {
		color: var(--laurel);
		font-weight: 700;
	}
	.flow-stake.is-cap .flow-stake-peg.is-active {
		color: var(--no);
	}

	.flow-stake-payout {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border-base);
		margin-top: 0.4rem;
	}
	.flow-stake-payout-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: var(--t-12);
	}
	.flow-stake-payout-lbl {
		color: var(--text-muted);
		font-size: 10px;
		letter-spacing: 0.1em;
	}
</style>
