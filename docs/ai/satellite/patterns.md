# Satellite Patterns

Idiomatic TypeScript patterns for the Juno satellite. If a pattern here
disagrees with code in `src/satellite/`, the code wins (truth hierarchy
in [governance.md](../governance.md)). Update this page in the same PR —
that's the [meta-update rule](../governance.md#meta-update-rule).

## The four primitives

The satellite exposes four primitives, all from `@junobuild/functions`:

| Primitive      | Purpose                                                          | Wired in `index.ts` via                                          |
| -------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| `defineQuery`  | Typed read endpoint, callable from the FE.                       | `export const <name> = defineQuery({ … })`                       |
| `defineUpdate` | Typed write endpoint, callable from the FE.                      | `export const <name> = defineUpdate({ … })`                      |
| `defineAssert` | Pre-write veto on a datastore collection. Throws to reject.      | `defineAssert<AssertSetDoc>({ collections, assert })`            |
| `defineHook`   | Post-write trigger on a datastore collection. Side effects only. | `defineHook<OnSetDoc>({ collections, run })` (and `OnDeleteDoc`) |

Pick the right one:

- **Need to read state by RPC?** `defineQuery`.
- **Need to mutate state by RPC?** `defineUpdate`.
- **Need to validate before a doc write lands?** `assertSetDoc` via
  `defineAssert`.
- **Need to react after a doc write / delete?** `onSetDoc` /
  `onDeleteDoc` via `defineHook`.

## Schema-first

Every `defineQuery` and `defineUpdate` declares its argument shape and
result shape via `@junobuild/schema`:

```ts
export const getProfile = defineQuery({
	args: j.strictObject({
		principalStr: PrincipalTextSchema
	}),
	result: j.strictObject({
		profile: j.optional(UserProfileSchema)
	}),
	handler: ({ principalStr }) => ({
		profile: getProfileFn(principalStr)
	})
});
```

Rules:

- **Always `j.strictObject`** at the top level — extra properties are
  rejected.
- **Reuse `$lib/schema/*.schema.ts`** whenever the FE consumes the same
  shape (so the FE-side schema and the satellite-side schema can never
  drift).
- **Quirk to know:** at the time of writing, the schema layer doesn't
  accept the literal property names `principal` / `query` in some
  positions — use `principalStr` / `queryStr` and re-map inside the
  handler. (See the `TODO` comments in `src/satellite/index.ts`.)
- **`PrincipalTextSchema`** comes from `@junobuild/schema`. Use it for
  every principal-typed arg; don't hand-write a regex.
- **Keep handlers thin.** The function passed to `handler:` should
  immediately delegate to `services/<area>.services.ts`. The schema
  declaration + the dispatch table are the only logic that belongs in
  `index.ts`.

## Wire-format quirk: `Vec<NestedStruct>` results need snake_case

If a typed query returns `j.array(SomeNestedSchema)`, the items land on the
wire in **snake_case** — not the camelCase you'd expect from the schema.
Get this wrong and the canister traps on every read with
`'Error converting from js JsonData into type Candid: missing field
<snake_case_name>'`.

### Why

Sputnik's `JsonData` derive macro generates a mirror struct with
`#[serde(rename_all = "camelCase")]` for fields it wraps, so the JSON↔Rust
handoff normally uses camelCase. **But** the macro only wraps fields
explicitly marked `#[json_data(nested)]`, and Juno's TS→Rust codegen does
**not** add that attribute to `Vec<NestedStruct>` fields. For example:

```rust
// ✅ getProfile — `profile` IS nested → wire format is camelCase
pub struct AppGetProfileResult {
    #[json_data(nested)]
    pub profile: Option<AppGetProfileResultProfile>,
}

// ❌ listLeaderboard — `items` is NOT nested → wire format reverts to
//    the inner struct's original `Deserialize` impl, no rename_all,
//    i.e. snake_case
pub struct AppListLeaderboardResult {
    pub items: Vec<AppListLeaderboardResultItems>,
}
```

So `app_get_profile` works with camelCase, but `app_list_leaderboard`,
`app_search_profiles`, `app_list_friends`, etc. expect snake_case on the
wire.

### The fix that doesn't work

