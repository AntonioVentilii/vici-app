# PR & CI

Everything an agent needs to open a green PR.

## 1. PR title

The repo follows [Conventional Commits](https://www.conventionalcommits.org/).
Recent merged history (from `git log` on `main`) — use as templates:

- `feat(collateral): use nanoid for operation IDs`
- `feat: count docs instead of list`
- `feat: upgrade juno functions v0.9 and drop candid for ledger transfer`
- `fix: market resolution & settlement UX`
- `fix(collateral): use nanoid for operation IDs (replaces insecure Math.random fallback)`
- `chore: update and pin bindgen`
- `chore: group hosting in new juno.config section`
- `chore(npm-deps-dev): bump @junobuild/config from 3.0.0 to 3.0.1`
- `docs: replace Motoko mention with Rust`

Pattern: `verb(scope): description` — scope optional but encouraged.

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

Honor [`.github/pull_request_template.md`](../../.github/pull_request_template.md):

```markdown
# Motivation

<!-- Describe the motivation that lead to the PR -->

# Changes

<!-- List the changes that have been developed -->

# Tests

<!-- Please provide any information or screenshots about the tests that have been done -->
```

Rules:

- **All three sections are required.** Don't leave them empty. Even tiny PRs benefit from one bullet per section.
- **Use the exact section headings** (`# Motivation`, `# Changes`, `# Tests`) so downstream tooling (release notes, search, changelog grep) can find them.
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

| Workflow      | Job(s)             | What it runs                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checks.yml`  | `format`           | `npm run format`. Auto-commits prettier fixes on non-fork PRs.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `checks.yml`  | `lint`             | `npm run lint` (prettier `--check` + eslint).                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `checks.yml`  | `check`            | `npm run check` (`svelte-check`).                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `checks.yml`  | `satellite-schema` | `juno functions build --lang ts` then fails if `src/satellite/{satellite,satellite_extension}.did`, `api-schemas.ts`, or `src/declarations/satellite/**` drift. Run `npm run juno:functions:build` locally and commit the result.                                                                                                                                                                                                                                                      |
| `checks.yml`  | `checks-pass`      | Aggregator — must be green to merge.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `deploy.yml`  | deploy             | `hosting deploy` (OIDC). Runs on every push to `main`, on `v*` tags, and via manual dispatch. Don't bypass.                                                                                                                                                                                                                                                                                                                                                                            |
| `publish.yml` | publish            | Pinned-CLI `npm run juno:functions:build` + `functions publish` (OIDC) — stages the functions wasm to the satellite CDN. Runs on `v*` tags and manual dispatch.                                                                                                                                                                                                                                                                                                                        |
| `upgrade.yml` | upgrade            | Pinned-CLI `npm run juno:functions:build` + `functions upgrade` — **applies** the new functions wasm to the running satellite. Runs on every push to `main`, on `v*` tags, and via manual dispatch (same triggers as `deploy.yml`). Needs the Administrator `JUNO_TOKEN` repo secret (not OIDC).                                                                                                                                                                                       |
| `config.yml`  | config             | `config apply` — **applies** `juno.config.ts` (collection rules + authentication config) to the production satellite. Reads the config only, no wasm build. Runs on every push to `main`, on `v*` tags, and via manual dispatch. Rewriting security rules / auth config is administrative, so it needs the same Administrator `JUNO_TOKEN` repo secret (not OIDC). Repo is source of truth: a run re-syncs the satellite to `juno.config.ts`, reverting any out-of-band Console edits. |

`deploy.yml`, `publish.yml`, `upgrade.yml`, and `config.yml` share one concurrency group
(`juno-satellite`, `cancel-in-progress: false`) so they never run at the same
time. They all mutate the same satellite canister, and `functions upgrade`
**stops** it mid-upgrade — a concurrent `hosting deploy` would otherwise be
rejected with `Canister … is stopped` (IC0508). The shared queue serializes
every satellite mutation; runs wait for the previous one instead of racing.

**The satellite is always built / mutated with the npm-pinned `@junobuild/cli`,
never `junobuild/juno-action@full`.** The action's image bundles its own
toolchain that fails to enumerate the `defineQuery` / `defineUpdate` exports
from `src/satellite/index.ts` — it emits `satellite_extension.did` as
`service : {}`, shipping a satellite with **no custom endpoints** (surfaces as
"method" errors only via CI, never locally). Every workflow that builds
functions or mutates the satellite (`checks.yml`'s `satellite-schema`,
`e2e.yml`, `upgrade.yml`, `publish.yml`, `config.yml`) installs the CLI via the
[`install-juno-cli`](../../.github/actions/install-juno-cli/action.yml)
composite action — the **single source of truth for the pin** — then runs
`npm run juno:functions:build` / `juno … --headless`. The action is only kept
for steps that need its OIDC token exchange (`publish.yml`'s `functions
publish`), which upload the already-built wasm without rebuilding. Bump the pin
in [`install-juno-cli`](../../.github/actions/install-juno-cli/action.yml) in
lockstep with the dependabot `juno-kit` `@junobuild/functions` bumps.

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
