# Vici — Product Description

Living description of Vici's shipped product behaviour. Read this for
**what the product does**; the sibling `docs/ai/**` pages cover **how
to build it**. Implementing agents read it before building a spec (see
[`spec-driven-development/workflow.md`](./spec-driven-development/workflow.md)).

**Maintenance:** update this page in the **same PR** as any behaviour
change, written by the implementer while the context is fresh.
Statements here describe `main`. If this page and the code disagree,
the code wins — fix the page in your PR (see the
[truth hierarchy](./governance.md#truth-hierarchy)).

## What is Vici

Vici is a social prediction-market platform on the Internet Computer.
Users make predictions on binary markets by staking VXP (Vici's ICRC
ledger token), and compete through leagues, leaderboards, and arena
battles. The SvelteKit frontend and its TypeScript serverless
functions run on a Juno satellite; order matching, clearing, and
settlement run on the on-chain risk engine in the separate `icdc-core`
repo, consumed here via generated Candid bindings (Vici is registered
there as engine `eng_0` — see
[`docs/engine-integration.md`](../engine-integration.md)).

Terminology: always **"prediction"**, never "bet".

## VXP — two different numbers share the name

- **Wallet / dash "VXP"** is the ICRC ledger token balance. Holdings =
  available (in the wallet) + backed (reserved as clearing collateral
  for open predictions). Stakes are not subtracted from holdings —
  they move from available to backed.
- **Profile / leaderboard "VXP"** is the lifetime points score that
  drives level and rank. It only ever grows and is **not** the token
  balance.

VXP has 4 decimals: compare and transfer in base units
(`parseToken`), display in whole VXP.

## VXP economy

Earn-only, by design: there are **no VXP sinks**. Nothing charges VXP
— league creation is free (founding _awards_ VXP), and the only
outflow is prediction stakes, which are clearing collateral, not a
fee.

Earn surfaces: onboarding grant, referrals (referee + referrer),
daily-streak milestones, calibration recovery, comeback restore,
achievement unlocks, league founding, worlds podium, tournament
prizes.

Every award is a **real ICRC ledger transfer**, recorded in the
`vxp_awards` collection with lifecycle `pending → paid | failed` — not
a cosmetic counter (the lifetime `points` score above is the separate
number).

All amounts, caps, and gates live in three canonical constants files —
never restate the numbers anywhere else (docs, specs, comments):

- [`vxp-economy.constants.ts`](../../src/lib/constants/vxp-economy.constants.ts)
  — master parameter file (stake ladder, streaks, calibration,
  comeback, podium, league founder, …)
- [`referral.constants.ts`](../../src/lib/constants/referral.constants.ts)
  — referral bonuses, tier curve, caps, signup window
- [`vxp-onboarding.constants.ts`](../../src/lib/constants/vxp-onboarding.constants.ts)
  — registration grant

Implementation invariants and the new-award-type checklist live in
[`satellite/economy.md`](./satellite/economy.md).

## Behaviour index

Grow this list one entry per behaviour-changing PR — a short
subsection or a link to the governing spec / doc. Do not bulk-generate
it from the code.

### Friend activity — tap to "like" a friend's call

Each row of the Arena → Friends activity feed carries a single
tap-to-react "like" (a `Zap` glyph). Tapping toggles it on/off and
plays a brief tilt + laurel particle burst on commit; the motion is
suppressed under reduced-motion. The reaction is local to the session —
there is no persisted reaction model yet. See
[`specs/2026-06-12-feat-friend-feed-reaction-redesign.md`](./spec-driven-development/specs/2026-06-12-feat-friend-feed-reaction-redesign.md).
