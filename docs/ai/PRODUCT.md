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

The compulsory rules of the economy — earn surfaces, caps, gates, the
anti-farming posture, and the doc-drives-code reconciliation protocol —
live in [`economy.md`](./economy.md). This section is the shipped-behaviour
summary; `economy.md` is the governing policy.

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
suppressed under reduced-motion. The like is **persisted** — it survives
a refresh, and each row shows a count of how many people liked it
(aggregated across all users). Tapping is optimistic: it highlights
immediately and rolls back with an error toast if the write fails. See
[`specs/2026-06-12-feat-friend-feed-reaction-redesign.md`](./spec-driven-development/specs/2026-06-12-feat-friend-feed-reaction-redesign.md)
(the reaction redesign) and
[`specs/2026-06-14-feat-friend-feed-like-persistence.md`](./spec-driven-development/specs/2026-06-14-feat-friend-feed-like-persistence.md)
(persistence + counts).

### Market odds — skeleton while the book loads

A market's YES/NO odds are the live order-book mid. Until that book has
been read the odds are **unknown, not 50%** — the card shows a loading
skeleton (a repeat visit seeds the last-known odds from a local cache
for an instant paint, then upgrades in place). A market whose book is
read but empty shows a neutral dash, never a fabricated coin-flip;
resolved markets show 100% / 0%. The detail page first-paints from a
fast query, then upgrades to the certified read. See
[`specs/2026-06-14-fix-market-odds-skeletons.md`](./spec-driven-development/specs/2026-06-14-fix-market-odds-skeletons.md).

### Market metadata — translated by default, with an original toggle

When a market has a creator/admin-authored translation for the reader's
locale (resolved through the locale fallback chain), the market **detail
page** shows the translated title and resolution clause **by default**. A
small, secondary "View original" control sits under the title; toggling it
reveals the on-chain original and a "View in {language}" control to return.
A market with no translation for the reader's locale shows the original and
renders no toggle. Navigating to another market resets to the translated
view. Translations are read in one bulk call per market. This covers the
detail page only — market cards/Flow and the `description`/outcome fields
are not yet translated in-place. See
[`specs/2026-06-14-feat-market-translation-display.md`](./spec-driven-development/specs/2026-06-14-feat-market-translation-display.md).

### Friendship rules

The product rules for the friend graph. Surfaces: Arena → Friends
(add-friend sheet, incoming/outgoing request lists) and the
leaderboard mini-profile sheet; both route through the same relation
service.

- **Adding.** A friend is added by `@handle` or raw principal. A
  handle resolves by exact, case-insensitive nickname match — no match
  → a "not found" notice suggesting an invite link; resolving to
  yourself is blocked.
- **One relation per pair.** A friendship between two users is a
  single record in one of three states: pending, active, or rejected.
- **Duplicate sends.** Sending while your own request is still pending
  → "request already sent" notice, no duplicate. Sending to an
  existing friend → "you're already friends" notice.
- **Mutual requests auto-friend.** If the other user already sent you
  a pending request, your "add" counts as accepting it — you become
  friends immediately (no second accept step).
- **Reject and retry.** The recipient of a request may reject it. The
  **rejecter** may re-initiate a friendship at any time. The
  **rejected sender** must wait out a cooldown
  (`FRIEND_REQUEST_REJECTED_COOLDOWN_MS` in
  [`relation.constants.ts`](../../src/lib/constants/relation.constants.ts))
  before retrying, and is told the remaining wait ("you can try again
  in …", scaled days → hours → minutes → seconds, rounded up).
- **Cancel.** The sender may cancel a pending request. The cancel is
  version-locked: if the recipient accepts/rejects first, the cancel
  fails instead of racing.
- **Unfriend.** Either side may unfriend at any time; the relation is
  deleted (and league-group admin pairs rebalanced), and re-adding is
  allowed immediately.
- **Follow is separate.** Following someone is a one-way relation that
  never interacts with friendship state.
- **Invites.** Inviting by link rewards both sides via the referral
  bonuses in
  [`referral.constants.ts`](../../src/lib/constants/referral.constants.ts).
- **A league invite implies a friend invite.** Sharing a league invite
  link also carries the sharer's referral code (`?ref=`), so joining the
  league auto-friends the person whose link was used: a brand-new
  sign-up redeems it (friendship + new-user bonus) through the signup
  drain, an existing signed-in user is friended on join (no bonus). A
  plain link with no `?ref=` (sharer has no code yet) just joins the
  league. No opt-out — the friendship is implicit. Decision record:
  [`specs/2026-06-14-feat-league-invite-implies-friendship.md`](./spec-driven-development/specs/2026-06-14-feat-league-invite-implies-friendship.md).
- **Errors.** Known outcomes surface as the specific messages above;
  an unexpected failure shows friendly copy carrying a short technical
  detail so a user screenshot is enough to diagnose.

Decision record:
[`specs/2026-06-12-fix-friend-request-errors-and-reject-policy.md`](./spec-driven-development/specs/2026-06-12-fix-friend-request-errors-and-reject-policy.md).

### Transaction history (Dash)

The holdings sheet on `/dash` links to `/dash/transactions`: a
paginated, filterable feed of every event that changed what the user
owns — bonuses (labelled from the `vxp:<type>:<key>` ledger memo),
prediction stakes (bound to fills), wins/losses/break-evens (realized
cashflow), and external transfers. The header shows the dummy-safe
triple that reconciles by construction — **total = available + in
play** — and the last column is the running **total** balance after
each event, anchored on the live total-holdings figure so the top row
always matches the Dash hero. Placing a prediction is wealth-neutral
(VXP moves into play, total is unchanged), so it carries no signed
amount (`—`); the committed stake shows as "… in play" in the
subtitle. Wins credit the profit, losses debit the stake, break-evens
net zero. Because total never moves on margin shifting in or out of
play, the column reconciles to a clean zero genesis no matter how much
is currently reserved — anchoring on spendable instead drifted the
oldest balances negative by the reserved amount. Wallet ↔ clearing
collateral sweeps never render; only their ledger fee feeds the
balance math. When the full history is loaded (the walk reached the
beginning), a synthetic "Joined Vici" genesis row closes the feed — no
amount, zero balance — marking the account's zero-VXP origin. The
ledger walk is capped (`TRANSACTION_HISTORY_MAX_LEDGER_PAGES`); when
hit, the genesis row is suppressed and a quiet "older history not
shown" footer appears instead. Decision record:
[`specs/2026-06-12-feat-transaction-history.md`](./spec-driven-development/specs/2026-06-12-feat-transaction-history.md).
