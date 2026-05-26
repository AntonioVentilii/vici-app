# Prototype Parity Audit

Source of truth: `../VICI WebApp Beta V1.2/`.

This is the consolidated divergence list from a four-agent deep audit
(2026-05-26). **~270 individual divergences** across **24+ surfaces**.
Each is being addressed in its own commit on the
`feat/beta-v1.2-remodel` branch.

## Status legend

- ⬜ Not started
- 🟨 In progress (commit drafted)
- ✅ Done (commit landed)
- ⏭ Skipped (intentional divergence — see note)

## Tier-C decisions (additive features the prototype doesn't have)

These need a per-item decision before deletion. Default = remove.

| ID   | Surface          | Feature                                                     | Decision          | Note                                                         |
| ---- | ---------------- | ----------------------------------------------------------- | ----------------- | ------------------------------------------------------------ |
| C-1  | Markets list     | Status tabs (`Active / Trending / Expiring / Resolved`)     | ✅ Remove         | Locked in earlier wave                                       |
| C-2  | Markets list     | Global search box                                           | ✅ Remove         | Locked in earlier wave                                       |
| C-3  | Markets list     | "Suggested for you" rail                                    | ⬜ Ask            |                                                              |
| C-4  | Markets list     | "LIVE" pulsing pill in appbar                               | ⬜ Ask            |                                                              |
| C-5  | Markets list     | Hover lift on cards (`hover:-translate-y-0.5`)              | ⬜ Ask            |                                                              |
| C-6  | Sign-in          | Decorative orb radial gradients                             | ⬜ Ask            |                                                              |
| C-7  | Sign-in          | `or` divider between providers                              | ⬜ Ask            |                                                              |
| C-8  | Sign-in          | Internet Identity + Passkey + Dev buttons                   | ⬜ Ask            | Production-needed; might keep with prototype-aligned styling |
| C-9  | Flow             | FlowTopBar (persistent close/progress/streak header)        | ⬜ Ask            |                                                              |
| C-10 | Flow             | LIMIT pill on edge labels (limit-order indicator)           | ⬜ Ask            |                                                              |
| C-11 | Flow             | Suggested badge in meta row                                 | ⬜ Ask            |                                                              |
| C-12 | Flow             | flow-card-rail bottom hint row                              | ⬜ Ask            |                                                              |
| C-13 | Flow card        | True 3D rotateY flip (vs prototype's opacity crossfade)     | ⬜ Ask            |                                                              |
| C-14 | Flow card        | Edge-inset glow on swipe (`box-shadow inset 0 0 60px`)      | ⬜ Ask            |                                                              |
| C-15 | Profile          | Friends row (count + pending badge)                         | ⬜ Ask            |                                                              |
| C-16 | Profile          | ReferralCard                                                | ⬜ Ask            |                                                              |
| C-17 | Profile          | Skill grid (Accuracy/Calls/Wins/Streak)                     | ⬜ Ask            |                                                              |
| C-18 | Profile          | 30-day streak activity heatmap                              | ⬜ Ask            |                                                              |
| C-19 | Settings         | Language selector segmented control                         | ⬜ Ask            | Prototype is English-only by design                          |
| C-20 | Settings         | Inline blocking-leagues link list in delete flow            | ⬜ Ask            | Production need (transfer ownership)                         |
| C-21 | Settings         | Transfer ownership UI in delete flow                        | ⬜ Ask            | Production need                                              |
| C-22 | League detail    | Transfer ownership CTA + modal                              | ⬜ Ask            | Production need                                              |
| C-23 | Account settings | Different intro copy / no provider-specific glyphs          | ⬜ Ask            |                                                              |
| C-24 | Wallet           | Multi-tab production wallet (Send / Receive / History tabs) | ⬜ Ask            | Production-needed — but prototype is a simple mocked view    |
| C-25 | Portfolio        | OpenOrders table                                            | ⬜ Ask            | Production need (limit orders)                               |
| C-26 | Tournament       | (additive UI from us — TBD list)                            | ⬜ Ask            |                                                              |
| C-27 | Friends          | Back-arrow appbar to Profile                                | ⬜ Ask            | Prototype assumes Social tab parent                          |
| C-28 | Layout           | 200ms cross-fade between routes                             | ⏭ Keep           | Confirmed earlier as intentional                             |
| C-29 | Worlds           | Podium prize claim banner                                   | ⬜ Ask            | Production need (real claim flow)                            |
| C-30 | Layout           | DomainSwitch                                                | ✅ Hidden in prod | Locked earlier                                               |

## Surface checklist — A-tier divergences (must-fix)

### Welcome / Landing (8)

- ⬜ Hero LIVE tag pill (uses tokens, not custom CSS pulse)
- ⬜ Missing WC kickoff chip in hero meta row
- ⬜ Hero stats: prototype uses `<span class="num">`; we use `<strong>`
- ⬜ Primary CTA targets (we route to signin, prototype to markets)
- ⬜ Hero visual: replace bespoke `welcome-deck` with real LandingFlowCard port
- ⬜ Missing FAQ section
- ⬜ Hardcoded deck values ("47d", "2.4M", "64%/36%") — drive from real data
- ⬜ Italic accent application on subtitle / lede spans

### Sign-in (14)

- ⬜ Title template / wordmark size + accent color
- ⬜ Missing predictor proof line (`184,000 PREDICTORS · 1,240 CALLS THIS HOUR`)
- ⬜ Sent-state UI ("Check your inbox" with check-mark + Continue + use different email)
- ⬜ Email provider functional vs disabled placeholder (depends on backend scope)
- ⬜ Apple provider functional vs disabled placeholder (depends on backend scope)
- ⬜ Provider button order (Apple / Google / Email per prototype)
- ⬜ Faded "other" providers when email open
- ⬜ Loading state per provider ("Opening Apple…")
- ⬜ "Create an account" CTA copy + routing
- ⬜ Legal block content (2-line w/ links)
- C-7 / C-6 decisions resolve the rest

### Onboarding (22)

- ⬜ Beat 1 — no progress dots header (prototype omits BeatV2Header on Beat 1)
- ⬜ Beat 1 — inline italic accent on "Your call comes next"
- ⬜ Beat 1 — localised team promotion (auto-detect country)
- ⬜ Beat 1 — skip CTA copy + styling (no underline)
- ⬜ **Beat 1.b — entire card** is a stub; needs real OnboardingFirstCallCard (FlowCard port)
- ⬜ Beat 1.b — static "Make your first call." heading above card
- ⬜ Beat 1.b — no progress dots
- ⬜ Beat 1.b — FlowCoach overlay
- ⬜ Beat 2 — "taken" state on pool chips (drive from real leaderboard handles)
- ⬜ Beat 2 — italic accent on `@{name}` in "Available · @handle"
- ⬜ Beat 2 — validation error strings parity
- ⬜ Beat 2 — affiliation chip uses `team.code` + `team.color` direct
- ⬜ Beat 2 — affiliation flag style (`color+'22'` bg + flag emoji)
- ⬜ Beat 3 — heading + subcopy include resolution date + email promise
- ⬜ Beat 3 — summary meta line includes resolves date
- ⬜ Beat 3 — auth row replaces SignInActions with prototype's 3-button stack
- ⬜ Beat 3 — TOS fine-print
- ⬜ Beat 3 — back affordance copy
- ⬜ Sign-in switch link ("Already a member? Sign in") above flow
- ⬜ Beat 2 skip-link copy

### Flow (28)

- ⬜ Front: stake selector hidden for <50 calls; SIZE · VXP display when unlocked
- ⬜ Front: bar+payout split layout (vs two separate boxed prob buttons)
- ⬜ Front: ConsensusCompass on front face
- ⬜ Front: days-left chip in meta row
- ⬜ Front: live WC suffix on tag (MATCHDAY/KICKOFF)
- ⬜ Front: payout role labels (LONG SHOT/FAVORITE)
- ⬜ Front: Trickster pill (contrarian markets)
- ⬜ Front: friends-followed-lean line
- ⬜ Front: sharp signal moved to back only (currently on front)
- ⬜ Front: edge-to-edge `MarketArtwork` (no padding around art frame)
- ⬜ Swipe physics — rot 18, threshold 100px, settle delay 220ms, vibrate 12
- ⬜ Swipe overlay style — full-card overlay with YES/NO/SKIP text
- ⬜ Locked-card nudge interaction
- ⬜ Saved/heart + share buttons on back
- ⬜ Back "Resolves Yes if" block with full-rules toggle
- ⬜ Back full stake-slider parity (vs ladder rungs)
- ⬜ Back three-row "Who's calling what" w/ diff badges + dot grid
- ⬜ Back prior-call section parity
- ⬜ Back live countdown (minute-tick interval)
- ⬜ Back track-record line parity
- ⬜ Back-face swipe still commits
- ⬜ "Why this card now" priority + copy templates
- ⬜ Header gradient + card body radial gradient parity

### Sparkline + event markers (12) ✅ commit `<sparkline>`

- ✅ SVG dimensions (w=240, h=56, +8 overflow)
- ✅ Line + filled area beneath
- ✅ Trailing "Live" dot at right edge
- ✅ Tap-to-reveal event markers (idle pulse → active dotted vertical)
- ✅ Real-date event labels (DAY DOM MONTH · LABEL · ↑/↓)
- ✅ Hint copy when events present but none active
- ✅ All events plotted (not slice(0,2))
- ✅ Stroke color lean-aware (YES/NO)
- ⏭ Event `dir` field: kept `'up' / 'down'` (FE enum stays; only the rendered glyph matches prototype's `↑/↓`)
- ✅ Pulse animation on dots when idle
- ✅ Reset active state on market change
- ✅ Marker Y coordinate uses event day index, not iteration index

### Markets list (14)

- ⬜ Category chips at top (prepend ♥ Saved chip)
- ⬜ Replace status tabs with category-driven filtering (tier C-1 lock)
- ⬜ Move saved toggle from below filters to prepended chip
- ⬜ Add Trending horizontal carousel (when cat='all')
- ⬜ Add Saved horizontal carousel (when cat='all' + saves > 0)
- ⬜ FeaturedCard vs MarketRow split (different cards for rail vs list)
- ⬜ Volume + close eyebrow on list cards
- ⬜ Section heading "All markets / Saved / {label}" with count
- ⬜ List gap density (8px not 12px)
- ⬜ Empty-state copy + "Tap the heart…" instruction
- ⬜ Page header style (24px, no LIVE pill, no count badge)
- ⬜ Tag chip styling (no bg, just colored text)
- C-3, C-4, C-5 decisions

### Market detail (16)

- ⬜ Appbar share + watch buttons
- ⬜ LIVE pulsing pill next to category tag
- ⬜ Hero probability layout (48px YES + 24px NO baseline-aligned + ProbBar)
- ⬜ 7-day chart card w/ period chips (1d/7d/30d/ALL)
- ⬜ Stats grid 2×2 (VOLUME / LIQUIDITY / CLOSES / MY CALL)
- ⬜ Resolution card position (directly below stats, not in tab)
- ⬜ "Top predictors here" mini-leaderboard section
- ⬜ Sticky bottom YES/NO CTA bar
- ⬜ Sheet sizing UX (slider 10-500 step 10 + payout + Lock-in CTA)
- ⬜ Done-state confirmation overlay (blurred + check + "Locked in.")
- ⬜ Category chip in hero (no bg, colored text only)
- ⬜ Hero title size + family
- ⬜ Remove meta grid (settles / time_left / created_by)
- ⬜ Remove duplicate description (hero vs Description tab)
- ⬜ Single linear page (no tabs)
- ⬜ Remove heart toggle from detail hero (prototype has none)
- ⬜ Desktop split column (keep or strip?)

### Dash (15)

- ⬜ Title "Dashboard" not "Dash"; no right action
- ⬜ Hero accuracy block — session-delta + 30d global anchor + streak inline
- ⬜ Time-window chip strip (7d/30d/90d/All)
- ⬜ Holdings card (VXP balance + Backed/Lifetime/This-session + invite-friend CTA)
- ⬜ Accuracy trend sparkline chart
- ⬜ Active calls section — list with urgency timers
- ⬜ By-category breakdown — horizontal bars + pct, sorted desc, only categories with calls
- ⬜ Where you stand grid — Global rank / League rank / Top cat tile
- ⬜ Oracle insight callout
- ⬜ Past predictions — filter chips (All/Won/Lost), 8 rows w/ glyphs + ctx + VXP delta
- ⬜ Next-unlock achievement card
- ⬜ Three disclosure foldouts at bottom
- ⬜ Full-width container (not max-w-64ch)
- ⬜ Remove ComebackBanner (or wire to prototype's auto-grant pattern)
- ⬜ Streak placement inline with accuracy (not separate card)

### Portfolio (10)

- ⬜ Header right action — chart icon only, ghost
- ⬜ Holdings hero card (TOTAL HOLDINGS num + weekly delta + 3-col P&L/accuracy/rank)
- ⬜ Performance chart card with 30d sparkline + +18.4% delta
- ⬜ Allocation card — 5 fixed categories with progress bars
- ⬜ Active positions — entry → current + colored P&L
- ⬜ Recent history — list with WIN/LOSS pill + VXP earned
- ⬜ Section header w/ count
- ⬜ Remove cold-load spinner (prototype seeds data)

### Profile (16)

- ⬜ Appbar — back + settings cog only; no description; no FeaturedEventChip
- ⬜ Identity card archetype-coloured blur halo (140×140 circle, opacity 0.10, blur 20px)
- ⬜ Editable avatar (`<Avatar editable onEdit>` opens shuffle modal)
- ⬜ Inline XP chip with handle
- ⬜ School + country chips inline with handle
- ⬜ Stats line: Lvl + #rank global + accuracy on one row
- ⬜ Streak row: StreakFlame component + week delta
- ⬜ Level bar gradient `archetype.accent → var(--accent)`
- ⬜ Level row in VXP units, not XP
- ⬜ **Affiliations grid (4 slots)** — Uni / Country / City (locked) / Company (locked)
- ⬜ Achievement card content — 36×36 tile, `accent-glow` bg when earned, opacity 0.6 when locked
- ⬜ Achievement sort by progress desc
- ⬜ Oracle weekly insight card — yellow tint, eyebrow + serif-italic + body sub
- ⬜ AvatarEditor modal (full-screen shuffle/save)
- ⬜ Remove Friends row, ReferralCard, Skill grid, 30-day heatmap (tier C)

### Wallet (5 — full reconceptualization)

- ⬜ Header — back + title + history icon (no SectionHeader)
- ⬜ Single centered hero card with VXP eyebrow + 48px num + weekly delta + Open Flow/Back a call row
- ⬜ Recent activity list (6 mock rows in prototype; we'd source from real activity)
- ⬜ Remove Send/Receive tabs (tier C-24 — confirm production-needed first)
- ⬜ Remove CollateralStats secondary card

### Settings (24)

- ⬜ Identity row — add Joined date line; remove archetype chip
- ⬜ Account section — add "Sign-in method" row + "Email" row
- ⬜ Account section — remove Wallet row
- ⬜ Preferences ordering — Appearance → Flow deck → Notifications → Session length → Haptics
- ⬜ Remove Language row (tier C-19)
- ⬜ Appearance picker — 3 swatch tiles (dark/light/peach)
- ⬜ Flow deck segmented control matches prototype shape
- ⬜ Flow deck sub-copy parity
- ⬜ Haptics sub-copy: "Subtle taps on YES/NO commit"
- ⬜ Privacy & security section — re-title (currently just "Privacy")
- ⬜ Add duplicate Privacy section (3 toggles)
- ⬜ Add "Your data" section (Export predictions / Download album)
- ⬜ Legal section — `info` icon for rules (vs CircleQuestionMark)
- ⬜ Toast widget at bottom
- ⬜ About line — version + build number
- ⬜ Sign-out inline confirm (question + Cancel/Sign out)
- ⬜ Delete flow — "Continue →" arrow glyph
- ⬜ Delete flow — Pause 30 days / Contact us mini-buttons in retain block
- ⬜ Remove blocking-leagues link list (tier C-20)
- ⬜ Remove transfer-ownership UI (tier C-21)

### Account settings (8)

- ⬜ Current sign-in method — provider-specific glyph (44×44 tile)
- ⬜ Switch method — 3 ghost buttons (Apple / Google / magic-link), not single signout button
- ⬜ Email card — edit flow (input + "Send magic link" + sent confirmation)
- ⬜ Email card — VERIFIED green mono chip
- ⬜ Padding bottom

### Notifications (8) ✅ commit `<notifications>`

- ✅ Right action — text-only "Mark all read" ghost (allcaps eyebrow font, no border-box)
- ✅ Back destination — Flow (not Settings); back-arrow is borderless ghost
- ✅ Empty state — Bell icon stroke 1.4 + serif-italic + dim body (was already correct)
- ✅ Notification card layout — accent border + dot when unread; 32×32 icon tile (already matched)
- ⏭ Empty filter for zero-call users — depends on `combinedInboxStore` filtering; deferred (inbox is mocked)
- ✅ Tap routing — kind-driven via `notification.href` (already wired)
- ✅ i18n: `notifications.back_settings` → `notifications.back_flow` × 7 locales

### Album (9) ✅ commit `<album>`

- ✅ App bar — "My album" title (existing `album.title` key)
- ✅ Progress card — accent tokens (`var(--color-primary)`)
- ✅ Awards — glyph emblems (◎ ★ ⚡ ⧖ ◐ ⌘) replace lucide icons
- ✅ Tier classes — gold/silver/bronze CSS washes
- ⏭ Award definitions — sharpest-eye/bold-caller/league-founder/top-decile NOT added (requires `evaluateAchievements` extension; tracked as follow-up)
- ✅ Bottom-sheet modal — 64×64 tier-styled emblem tile
- ✅ Detail copy — rich multi-sentence prose (new `.detail` i18n key per achievement, 6 keys × 7 locales)
- ✅ Remove `+XP VXP` prefix on detail
- ✅ Position absolute within screen (not fixed inset)
- ✅ Knock-on: `ProfileDashboard` achievement-rail tiles also use glyph emblems + tier classes (replacing lucide icons)

### Social tabs container (3)

- ⬜ Tab strip — underline style (not pill chips)
- ⬜ Tab persistence — write `'friends'` to storage on legacy migration
- ⬜ Tab-aware `+` — local state (not global store) — _or accept current as cleaner_

### Friends (7+)

- ⬜ Invite hero card — +500 VXP eyebrow, monthly cap line, social-proof row, Share/Copy row
- ⬜ Pending invites section
- ⬜ Friends-ranked list — rank 01,02,…, h2h diff chip, sticky YOU row
- ⬜ Friends feed list — serif-italic market quotes + 👏 reactions
- ⬜ Global ranking link with delta
- ⬜ Friend mini-profile sheet — bottom sheet w/ stats + h2h + Remove
- ⬜ Add-by-handle bottom sheet — @-prefixed input
- ⬜ Remove back-arrow appbar (tier C-27)

### Leagues list (~10)

- ⬜ Appbar `+` only (not Create/Join pill row above list)
- ⬜ Founded/Joined card classification
- ⬜ League-logo-sm gradient + emblem character on each card
- ⬜ Friend overlap row — stacked avatars + "@friend + N more"
- ⬜ Latest-activity preview
- ⬜ Trend chip (↑/↓ rank delta)
- ⬜ Inline copy-invite pill on each card
- ⬜ Trailing "Create a league" + "Join with code" CTA cards
- ⬜ Recommendations section ("FRIENDS ARE IN")
- ⬜ Empty-state — quote + body + two-button row

### League detail (~10)

- ⬜ Head card gradient logo + emblem + N° corner badge
- ⬜ "{memberCount} members · {tier} LEAGUE" line
- ⬜ Inline Invite + Predict buttons in head card
- ⬜ LeagueBoutSection — eyebrow + active-bout card or "Challenge another league →"
- ⬜ Members sticker grid (`<MemberSticker>` tiles)
- ⬜ Leaderboard card w/ This week / All time tabs + top-6 + sticky YOU
- ⬜ Activity feed card
- ⬜ ChallengeLeagueModal (prototype-only modal we're missing)
- ⬜ Settings cog in appbar

### Bouts inbox (~8)

- ⬜ "What's a bout?" intro card (dismissible)
- ⬜ Worlds Universities grouped card (podium tiles)
- ⬜ Worlds Countries grouped card
- ⬜ Monthly Tournament curated card
- ⬜ Group by surface (Worlds / Tournament / your-league) not by state
- ⬜ Remove "Create bout" pill at top (prototype puts it elsewhere)
- ⬜ Side chip style — emblem-tinted, not pill color-mix

### Tournament (~3)

- ⬜ Bracket diagram styling
- ⬜ Round chip color (#B49CFF)
- ⬜ Live timer

### Worlds (~7)

- ⬜ Hero event card — `FIFA WORLD CUP · Live` tags + podium tiles
- ⬜ Scope toggle — "May season · all calls" / "WC Bout · {N}d left"
- ⬜ Top-6 leaderboard with school glyph + members·calls eyebrow + sticky YOU row
- ⬜ Affiliation prompt — "Where did you study?" card
- ⬜ Remove worlds-podium prize card (tier C-29 — production need check)
- ⬜ Remove locked-card UI (prototype has different leave flow)

### Leaderboard (~5)

- ⬜ Scoped tabs (global / friends / league / school)
- ⬜ Rank stripes (gold/silver/bronze classes)
- ⬜ Sticky YOU row

### Info / legal (~3)

- ⬜ Typography (serif vs sans)
- ⬜ TOC sidebar
- ⬜ Eyebrow styling

### Modals (~6 + 1 missing)

- ⬜ CreateLeagueModal — bottom-sheet with grip handle
- ⬜ JoinLeagueModal — bottom-sheet
- ⬜ CreateBoutModal — bottom-sheet
- ⬜ AffiliationPickerModal — bottom-sheet with kind toggle + search
- ⬜ Add ChallengeLeagueModal (missing entirely)
- ⬜ Remove ResolveBoutModal? (prototype infers from state)
- ⬜ Remove TransferOwnershipModal? (tier C — production need check)

## Total

**~270 divergences across 24+ surfaces. ~2-4 weeks of focused work.**

This PR will land them in separate commits as each surface gets its
parity pass. Tier-C decisions are resolved one at a time before the
relevant commit drops.
