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
immediately and rolls back with an error toast if the write fails. When
someone likes your call, you get an in-app inbox notification that
deep-links to the market; liking your own call never notifies you, and an
unlike withdraws the card. Multiple likes on the same call collapse into a
single card ("{user} and N more liked your call") rather than one per
liker. See
[`specs/2026-06-12-feat-friend-feed-reaction-redesign.md`](./spec-driven-development/specs/2026-06-12-feat-friend-feed-reaction-redesign.md)
(the reaction redesign),
[`specs/2026-06-14-feat-friend-feed-like-persistence.md`](./spec-driven-development/specs/2026-06-14-feat-friend-feed-like-persistence.md)
(persistence + counts), and
[`specs/2026-06-14-feat-like-received-notifications.md`](./spec-driven-development/specs/2026-06-14-feat-like-received-notifications.md)
(the like-received notification).

### Market odds — skeleton while the book loads

A market's YES/NO odds are the live order-book mid. Until that book has
been read the odds are **unknown, not 50%** — the card shows a loading
skeleton (a repeat visit seeds the last-known odds from a local cache
for an instant paint, then upgrades in place). A market whose book is
read but empty shows a neutral dash, never a fabricated coin-flip;
resolved markets show 100% / 0%. The detail page first-paints from a
fast query, then upgrades to the certified read. See
[`specs/2026-06-14-fix-market-odds-skeletons.md`](./spec-driven-development/specs/2026-06-14-fix-market-odds-skeletons.md).

### Market pricing — maker-liquidity disclosure

The market detail page states, in plain language, where the line comes
from: a live order book that VICI's market maker seeds with resting
liquidity, so the price can move from the first call without implying a
crowd of phantom predictors. The disclosure is a quiet caption under the
stats grid and is mutually exclusive with the cold-start cue — an empty
market shows "your prediction sets the first read"; a market with a line
shows the maker disclosure. See
[`specs/2026-06-20-feat-maker-liquidity-disclosure.md`](./spec-driven-development/specs/2026-06-20-feat-maker-liquidity-disclosure.md).

### Market metadata — translated everywhere, with a global preference and a per-item toggle

