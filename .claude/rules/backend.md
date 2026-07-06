# Backend / canisters (Claude pointer)

`docs/ai/` is the source of truth. This card only surfaces a few
high-violation reminders so they land in Claude's prompt — for anything
substantive, read the canonical docs.

**Read first:**

- Backend pointer (default rule, engine integration, regenerating
  bindings) →
  [`docs/ai/backend/README.md`](../../docs/ai/backend/README.md)
- Engine architecture + role mapping →
  [`docs/engine-integration.md`](../../docs/engine-integration.md)
- Cross-repo PR flow →
  [`docs/ai/pr-and-ci.md#9-cross-repo-changes-icdc-core`](../../docs/ai/pr-and-ci.md#9-cross-repo-changes-icdc-core)
- Upstream Rust canisters →
  [`../icdc-core/AGENTS.md`](../../../icdc-core/AGENTS.md)

**Easy-to-miss rules:**

- **The Rust risk engine does not live here.** It's in
  [`../icdc-core/`](../../../icdc-core/); this repo only consumes its
  Candid surface via generated bindings.
- **Don't hand-edit `src/declarations/**`** — regenerate via `npm run
did` and commit the result with the FE wiring change.
- **Don't modify `../icdc-core/` from this repo** — open it as its own
  workspace and obey its `AGENTS.md`. When you come back to wire the
  new method, do it in a separate PR here.
- **Engine model:** Vici registers as engine `eng_0` on the icdc-core
  registry — read [engine-integration.md](../../docs/engine-integration.md)
  before touching any market / oracle path.
