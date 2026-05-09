# Frontend Testing

> **Status: bootstrap.** This repo does **not** ship a configured frontend
> test runner today. There is no Vitest config, no `npm run test` script,
> and no `*.spec.ts` / `*.test.ts` files. The
> `@dfinity/eslint-config-oisy-wallet/vitest` preset is wired into
> `eslint.config.js`, so once the runner exists ESLint will already
> understand it. Until then, this page is the **forward-looking contract**:
> when the first test lands, the conventions below kick in.

## Today

- **No tests are required by CI.** The `checks.yml` workflow runs `format`,
  `lint`, and `check` only.
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
