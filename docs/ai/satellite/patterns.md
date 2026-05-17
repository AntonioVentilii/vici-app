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
- ❌ Import `@junobuild/core` (FE-only).
- ❌ Touch `api-schemas.ts`, `satellite.did`, or
  `satellite_extension.did` by hand — regenerate via
  `npm run juno:functions:build && npm run quality` (the Juno CLI emits
  in its own style; `quality` aligns the output with this repo's
  prettier + eslint config). Commit the regenerated
  `src/satellite/{satellite,satellite_extension}.did`,
  `src/satellite/api-schemas.ts`, **and** `src/declarations/satellite/**`.
  This applies whenever you change a `$lib/schema/*.ts` file imported by
  `src/satellite/index.ts` too — CI does not yet re-run the build, so
  reviewers must enforce it (forgetting it ships a stale Candid surface
  that traps `app_get_profile` and friends on every call).
- ❌ Throw inside a hook for an expected condition. Log + return.
- ❌ Add a hook that mutates the **same** doc that triggered it without
  an explicit termination guard — write loops are a real failure mode.
