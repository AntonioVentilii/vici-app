# Frontend Testing

> **Status: bootstrap.** This repo does **not** ship a configured **unit**
> test runner today. There is no Vitest config, no `npm run test` script,
> and no `*.test.ts` files. The `@dfinity/eslint-config-oisy-wallet/vitest`
> preset is wired into `eslint.config.js`, so once the runner exists ESLint
> will already understand it. Until then, this section is the
> **forward-looking contract**: when the first unit test lands, the
> conventions below kick in.
>
> **End-to-end (Playwright) tests are configured.** See
> [E2E (Playwright)](#e2e-playwright) below.

## Today

- **Unit / component tests are not required by CI.** The `checks.yml`
  workflow runs `format`, `lint`, and `check` only.
- **E2E (Playwright) is required by CI.** The `e2e.yml` workflow boots the
  Juno emulator and runs `npm run e2e:ci`. See
  [E2E (Playwright)](#e2e-playwright).
- **Bug fixes still benefit from a manual repro.** Document repro steps in
  the PR body's `# Tests` section so a reviewer can verify.
- **Engine sanity** has its own smoke-test script:

  ```bash
  npm run test:engine-sync
  ```

  Use it after touching engine wiring (`scripts/init/init.icdc-engine.sh`,
  `engine-sync.services.ts`, `VICI_ENGINE_ID`). It asserts the engine is
  registered, the satellite is in `admins`, and `allowed_roles` contains
  both `Creator` and `OracleAdmin`. See
  [`.agents/workflows/icdc-engine-reset.md`](../../../.agents/workflows/icdc-engine-reset.md).

## When the first Vitest spec lands

The expected setup:

- **Stack:** Vitest + `@testing-library/svelte` + `jsdom`.
- **Where tests live:** mirror `src/` under `src/tests/`. Never put a
  `.spec.ts` next to the file it tests.
- **Naming:** `*.spec.ts` for the test file, mirroring the source path.
  Reusable mocks under `src/tests/mocks/<thing>.mock.ts`. Reusable test
  helpers under `src/tests/utils/<thing>.test-utils.ts`.
- **Type-check tests:** add a `tsconfig.spec.json` and a `npm run check:tests`
  script.

### What to test (when the runner exists)

| Add tests for                                                      | Don't bother                                          |
| ------------------------------------------------------------------ | ----------------------------------------------------- |
| Pure utils (`*.utils.ts`) — every public function                  | Re-exports, barrels                                   |
| Service modules (`*.services.ts`) — happy path + each error branch | Generated files (`$declarations`)                     |
| Derived stores (`*.derived.ts`) with non-trivial logic             | Throwaway prototypes                                  |
| Reusable components in `$lib/components/ui/`                       | One-off presentational components used in 1 page only |
| Components with logic (any non-trivial branch / event handler)     | —                                                     |
| Schemas / validation modules                                       | —                                                     |
| Bug fixes (write the regression test that fails on `main`)         | —                                                     |

If you fix a bug, **the PR contains a test that fails on `main` and
passes on your branch**. Otherwise it's an "I think this is fine" PR.

### File shape (target convention)

```ts
import { describe, expect, it } from 'vitest';
import { formatBalance } from '$lib/utils/format.utils';
import { ZERO } from '$lib/constants/app.constants';

describe('formatBalance', () => {
	it('returns "0" for zero', () => {
		expect(formatBalance(ZERO, 8)).toEqual('0');
	});

	// … one `it` per behaviour
});
```

Notes (forward-looking):

- One `describe` per module under test, nested `describe` per public
  function.
- One `it` per behaviour — name it from the user/caller perspective.
- Reset mocks in `beforeEach`. Never let test order matter.
- For fetch / canister calls: mock the matching `$lib/api` / `$lib/canisters`
  module rather than stubbing `fetch` directly.

### Component testing

```ts
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Button from '$lib/components/ui/Button.svelte';

describe('Button', () => {
	it('renders the label', () => {
		render(Button, { props: { label: 'Confirm' } });
		expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
	});
});
```

Prefer `getByRole`, `getByLabelText`, `getByText` — they exercise the same
semantics as a screen reader.

### Forbidden in tests

- `it.skip` / `describe.skip` / `it.todo` left on `main`.
- Real network calls. Stub `fetch` with `vi.stubGlobal` (and
  `vi.unstubAllGlobals()` in `afterAll`).
- `setTimeout`-based waits. Use `vi.useFakeTimers()` or `await waitFor(...)`.
- Console-noise (`console.log` debug output). Remove before commit.

## Adding the test runner — what would have to happen

This is **not** something an agent should do silently. If a PR genuinely
needs a test runner:

1. Surface the request in the PR description and ask for explicit
   approval to add `vitest`, `@testing-library/svelte`, `jsdom`, and a
   matching `tsconfig.spec.json`.
2. Wire `npm run test`, `npm run test:watch`, and (optionally)
   `npm run test:coverage` in `package.json`.
3. Use the folder layout (`src/tests/` mirroring `src/`) and the
   `*.spec.ts` suffix as anchored above.
4. Add a `test` job to `.github/workflows/checks.yml` and update
   [`pr-and-ci.md`](../pr-and-ci.md) accordingly.
5. **Update this page** in the same PR to flip "bootstrap" → the actual
   policy (no skipped tests on `main`, regression tests for bug fixes,
   etc.). That's the
   [meta-update rule](../governance.md#meta-update-rule) in action.

Until then, this page documents the target shape so the first test
doesn't have to invent it from scratch.

## E2E (Playwright)

End-to-end tests live under [`e2e/`](../../../e2e/) and are driven by
[Playwright](https://playwright.dev/). They exercise the real frontend
against a local [Juno emulator](https://juno.build/docs/guides/local-development),
which boots a `junobuild/satellite` container with Internet Identity
pre-deployed.

### Stack

- **Runner:** `@playwright/test`.
- **Auth:** the dev-only mock identity exposed by `@junobuild/core`'s
  `signIn({ dev: {} })`, surfaced through the `SignInDev` button in
  [`SignInActions.svelte`](../../../src/lib/components/authn/SignInActions.svelte)
  (only rendered when `isDev()`). This is the path Juno's official E2E
  guide recommends and what `@junobuild/emulator-playwright` uses under
  the hood. It exercises the real `onAuthStateChange` pipeline — same
  store, same `UserDropdown`, same sign-out button — without depending
  on the Internet Identity popup, which is brittle in a containerized
  emulator (the II canister version drifts vs. driver libraries). A
  follow-up PR can add real II coverage on top of this base if needed.
- **Backend:** Juno emulator started by `juno emulator start --headless`.
  The Juno CLI's `--emulator` flag is only valid with `--mode development`,
  so E2E reuses development mode but exports `JUNO_EMULATOR=true`, which
  makes [`juno.config.ts`](../../../juno.config.ts) swap `ids.development`
  to the emulator's predictable satellite ID
  (`jx5yt-yyaaa-aaaal-abzbq-cai`). Without that env flag, the dev satellite
  ID still points at the real remote dev satellite.
- **Frontend:** the dev server (`npm run dev`) — booted automatically by
  Playwright's `webServer` config.

### Layout

```text
e2e/
├── pages/                # Page-Object Model classes
│   └── home.page.ts
├── snapshots/            # Playwright visual baselines, committed
├── homepage.spec.ts      # logged-out smoke + screenshot
└── auth.spec.ts          # dev sign-in / sign-out + screenshot
```

### Visual snapshots

Both specs end with `await expect(page).toHaveScreenshot(...)` — that's
the same flow `oisy-wallet` and `gix-components` use: the PNG baselines
live under [`e2e/snapshots/`](../../../e2e/snapshots/) and **are
committed to the repo**, so any visual regression shows up directly in
the PR diff.

The CI script (`npm run e2e:ci`) runs Playwright with
`--update-snapshots=changed`. That means:

- **First time** the test sees a name (no baseline yet) → Playwright
  writes the PNG. The workflow detects the change under
  `e2e/snapshots/`, commits it, and pushes the commit back to the PR
  branch (via [`./.github/actions/add-and-commit`](../../../.github/actions/add-and-commit/action.yml)
  using `secrets.GITHUB_TOKEN`).
- **Subsequent runs** that diff against the baseline → Playwright
  rewrites the PNG, and the same auto-commit step pushes the update.
  The reviewer sees the new screenshot in the PR diff and either
  accepts or rejects the visual change.
- **Fork PRs** can't be pushed to from `GITHUB_TOKEN`, so the changed
  baselines are still uploaded as the `snapshots-update` artifact;
  contributors can download them and commit manually.

Pushes from `GITHUB_TOKEN` deliberately don't re-trigger the workflow,
so the snapshot commit doesn't loop into another E2E run.

### Keeping snapshots stable

`playwright.config.ts` configures `expect.toHaveScreenshot` with:

- `animations: 'disabled'` — kills CSS animations / transitions.
- `caret: 'hide'` — hides the input caret.
- `threshold: 0.3` — tolerates minor anti-aliasing / font-hinting
  differences without flapping.

When a region of the page is genuinely non-deterministic (random
principals from dev sign-in, generated avatars, timestamps), mask it:

```ts
await expect(page).toHaveScreenshot('logged-in.png', {
	fullPage: true,
	mask: [home.userMenu]
});
```

CI runs on `ubuntu-24.04` only, so committed snapshots use the Linux
suffix Playwright auto-appends. Snapshots generated locally on macOS /
Windows get a different suffix and don't collide — but **don't commit
them**; they'll just bloat the repo and won't be checked by CI.

- **One spec per high-level user-facing flow.** Don't co-locate specs with
  components.
- **Page objects** wrap selectors and high-level actions so structural
  changes update one file, not every spec.
- **Selectors** go through `page.getByTestId(TestId.X)`. Playwright is
  configured with `testIdAttribute: 'data-tid'`, so a component opts in
  by exposing `data-tid={TestId.X}`. The catalog of IDs lives in
  [`src/lib/constants/test-ids.constants.ts`](../../../src/lib/constants/test-ids.constants.ts).
  **Add a new entry only when an E2E test references it** — keep the
  enum minimal.
- **Imports across the boundary:** specs and page objects under `e2e/`
  use **relative** imports (e.g. `../src/lib/constants/test-ids.constants`).
  The `local-rules/no-relative-imports` ESLint rule that bans relative
  imports under `src/**` does not apply here.

### Local commands

```bash
# Boot the Juno emulator (Docker image junobuild/satellite)
export JUNO_EMULATOR=true
juno emulator start
juno login --emulator --mode development
juno config apply --mode development

# In another terminal — run all specs (installs browsers on first run)
JUNO_EMULATOR=true npm run e2e

# Open the HTML report after a CI-style run
npm run e2e:report
```

`JUNO_EMULATOR=true` is what flips `ids.development` in
[`juno.config.ts`](../../../juno.config.ts) to the emulator satellite.
Without it the CLI / dev server would aim at the real remote dev
satellite — the E2E run would either fail loudly or, worse, write to
the real satellite. The CI workflow sets the env at the job level so
contributors don't have to think about it.

The `webServer` block in `playwright.config.ts` boots `npm run dev` on
:5173 automatically when you run `npm run e2e`.

### CI

The [`.github/workflows/e2e.yml`](../../../.github/workflows/e2e.yml)
workflow auto-runs on every push to `main`, every relevant pull request,
every `merge_group`, on a nightly schedule, and on `workflow_dispatch`.
It installs the Juno CLI, starts the emulator headlessly, `apply`s the
`test` config, then runs `npm run e2e:ci`. The HTML report is uploaded
as the `playwright-report` artifact (always); raw results ship as
`test-results` only on failure.

The workflow uses three patterns worth knowing:

- **Smart skip via `paths-filter`.** On pull requests, the `e2e` job
  only runs when E2E-relevant files changed (`e2e/**`, `src/**`,
  `static/**`, the Playwright / Juno / Svelte / Vite configs, lockfile,
  `.node-version`, the workflow itself, or the `prepare` action). Doc-only
  PRs skip E2E entirely; the aggregator (`e2e-pass`) treats that skip as
  a pass.
- **Force-run label.** Add the `run-e2e` label to a PR to force the
  `e2e` job even if `paths-filter` would have skipped it.
- **Concurrency cancellation.** Pushing a new commit to a PR cancels any
  in-flight E2E run for the same ref.

### Forbidden in E2E

- `test.skip` left on `main`. Either remove the test or make it pass.
- Hard-coded waits (`page.waitForTimeout(...)`). Use `expect(locator).toBeVisible()`
  / `toHaveText()` with the configured `actionTimeout` instead.
- Real network calls outside the emulator. The whole point of the
  emulator is reproducibility.
- Logging in by stuffing identities into `localStorage` / `IndexedDB`.
  Use the `SignInDev` button via the `HomePage` page object instead —
  that's the same path the dev runtime uses.

### Adding a new E2E test

1. Add an entry to `TestId` only if the new test needs a stable hook the
   surrounding components don't already expose.
2. Add `data-tid={TestId.X}` on the smallest meaningful element.
3. Extend the relevant page object (`e2e/pages/*.page.ts`) — never
   reach into selectors from the spec directly.
4. Write the spec under `e2e/<flow>.spec.ts`. For flows that need a
   signed-in user, drive `HomePage.openSignInModal()` followed by
   `HomePage.signInDevButton.click()` (or wrap that in a page-object
   helper if it gets repetitive).
5. Run `npm run e2e` locally before pushing.