`.transform()` on the result schema is **not** a valid workaround. It
produces a `ZodEffects`, and juno's schema → Rust codegen only accepts
`ZodObject` — it throws
`"Unsupported type: unrepresentable schema (z.symbol, z.undefined, …
are not supported)"`, the CLI's silent `catch{}` swallows it, and the
whole `juno functions build` exits with code 1 producing **zero** files in
`target/deploy/`. (See git history for the Saturday afternoon we lost to
this.) Avoid `.transform()` / `.refine()` / `.passthrough()` anywhere in a
`defineQuery` / `defineUpdate` result schema for the same reason.

### The fix that does work

For every `Vec<NestedStruct>` result, declare a **parallel snake_case wire
schema** in
[`src/satellite/utils/wire-format.utils.ts`](../../../src/satellite/utils/wire-format.utils.ts)
and a matching `toWire…` converter, then use them in `index.ts`:

```ts
// in src/satellite/utils/wire-format.utils.ts
export const UserProfileWireSchema = j.strictObject({
	owner: PrincipalTextSchema,
	total_trades: j.number().default(0), // snake_case here
	// …
	preferences: j
		.strictObject({
			default_amount: j.strictObject({ flow: j.string(), manual: j.string() })
		})
		.optional()
});

export const toWireProfile = (profile: AppProfileLike): WireUserProfile => ({
	owner: profile.owner,
	total_trades: profile.totalTrades ?? 0 // camelCase → snake_case
	// …
});

// in src/satellite/index.ts
export const listLeaderboard = defineQuery({
	result: j.strictObject({
		items: j.array(UserProfileWireSchema) // ← wire schema, not the FE schema
	}),
	handler: () => ({
		items: listLeaderboardFn().map(toWireProfile) // ← convert per item
	})
});
```

juno's codegen reads the wire schema's field names verbatim → the Rust
struct shape is byte-identical to before. The handler emits snake_case →
Zod parse passes through → JSON.stringify produces snake_case → Rust
deserializer is happy.

### When to apply

- **Array results (`j.array(NestedSchema)`)** — always use the wire schema.
  Currently affected: `listLeaderboard`, `searchProfiles`,
  `listMarketTranslations`, `listFriends`, `listFollowers`,
  `listFollowing`, `listFriendRequests`, `listSentFriendRequests`.
- **`Option<NestedSchema>` results** (e.g. `getProfile.profile`) — leave
  camelCase as-is. Juno emits `#[json_data(nested)]` on `Option<T>` so
  the camelCase mirror handles it correctly.
- **Primitive results** (`j.boolean()`, `j.number()`, `j.string()`,
  `j.array(j.string())`, …) — no conversion needed; primitives don't
  trigger the bug.

If the upstream Juno codegen ever starts emitting `#[json_data(nested)]`
on `Vec<NestedStruct>` fields too, the wire schemas become redundant and
can be dropped in one PR — point all the `index.ts` results back at the
FE schemas and delete the converters.

## Hooks — collection dispatch table

The repo's pattern (see
[`src/satellite/index.ts`](../../../src/satellite/index.ts)) is:

1. Declare a `const setDocCollections = [...] as const;` whitelist of
   collections this hook runs for.
2. Derive a TS union type from that array.
3. Map each collection to its handler in a `Record<Union, …>` table
   inside `defineHook`.

```ts
const setDocCollections = [Collection.ACTIVITIES, Collection.PROFILES, Collection.ROLES] as const;

type OnSetDocCollection = (typeof setDocCollections)[number];

export const onSetDoc = defineHook<OnSetDoc>({
	collections: setDocCollections,
	run: async (context) => {
		const fn: Record<OnSetDocCollection, RunFunction<OnSetDocContext>> = {
			[Collection.PROFILES]: onProfileSetForVxpOnboarding,
			[Collection.ACTIVITIES]: onTradeActivityForVxpOnboarding,
			[Collection.ROLES]: syncRoleToEngineOnSet
		};

		await fn[context.data.collection]?.(context);
	}
});
```

Why this shape:

- A new collection added to the whitelist becomes a TS error at the
  dispatch table until it's mapped — the type system enforces "every
  registered collection has a handler".
