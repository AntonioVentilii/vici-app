# PR & CI

Everything an agent needs to open a green PR.

## 1. PR title

The repo follows [Conventional Commits](https://www.conventionalcommits.org/),
with a **required scope**. Templates:

- `feat(collateral): use nanoid for operation IDs`
- `fix(collateral): use nanoid for operation IDs (replaces insecure Math.random fallback)`
- `feat(market): count docs instead of list`
- `fix(market): resolution & settlement UX`
- `chore(deps): update and pin bindgen`
- `chore(npm-deps-dev): bump @junobuild/config from 3.0.0 to 3.0.1`
- `docs(readme): replace Motoko mention with Rust`

Pattern: `type(scope): description` — the scope is **required** (the `pr-title` check rejects a scopeless title).

### Verbs

| verb       | when                                                         |
| ---------- | ------------------------------------------------------------ |
| `feat`     | new user-visible feature                                     |
| `fix`      | bug fix                                                      |
| `refactor` | internal change with no behaviour change                     |
| `style`    | visual / CSS only — no logic change                          |
| `perf`     | performance improvement                                      |
| `docs`     | docs only (incl. `docs/ai/**`, `README.md`, …)               |
| `test`     | tests only                                                   |
| `chore`    | misc maintenance (dependency bumps, release housekeeping, …) |
| `build`    | build system / packaging                                     |
| `ci`       | CI workflows / actions                                       |

### Scope

Single word or comma-separated list of affected areas. Use the existing
vocabulary so it shows up grouped in changelogs. Common scopes from history:

- `frontend`, `collateral`, `market`, `wallet`, `satellite`, `engine`,
  `npm-deps`, `npm-deps-dev`, `juno-kit`, `lint-kit`, `ci`, `ai` (for
  `docs/ai/**` updates).

If you introduce a new scope, keep it short and lowercase, no spaces.

### Breaking changes

If your change breaks the public Candid interface of the satellite
(`src/satellite/satellite.did`, `src/satellite/satellite_extension.did`)
or the `juno.config.ts` collection rules, mark the title with `!`:

```
feat(satellite)!: change profile schema field name
```

…and add a `BREAKING CHANGE:` block in the body explaining the migration.

## 2. PR body — template

Honor [`.github/pull_request_template.md`](../../.github/pull_request_template.md)
— three sections, `# Motivation` / `# Changes` / `# Tests`, with per-section
guidance embedded as comments in the template itself.

Rules:

- **All three sections are required.** Don't leave them empty. Even a tiny PR fills each section with at least one line.
- **Use the exact section headings** (`# Motivation`, `# Changes`, `# Tests`) so downstream tooling (release notes, search, changelog grep) can find them.
- **Concise but complete.** A reviewer should understand what changed and why without opening the diff. Motivation: 1–3 sentences. Changes: one bullet per logical change, outcome first. Cut anything that doesn't change what the reviewer does next.
- **Write what the diff can't say.** Don't narrate the diff line by line — it's attached. Spend the words on the why, the trade-offs considered, and what was deliberately left out of scope.
- **No filler.** Drop openers like "This PR…" / "In this change…" — start with the substance.
- **Tests are concrete.** Name the commands run and their outcome, the tests added, the manual steps taken. "Tests pass" alone says nothing.
- **Do not hard-wrap lines.** Write one line per paragraph or list item and let the GitHub renderer wrap. Hard-wrapping at ~80 columns (a default many models fall back to) breaks rendering inside lists, blockquotes, and tables, and makes later edits in the GitHub UI ugly. This applies to the PR body only — source files still follow `.prettierrc`.
- **Atomicity statement** if the PR touches more than one logical thing — add a one-liner explaining why they belong together. If you can't, split.
- **Mention `docs/ai/` updates** under `# Changes` whenever the [meta-update rule](./governance.md#meta-update-rule) fired.
- **Screenshots are welcome** for visual changes — link them; don't paste giant base64 in the body.
- **For interface-breaking changes** (satellite `.did`, `juno.config.ts` collections), include a `BREAKING CHANGE:` block in `# Changes` listing what callers / data has to do to migrate.
- **For changes that depend on `../icdc-core/`** (e.g. you regenerated Candid bindings against a new icdc-core version), call out the upstream PR / commit in `# Motivation` so reviewers can sequence the deploy.

## 3. Atomicity

One logical change per PR. If you catch yourself writing
"and also" / "while I was here" / "I noticed that" in the body, split.

| Anti-pattern                                | Do this instead                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| "Add feature X and rename old component"    | PR 1: `refactor: rename`. PR 2: `feat: X`.                                     |
| "Fix bug Y and update unrelated typography" | Two PRs.                                                                       |
| "Refactor 5 components into shared `Foo`"   | PR 1: introduce `Foo` + migrate 1 caller. PR 2..N: migrate the others.         |
| "New satellite endpoint + add it to the FE" | Usually two PRs (satellite first, FE second). One only if both are very small. |

## 4. Local quality gates

From the repo root, before opening the PR:

```bash
# Always
npm run format          # prettier --write + eslint --fix
npm run lint            # prettier --check + eslint
npm run check           # svelte-check

# Or in one shot (matches what humans usually run)
npm run quality         # = format && lint

# Bindings (only if you changed Candid sources or upgraded an upstream canister)
npm run did             # ./scripts/did.sh + format + lint

# Satellite: run whenever you touch src/satellite/** OR a $lib/schema/*
# file imported by src/satellite/index.ts. CI's `satellite-schema` job
# fails on any drift it produces, so commit the regenerated outputs.
# Pair with `npm run quality` so the drift check compares apples to apples.
npm run juno:functions:build && npm run quality

# Engine sanity (after re-init or refactors that touch engine wiring)
npm run test:engine-sync
```

The CI workflow [`.github/workflows/checks.yml`](../../.github/workflows/checks.yml)
runs `format`, `lint`, and `check`. The `format` job auto-commits prettier
fixes back to your branch on PRs from non-forks; you should still run
`npm run format` locally to keep diffs reviewable.

## 5. CI jobs you must keep green

| Workflow             | Job(s)             | What it runs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `checks.yml`         | `format`           | `npm run format`. Auto-commits prettier fixes on non-fork PRs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `checks.yml`         | `lint`             | `npm run lint` (prettier `--check` + eslint).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `checks.yml`         | `check`            | `npm run check` (`svelte-check`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `checks.yml`         | `satellite-schema` | `juno functions build --lang ts` then fails if `src/satellite/{satellite,satellite_extension}.did`, `api-schemas.ts`, or `src/declarations/satellite/**` drift. Run `npm run juno:functions:build` locally and commit the result.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `checks.yml`         | `checks-pass`      | Aggregator — must be green to merge.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `deploy.yml`         | deploy             | `functions build` + `functions upgrade` (Administrator `JUNO_TOKEN`) **then** `hosting deploy` (OIDC), in one sequential job — upgrades the satellite functions and ships the frontend. **Env-routed:** `main` push → **staging** (`JUNO_TOKEN_STAGING`), `v*` tag → **production** (`JUNO_TOKEN`), manual dispatch → chosen `environment`. Don't bypass. The two `functions` steps are **skipped when the satellite wasm cannot have changed** since the previous `v*` tag: `scripts/satellite-upgrade-needed.mjs` walks the value-import graph of `src/satellite/index.ts` (type-only imports excluded) and intersects it with the diff, plus always-upgrade triggers (`src/satellite/**`, `package(-lock).json`, `juno.config.ts`, the workflow, the script). The upgrade stops the satellite — which also serves the frontend — so a frontend-only release this way ships with zero downtime. Any doubt fails safe to upgrading. |
| `publish.yml`        | publish            | `functions build` + `functions publish` (OIDC) — stages the functions wasm to the satellite CDN. Same env routing as `deploy.yml` (`main` → staging, `v*` → production, dispatch → chosen `environment`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `release-please.yml` | release-please     | On every `main` push, maintains a standing "release PR" (version bump + `CHANGELOG.md`) from Conventional Commits. Merging that PR cuts the `vX.Y.Z` tag. **Bump policy is `always-bump-patch`** (config `versioning`): every release is a patch by default — `feat:` does **not** bump the minor. Minor/major bumps are commanded with a `Release-As: X.Y.Z` commit footer on `main`. Commit types still drive `CHANGELOG.md` sections, just not the bump. Does **not** touch the satellite, so it's outside the `juno-satellite` group.                                                                                                                                                                                                                                                                                                                                                                                            |

**Two environments, routed by trigger.** Both `deploy.yml` and `publish.yml`
run on `main` pushes, `v*` tags, and manual dispatch, and pick the target
satellite from `juno.config.ts`'s `satellite.ids` via `--mode`:

- **`main` push → staging** (`d22z5-nyaaa-aaaal-asz5a-cai`, `staging.vici.market`),
  authenticated with the `JUNO_TOKEN_STAGING` secret.
- **`v*` tag → production** (`7scay-7yaaa-aaaal-asxqa-cai`), authenticated with
  `JUNO_TOKEN`.
- **Manual dispatch** → the chosen `environment` input (`staging` default).

The frontend bundle's satellite id (`VITE_SATELLITE_ID`, injected by
`@junobuild/vite-plugin`) is resolved from the **Vite build mode**, not an env
lookup — so the `hosting deploy` step exports `JUNO_MODE`, which the `npm run
build` predeploy passes through as `vite build --mode "$JUNO_MODE"`. Without it
a staging deploy would ship a production-pointing bundle onto the staging
canister.

The icdc-core engine, registry, and VXP/VICI ledger ids in
`src/lib/constants/canisters.constants.ts` are **hardcoded to production** and
do **not** switch by mode: staging isolates only the Juno app/social data
(profiles, leagues, market metadata, chats, analytics) and shares the real
production clearing engine. Staging needs a one-time `juno config apply --mode
staging` (collections + auth) and the repo authorized on the staging satellite
(Console → Deployments) for the OIDC `hosting deploy` / `functions publish`.

The `v*` tag is produced by **release-please** (`release-please.yml`), not by
hand: it bumps the version and regenerates `CHANGELOG.md` in a standing release
PR, and merging that PR cuts the tag. So **merging the release PR is the
release event** — it cascades into `deploy.yml` + `publish.yml`. release-please
keeps `package.json#version` and `package.json#juno.functions.version` in
lockstep (config `extra-files`), so from the first release on, the two numbers
are identical. For the cut tag to actually trigger the two deploy workflows,
release-please must run with the `RELEASE_PLEASE_PAT` secret (a tag created with
the default `GITHUB_TOKEN` does not trigger further workflows); without it, the
release PR still works but you must dispatch `deploy.yml` / `publish.yml`
manually after the tag lands.

`config apply` (**applies** `juno.config.ts` — collection rules + authentication
config — to the target satellite, per `--mode`) is **run manually**, not in CI.
Use `juno config apply --mode <production|staging>` locally with that
environment's Administrator access key. The repo stays source of truth: a run
re-syncs the satellite to `juno.config.ts`, reverting any out-of-band Console
edits. A new satellite (e.g. staging) needs one `config apply` before its first
deploy, or it has no collections. It used to be a push-triggered `config.yml`
sharing the old `juno-satellite` group — see why that was removed below.

Concurrency is keyed **per workflow and per environment**:
`juno-satellite-deploy-<mode>` and `juno-satellite-publish-<mode>`
(`cancel-in-progress: false`). The `<mode>` suffix keeps staging (`main` pushes)
and production (`v*` tags) on separate queues so they never block each other —
they target different canisters. Within one queue, runs serialize so a
`functions upgrade` (which **stops** the canister mid-upgrade, else a concurrent
mutation is rejected with `Canister … is stopped`, IC0508) never overlaps
another run of the same workflow against the same satellite; a running one is
never cancelled.

Keeping `deploy` and `publish` in **separate** groups (rather than one shared
`juno-satellite` group) is deliberate: each queue then holds only one workflow's
runs, so even at the every-merge `main`-push cadence a queue never exceeds one
running + one pending. That sidesteps GitHub's single-_pending_-slot hazard —
if a **third** member queues behind a running one and a waiting one, the older
waiting run is silently cancelled (`Canceling since a higher priority waiting
request … exists`). It bit us twice under the old shared group — the standalone
`upgrade.yml` (folded into `deploy.yml`) and the push-triggered `config.yml`
(now manual-only) each added a third member. Don't add a third workflow to
either group.

> ⚠️ Because the groups are separate, `deploy.yml` and `publish.yml` for the
> **same** environment can run concurrently against the same satellite. That is
> tolerated today (`functions publish` stages a CDN artifact and does not stop
> the canister), but if you make `publish` mutate the running canister, revisit
> this and serialize them behind a shared per-env group instead.

If your change is doc-only, the `format` and `lint` jobs still run because
they cover the whole repo. The `check` job covers `*.svelte` / `*.ts` only,
so doc-only changes typically pass it trivially.

## 6. After CI fails

- **`format` pushed a formatting commit** → pull, you're fine. Don't fight
  it. Run `npm run format` locally next time to avoid it.
- **`lint` failed** → run `npm run lint` locally. Don't silence with
  `// eslint-disable` unless you can justify it in code review. Common
  catches:
  - `0n` literal → use the shared `ZERO` constant.
  - `return undefined;` → bare `return;` (or comment-explain in `catch`).
  - `x === null` / `x !== undefined` (any direct `==`/`===`/`!=`/`!==`
    against `null`/`undefined`) → `isNullish(x)` / `nonNullish(x)` from
    `@dfinity/utils`.
  - Relative imports under `src/**` → use the path aliases (see
    [`frontend/structure.md`](./frontend/structure.md#imports)).
- **`check` failed** → fix `svelte-check` errors. No `// @ts-ignore`,
  no `as any`, no `as unknown as …`.
- **`checks-pass` red but children green** → the aggregator has a stale
  cache; push an empty no-op commit or rerun.

## 7. Updating an existing PR

- **Add commits.** Never `git push --force` to a PR branch. Don't
  `git commit --amend` after pushing. Don't rebase a PR onto `main` to
  "tidy history".
- **What counts as "the user explicitly asks":** the user names the
  operation directly — any unambiguous phrasing works. Examples that
  count: "force-push", "force push", "push --force", "push -f",
  "amend", "amend the commit", "git commit --amend", "rebase",
  "git rebase", "rewrite history", "rewrite the history". Selecting
  a multi-choice option whose label itself contains one of those
  phrases also counts. Anything else **DOES NOT** count, including:
  - "do what you think is best",
  - "do what's most correct" / "do it the idiomatic way",
  - "do it your way" / "use your judgement",
  - approval of a stacked-PR plan,
  - approval of a refactor that would "look cleaner" in the originating PR.

  If in doubt, **add a new commit** even if the result looks messier.
  Squash-merge tidies history at merge time; force-push destroys it.

- When the agent is offering choices, the **default** must always be the
  no-force-push option. Do not put a force-push option first, and do not
  pick a force-push option in response to delegated decisions.
- Typical legitimate reasons a user might ask for a force-push include
  removing an accidentally-committed secret (rotate the secret afterwards
  too) or recovering from a catastrophic mistake. These are illustrative,
  not an exhaustive whitelist.
- If you need to drop a commit, push a new revert commit instead.

## 8. CODEOWNERS auto-routing

[`.github/CODEOWNERS`](../../.github/CODEOWNERS) routes reviews. Agents do
not assign reviewers — the file does it.

## 9. Cross-repo changes (icdc-core)

If your change requires changes in [`icdc-core`](https://github.com/AntonioVentilii/icdc-core)
(typically checked out at `../icdc-core/`):

1. Land the icdc-core PR first (or simultaneously, with the icdc-core PR
   merging into a tagged version).
2. In this repo, regenerate the Candid bindings against the new tag:

   ```bash
   npm run did
   ```

   Commit the regenerated `src/declarations/**` together with the
   FE wiring changes.

3. Reference the icdc-core PR / commit in `# Motivation` so a reviewer
   can sequence the deploy.
4. Use a draft PR until the upstream change is tagged.

See [`docs/engine-integration.md`](../../docs/engine-integration.md) for
the architecture and
[`.agents/workflows/icdc-engine-reset.md`](../../.agents/workflows/icdc-engine-reset.md)
for resetting an environment after a breaking change.

## 10. Code comments

Comments carry what the code **cannot** say. Any reader — human or
agent — can read the code itself; a comment earns its line only with
the **why**, never the **what**.

Write a comment only for:

- **Intent / why** — the reason this approach won over the obvious
  alternative.
- **Invariants & constraints** — what must hold but isn't visible in
  the code (ordering requirements, idempotency-key shape, instruction
  caps, units).
- **Deliberate weirdness** — code that looks wrong but is right. Point
  at the governing `docs/ai/**` page instead of re-explaining it.
- **Warnings** — landmines for the next editor.

Never write:

- **Narration** — `// fetch the profile` above `getProfile()`.
  Restating names, types, or control flow the next line already
  declares.
- **Diff commentary** — `// changed to use X`, `// new helper`,
  `// fixed per review`, `// removed the old check`. That's
  PR-conversation addressed to the reviewer; it is noise the moment
  the PR merges. Put it in the PR body instead.
- **Source references** — where behaviour was ported or copied from
  (see [commandment 5](../../AGENTS.md#2-project-specific-commandments)).

If the code needs narration to be understandable, fix the code — a
better name, a smaller function, an extracted constant — instead of
captioning it. Match the comment density of the file you're editing;
a diff whose comments mostly describe the diff itself is a
review-blocking smell.