When a market has a creator/admin-authored translation for the reader's
locale (resolved through the locale fallback chain), its title, description,
resolution clause, and categorical outcome labels render in that language
**everywhere** — list rows, market cards, the Flow deck (front + back), the
trade modal, share text, and the detail page — not just the detail page.
A single global preference governs the default ("Show markets in your
language" in Settings → Preferences): on (the default) shows translations
where they exist; off always shows the on-chain original. The preference is
client-persisted in `localStorage` (identity-agnostic, like the theme), so
cross-device sync is deferred. On top of that default, every card and the
detail page carry a small quick switch — shown only when a translation
exists — that flips that one item between translated and original without
changing the global preference; the flip is ephemeral and resets on
navigation. A market with no translation for the reader's locale shows the
original and renders no toggle. Rendering a list/deck issues one bulk
translation read for all visible markets (not one per card); changing the
app locale re-resolves every visible translation. Market **search** still
matches against the original text (a follow-up). See
[`specs/2026-06-15-feat-market-translations-everywhere.md`](./spec-driven-development/specs/2026-06-15-feat-market-translations-everywhere.md)
(fast-follow to
[`specs/2026-06-14-feat-market-translation-display.md`](./spec-driven-development/specs/2026-06-14-feat-market-translation-display.md)).

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

### League rank — one accuracy-first ranking everywhere

A member's rank within a league is the same number wherever it is shown:
the leagues-list card badge, the league detail hero (`#N` + the `N°NN`
corner badge), and the detail-page leaderboard list. All three derive
from a single ranking — **prediction accuracy** (win rate) descending,
tie-broken on the longer active streak, then on join order (oldest
first) — defined once in
[`league-rank.utils.ts`](../../src/lib/utils/league-rank.utils.ts). It is
window-independent: the figure is a single lifetime value, so the THIS
WEEK and ALL TIME tabs show the same order (the tabs and the weekly
▲/▼ rank-trend flourish are presentational and do not change the
ranking). A member with no settled prediction sits at 0% and sinks to
the foot rather than riding join order or role to the top. Decision
record:
[`specs/2026-06-15-fix-league-rank-consistency.md`](./spec-driven-development/specs/2026-06-15-fix-league-rank-consistency.md).

### Battles — accuracy face-offs that resolve themselves

A **battle** is a time-bound accuracy face-off between two leagues. The
owner of one league proposes; the challenged league's owner **accepts or
declines**, and an unanswered proposal **expires** after a fixed
respond-by window (3 days). For a league battle, **accepting starts the
clock** — the proposer picks only a duration (7 / 14 / 30 days), and the
N-day window runs from the moment of acceptance (accept fuses the old
separate kickoff). The forward-only lifecycle is therefore **proposed →
in_flight → resolved**, with **declined** and **expired** as terminal
ends of an unaccepted proposal. A league may run **any number of battles
at once** (a far client-side rail of 100 simultaneous live battles
guards against abuse); incoming challenges surface as a "Battle requests"
list on the league page even while other battles are live, so a busy
league can still accept or decline. Because Juno docs aren't pushed live
across users, the proposer is told their challenge was accepted or
declined via an inbox notification derived from the battle's own state.
(Duels — principal-vs-principal — keep the older **proposed → accepted →
in_flight → resolved** manual-score path and aren't user-creatable yet.)

**Live battles are discoverable, and you can see who's winning before
they resolve.** Every battle under way across your leagues appears in a
**Live battles** list in the Arena → Battles tab, and the live cards on a
league's page link there too; each row opens the battle detail page. That
page shows **provisional standings** while a battle is `in_flight` — each
side's running window accuracy (`Δwins / Δcalls` against the kickoff
baseline), with the current leader highlighted — computed read-only on
the same arithmetic resolution uses, so it never alters the battle or
triggers an early resolve. It's labelled provisional and keeps moving as
each side predicts, until the window closes and the write-once resolved
score takes over.

**Who can challenge whom is governed by league privacy.** Only **OPEN**
leagues are discoverable in challenge search and challengeable by
outsiders; a league you are **already a member of** is always
challengeable regardless of its privacy. INVITE and PRIVATE leagues
never surface as opponents to non-members. You must own the side you
challenge from. Privacy is **discovery-only**: changing a league's
privacy after a battle exists never retracts or alters it — a battle's
identity freezes at proposal and it runs to resolution; tightening
privacy just removes the league from future challenge search.

**The score is each league's prediction accuracy over the window, and
nobody types it.** At kickoff the satellite snapshots each league's
`league_stats` counters (for the battle's category scope — `'all'` or a
single market tag) as a baseline. At resolution the window result is the
delta between the current counters and that baseline: `accuracy =
Δwins / Δcalls`, as a percentage. Higher accuracy wins; an equal-accuracy
tie breaks toward the league that made **more** predictions; a remaining
tie — or both leagues making zero predictions in the window (a **void**
face-off) — is a draw. This matches the accuracy-first league-rank metric
so a battle and the leaderboard tell the same story. Resolution is
**trustless**: the `battles` assert independently re-derives the scores
and winner from `league_stats` and rejects any write whose numbers don't
match, so no owner can post a fabricated result. Because Juno has no
scheduler, a settled battle resolves **lazily** — the first time a side
owner opens the battle (or the league) after the window closes, with a
one-tap "Resolve now" as a manual fallback. **Known limitations (by
design):** the snapshot delta measures kickoff → resolution rather than
the exact window, so prompt (auto) resolution keeps it ≈ the intended
window — the same approximation the monthly tournament already uses; and
the optional VXP **wager** is a displayed stake only, not yet moved
between leagues on resolution. Decision record:
[`specs/2026-06-15-feat-battle-auto-resolution.md`](./spec-driven-development/specs/2026-06-15-feat-battle-auto-resolution.md).

### Flow daily swipe cap — server-authoritative

The Flow daily cap (15 swipes/day — the daily-ten goal plus the +5
Push-to-15 overtime) is counted on the **satellite**, not the client. A
committed swipe calls `recordFlowSwipe`, sending only the client's local
day key (`YYYY-MM-DD`); the server reads the caller's own profile, rolls
over by that key, and writes the capped increment **itself** — the client
never sends a count, so it can't reset or inflate the total. A
monotonic-per-day assert on the `profiles` collection rejects any direct
client write that lowers the day's count or pushes it past the cap. The
result: the "come back tomorrow" takeover holds across reloads, cleared
storage, sign-outs, and device switches — losing the localStorage mirror
(now only an offline hint that can never raise the count above the server
value) no longer hands a fresh allotment. **Known limitation (by
design):** Flow orders go from the client straight to the agnostic
clearing engine, so this fixes the reported honest-client reset leak, not
adversarial bypass — a crafted client that skips the satellite call (or
forges a different day key) could still place an order. Closing that would
require routing orders through the satellite or an engine-side limit, a
separate larger change. Decision record:
[`specs/2026-06-15-fix-flow-daily-cap-server-authoritative.md`](./spec-driven-development/specs/2026-06-15-fix-flow-daily-cap-server-authoritative.md).

### Flow earn surfaces — milestone and overtime VXP are credited for real

Two Flow grants now credit real VXP, not just a display number. Crossing a
lifetime call-count milestone (10 / 100 / 500 / 1000 → 50 / 100 / 250 / 500
VXP) pays once each ever; reaching the daily hard cap ("overtime") pays 25
VXP once per local day. Both mint through the existing `vxp_awards`
pending→paid path: the milestone from a `profiles` hook off the lifetime
call count, the overtime inline in `recordFlowSwipe` (its counter write
fires no hook). Counts are client-trusted — the same model as the streak
and Worlds-podium awards — so the overtime mint carries a rolling-window cap
to bound farming. Earlier these grants were display-only by design (the
"deflation-safe economy pass" deliberately withheld the credit); this is the
deferred real-credit path. Decision record:
[`specs/2026-06-20-feat-flow-milestone-overtime-vxp-credit.md`](./spec-driven-development/specs/2026-06-20-feat-flow-milestone-overtime-vxp-credit.md).

### Onboarding — picks persist across every sign-in provider

A new user's onboarding picks — backed team/country, first call, handle,
and the completion flag — land on the new profile no matter which sign-in
provider finishes the 3-beat flow. The picks are stashed to local storage
the moment the user reaches the auth step (Beat 3), **before** any
provider runs, so a full-page OAuth redirect (Google) can't carry off the
volatile in-flight state — the post-sign-in drain reads the stash and
applies it. The "is this a brand-new account?" decision the drain uses to
avoid overwriting a returning user's saved profile is anchored to whether
this browser session bootstrapped the profile, not a reactive flag a
second auth pass could flip — so a genuine new user's picks are never
dropped, and a genuine returning user's profile is never clobbered. The
flow emits the `onboarding_completed` analytics event with the finishing
provider and whether a team was persisted. Decision record:
[`specs/2026-06-18-fix-onboarding-picks-persist-across-providers.md`](./spec-driven-development/specs/2026-06-18-fix-onboarding-picks-persist-across-providers.md).

### Add to Home Screen — install VICI as an app

A mobile user can add VICI to their home screen so it launches
full-screen, like a native app. The ask appears in two calm,
non-interruptive places and **never** as an auto-popup over Flow: a
permanent **Settings → Preferences** row and a contextual **install row on
the end-of-session summary** (`FlowEnd`). The install sheet adapts to the
platform: on Android/Chrome it captures the browser's `beforeinstallprompt`
(suppressing the mini-infobar) and a single CTA replays it as the native
one-tap install dialog; on iOS — where no install API exists — it shows the
two manual steps (tap Share, then choose Add to Home Screen). Once
installed (the native accept, the `appinstalled` event, or a later launch
detected as standalone) every prompt is suppressed.

Both surfaces are gated on `canInstall` (mobile, not already installed, not
already running standalone), so they are hidden on desktop and inside an
installed PWA. The Settings row is always available when `canInstall`
holds; the FlowEnd row additionally honours trigger thresholds — it appears
at a lifetime call count of 15 or more, or 10 or more on a second-or-later
visit — and respects a 14-day cool-off after a dismissal plus a
once-per-session guard. The install funnel is instrumented with
`pwa_install_prompted` / `_accepted` / `_dismissed`, carrying the
originating surface and the platform. The manifest, icons, iOS meta, and
the pre-paint standalone/iOS detection in `app.html` were already shipped;
this layer adds only the install behaviour. Decision record:
[`specs/2026-06-25-feat-pwa-install.md`](./spec-driven-development/specs/2026-06-25-feat-pwa-install.md).