- Calling `fn[...]?.(context)` makes the hook a no-op for any collection
  that slipped through (defensive against the satellite hot-reloading the
  whitelist).

`defineAssert<AssertSetDoc>` and the `onDeleteDoc` hook follow the same
pattern — keep them consistent.

## Pair every `defineAssert` with a `defineQuery` probe

Write-time guards (`defineAssert`) reject collisions at the door, but
they only fail _after_ the user has invested in typing, signing in, and
hitting save. To close that gap, every assertion that can plausibly
reject for a user-correctable reason (duplicate nickname, taken slug,
quota exceeded, …) should:

1. **Extract the core validator** into a pure function that takes the
   candidate value + optional "exclude self" key and returns a typed
   outcome (`{ available: true } | { available: false; reason: ... }`).
2. **Have the assertion call it** and throw the appropriate user-facing
   message when `available` is `false`. The assertion stays the source
   of truth for what "valid" means.
3. **Expose a `defineQuery` wrapper** that returns the same typed
   outcome, so the FE can render an inline hint (debounced behind every
   keystroke) without parsing thrown strings.

Concrete example: `checkNicknameAvailabilityFn` in
[`src/satellite/services/profile.services.ts`](../../../src/satellite/services/profile.services.ts)
backs both `assertValidNickname` and the
`checkNicknameAvailability` query in
[`src/satellite/index.ts`](../../../src/satellite/index.ts). The FE
service wrapper lives at
[`src/lib/services/profile.services.ts`](../../../src/lib/services/profile.services.ts)
(`checkNicknameAvailability`); the onboarding flow and the profile-edit
form share it.

Two rules:

- The query is a **hint**, not a contract. Never skip the assertion
  even when the probe was `available` — there's always a race window
  between probe and write.
