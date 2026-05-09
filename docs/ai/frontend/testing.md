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
- **Auth fixture:** [`@dfinity/internet-identity-playwright`](https://github.com/dfinity/internet-identity-playwright)
  — drives the II passkey flow programmatically. Reused across tests in
  the same Playwright session for reproducibility.
- **Backend:** Juno emulator started by `juno emulator start --headless`,
  with `mode: test` mapped to satellite ID `jx5yt-yyaaa-aaaal-abzbq-cai`
  in [`juno.config.ts`](../../../juno.config.ts).
- **Frontend:** the dev server (`npm run dev`) — booted automatically by
  Playwright's `webServer` config.

### Layout

```text
e2e/
├── config.ts             # II URL / canister / timeouts (env-overridable)
├── pages/                # Page-Object Model classes
│   └── home.page.ts
├── homepage.spec.ts      # logged-out smoke test
└── auth.spec.ts          # logged-in II flow (sign in + sign out)
```

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
juno emulator start
juno login --emulator --mode test
juno config apply --mode test

# In another terminal — run all specs (installs browsers on first run)
npm run e2e

# Open the HTML report after a CI-style run
npm run e2e:report
```

The `webServer` block in `playwright.config.ts` boots `npm run dev` on
:5173 automatically when you run `npm run e2e`.

### CI

The [`.github/workflows/e2e.yml`](../../../.github/workflows/e2e.yml)
workflow installs the Juno CLI, starts the emulator headlessly,
`apply`s the `test` config, then runs `npm run e2e:ci`. The HTML report
is uploaded as the `playwright-report` artifact (always); raw results
ship as `test-results` only on failure.

### Forbidden in E2E

- `test.skip` / `testWithII.skip` left on `main`. Either remove the test
  or make it pass.
- Hard-coded waits (`page.waitForTimeout(...)`). Use `expect(locator).toBeVisible()`
  / `toHaveText()` with the configured `actionTimeout` instead.
- Real network calls outside the emulator. The whole point of the
  emulator is reproducibility.
- Logging in by stuffing identities into `localStorage` / `IndexedDB`.
  Use the `iiPage` fixture; that's what it's for.

### Adding a new E2E test

1. Add an entry to `TestId` only if the new test needs a stable hook the
   surrounding components don't already expose.
2. Add `data-tid={TestId.X}` on the smallest meaningful element.
3. Extend the relevant page object (`e2e/pages/*.page.ts`) — never
   reach into selectors from the spec directly.
4. Write the spec under `e2e/<flow>.spec.ts`. Use `testWithII` from
   `@dfinity/internet-identity-playwright` for any flow that needs to
   be signed in.
5. Run `npm run e2e` locally before pushing.