- When the query exposes an `exclude` parameter (typically the
  editor's principal), wire it through to the assertion's "skip my
  own doc" filter so the two layers can never disagree.

## Atomic cancel via version-locked delete

When an endpoint cancels a pending state-machine doc (e.g. retract a
friend request the sender just sent), the cancel must not race with the
counterparty mutating that same doc (e.g. recipient accepting the
request). The Juno datastore exposes exactly one primitive for this:
`deleteDocStore` accepts a `doc.version`, and the canister traps if the
on-chain version moved between read and delete.

```ts
export const cancelFriendRequest = ({ relationId }: { relationId: string }): void => {
	const caller = msgCaller();
	const callerText = caller.toText();

	const doc = getDocStore({
		collection: Collection.RELATIONS,
		key: relationId,
		caller
	});

	if (isNullish(doc)) {
		throw new Error('Relation does not exist');
	}

	const relation = decodeDocData<Relation>(doc.data);

	if (relation.participants[0] !== callerText) {
		throw new Error('Only the sender can cancel a friend request.');
	}

	if (relation.state !== RelationState.PENDING) {
		throw new Error(`Cannot cancel a request in state "${relation.state}".`);
	}

	deleteDocStore({
		collection: Collection.RELATIONS,
		key: relationId,
		doc: { version: doc.version }, // ← version lock = atomicity
		caller
	});
};
```

Rules:

- **Single write, conflict-detecting.** Do not implement cancel as a
  "transition to CANCELLED state via `setDocStore`" — that would be a
  second write that itself races with the recipient's accept. A
  versioned delete is the only single-write move the datastore exposes
  that detects mid-flight conflicts.
- **Validate state in the same handler.** Read → check state &
  ownership → delete in one canister call. The narrow window between
  `getDocStore` and `deleteDocStore` is covered by the version lock.
- **FE refreshes after the catch.** When the trap fires (e.g. the
  counterparty won the race), the FE should still re-fetch the store so
  the UI lands on the real on-chain state (e.g. the request now shows
  under "Active" because accept won). See `handleCancel` in
  [`src/lib/components/social/FriendsList.svelte`](../../../src/lib/components/social/FriendsList.svelte)
  for the pattern.

## Idempotency in hooks

Hooks fire **after** the write, but they can fire more than once
(replays, retries, manual re-saves). Make them idempotent.

- **Diff before acting.** `engine-sync.services.ts` computes the diff
  between the previous and new role and only emits the calls that
  changed. Mirror that style.
- **Treat already-applied results as no-ops.** `RoleAlreadyGranted` /
  `RoleNotGranted` from the registry are silent successes. Wrap them in
  a `Result`-style helper rather than throwing.
- **Log skips, don't fail them.** Use the logger in
  `utils/logger.utils.ts` (`engine_sync_skipped_missing_oracle`,
  `engine_sync_error`, …) so operators can grep Juno Console for the
  failure mode without breaking the hook.

## Soft-delete + lazy hard-delete (no scheduler)

Juno has **no timer primitive**, so any "delete now, purge later"
flow has to model the deferred work as a claim or an admin trigger —
never a scheduled job. The account-deletion flow
([`account.services.ts`](../../../src/satellite/services/account.services.ts))
is the reference shape:

- **Soft-delete = an optional marker field.** `deletedAtMs?: number`
  on the profile schema. PRESENCE means soft-deleted; ABSENCE means
  active. Declare it `j.number().optional()` with **no default** — a
  default would force every legacy/active row to look deleted, and
  absence is the meaningful state. Mirror the field in **both**
  `src/lib/schema/profile.schema.ts` **and**
  `src/satellite/api-schemas.ts` (the encoder trap), and forward it
  verbatim through `withProfileDefaults`.
- **Hide soft-deleted rows from PUBLIC reads, not from the owner.**
  A shared `isSoftDeleted(profile)` helper filters the public query
  endpoints (`listLeaderboard`, `searchProfiles`, `getProfile`).
  `getProfile` knows both the caller and the looked-up principal, so it
  makes the owner an exception — an own-read returns the doc even when
  soft-deleted (matching the FE's raw Juno `getDoc` path, which is also
  never gated) so the FE can still offer recovery.
- **Extract the cascade, parametrise by principal.** The hard-delete
  (`hardDeleteAccountFn({ callerText, callerBytes })`) takes the
  principal explicitly and does **not** call `msgCaller()`, so the
  same code path serves both the lazy purge (on a too-late recovery)
  and the admin sweep (`sweepExpiredDeletions`, gated by `isAdmin`).
  The admin sweep keys each purge off the **doc key**, not the decoded
  `owner` field (profile writes don't enforce `owner === key`), and
  runs `Principal.fromText` + the cascade **outside** the malformed-row
  try/catch so a purge failure is logged + counted as an under-purge
  instead of being silently swallowed as a skipped bad row.
- **Hard-delete must not orphan others — transfer, don't just delete.**
  The cascade's owned-league step deletes a league only when no other
  member remains; if members self-joined during the recovery window it
  **transfers** ownership to a deterministic survivor (first remaining
  `LEAGUE_MEMBERS` row in iteration order) — version-locked re-encode of
  `league.owner` + a version-locked bump of that member row's `role` to
  `owner`. The interactive `deleteMyAccount` has an up-front
  `owns_non_empty_league` guard; the guard-less recovery-expiry + sweep
  paths rely on this transfer.
- **Keep the marker monotonic + the side effects once-only.**
  Re-deleting keeps the EARLIEST `deletedAtMs` so the recovery clock
  can't be reset. Recovery clears the field; both are version-locked
  overwrites. `softDeleteProfile` returns an `alreadyDeleted` flag so
  one-time side effects (the anonymous `EXIT_SIGNALS` churn row) are
  skipped on a re-delete — re-deleting must be idempotent, not
  cumulative.

### Hibernation — the reversible sibling state

Hibernation ("Pause 30 days" — the retention off-ramp offered alongside
delete) is a **fully reversible** state that reuses the same optional-marker
shape but never destroys data:

- **Same marker shape.** `hibernatedAtMs?: number` on the profile schema,
  `optional()` with no default, mirrored in **both**
  `src/lib/schema/profile.schema.ts` and `src/satellite/api-schemas.ts`,
  forwarded verbatim through `withProfileDefaults`. PRESENCE = hibernated.
- **Mutually exclusive with soft-delete.** `hibernateMyAccount` refuses
  (`{ ok: false, reason: 'deleted' }`) on an already-soft-deleted profile —
  the two markers never stack. No profile → `{ ok: false, reason:
'no_profile' }`.
- **Hide the same way, via one combined helper.** Public reads switched
  from `!isSoftDeleted` to `!isPubliclyHidden(profile) = !(isSoftDeleted ||
isHibernated)`. The three public filters (`listLeaderboard`,
  `searchProfiles`, `getProfile`) use `isPubliclyHidden`; the owner's own
  `getDoc` read stays ungated so the FE can offer resume.
- **Stats freeze.** A hibernated user is inactive (no trades → no profile
  writes → no fan-out), so the freeze is mostly natural. The two
  profile-write stat fan-out hooks (`onProfileSetForAffiliationStats`,
  `onProfileSetForLeagueStats`) additionally early-return when the AFTER
  profile `isHibernated` — a defensive guard against a stray write fanning
  a delta. This can't suppress the `resumeMyAccount` write: clearing the
  flag leaves `totalTrades` unchanged (zero delta) and the AFTER profile is
  no longer hibernated.
- **Reversible, not monotonic.** `hibernateMyAccount` keeps the EARLIEST
  `hibernatedAtMs` (mirrors soft-delete) but there's no expiry/sweep —
  `resumeMyAccount` clears the field (destructure-drop + re-encode,
  mirroring how recovery clears `deletedAtMs`) and the account is active
  again. Both are version-locked overwrites.

## Cross-canister calls

When a hook calls another canister (typically the icdc-core registry):

- The actor lives in `$lib/canisters/<canister>.canister.ts`.
- Build it with the satellite's identity. The satellite principal is
  pre-authorised as an `admin` on the Vici engine (see
  [`docs/engine-integration.md`](../../engine-integration.md#engine-admins)).
- **Never reach back into the FE store layer** from a satellite hook —
  the satellite has no access to it.
- **Never** await indefinitely on a remote call inside a hook without a
  guard. If the registry is down, log + return; the next write will
  retrigger.

## Logging

- Use the helpers in
  [`src/satellite/utils/logger.utils.ts`](../../../src/satellite/utils/logger.utils.ts)
  rather than `console.log` directly.
- Prefer **stable string tags** (`engine_sync_error`,
  `engine_sync_skipped_missing_oracle`, …). Operators grep for them in
  the Juno Console.
- Don't log secrets or full doc bodies — log identifiers + the change.

## Do / don't

- ✅ Reuse FE schemas from `$lib/schema/` so the FE and satellite agree.
- ✅ Keep `index.ts` declarative — schemas + dispatch tables only.
- ✅ Make every hook idempotent.
- ✅ Validate principals via `PrincipalTextSchema`.
- ✅ Use the snake_case **wire schemas** from
  [`src/satellite/utils/wire-format.utils.ts`](../../../src/satellite/utils/wire-format.utils.ts)
  for **every** `j.array(NestedSchema)` result, with the matching
  `toWire…` converter in the handler — see the
  [`Vec<NestedStruct>` quirk](#wire-format-quirk-vecnestedstruct-results-need-snake_case)
  section above for the why.
- ❌ Use `.transform()` / `.refine()` / `.passthrough()` in any
  `defineQuery` / `defineUpdate` `args` or `result` schema — juno's
  codegen only accepts `ZodObject` and silently kills the build with no
  output on `ZodEffects`.
- ❌ Import `@junobuild/core` (FE-only).
- ❌ Touch `api-schemas.ts`, `satellite.did`, or
  `satellite_extension.did` by hand — regenerate via
  `npm run juno:functions:build && npm run quality` (the Juno CLI emits
  in its own style; `quality` aligns the output with this repo's
  prettier + eslint config). Commit the regenerated
  `src/satellite/{satellite,satellite_extension}.did`,
  `src/satellite/api-schemas.ts`, **and** `src/declarations/satellite/**`.
  This applies whenever you change a `$lib/schema/*.ts` file imported by
  `src/satellite/index.ts` too — CI's `satellite-schema` job fails on
  any drift.
- ❌ Throw inside a hook for an expected condition. Log + return.
- ❌ Add a hook that mutates the **same** doc that triggered it without
  an explicit termination guard — write loops are a real failure mode.
