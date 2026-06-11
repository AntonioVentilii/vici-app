# Spec: <title>

This spec follows the workflow defined in
`docs/ai/spec-driven-development/workflow.md`.

Status: Draft

## Goal

<!-- One paragraph: the user-visible outcome. -->

## Context

<!-- Real file paths, components, collections, endpoints involved. Existing patterns to reuse (check docs/ai/frontend/reusability.md first). -->

## Scope

<!-- What changes. -->

### Out of scope

<!-- Explicit non-goals, deferred items, adjacent issues left alone. -->

## Design artifacts (frontend — optional)

<!-- Relative links into ./<this-spec-filename>/ — wireframes, HTML mocks, screenshots. Deleted post-merge. Remove this section if unused.
Interactive HTML mocks must (see docs/ai/spec-driven-development/workflow.md § Required content by area):
- include a theme switcher (data-theme on the root, light + dark) when the change touches theme-varying layout / styles / colors / sizing / icons / animations;
- include a "copy instructions" button that copies the COMPLETE final instructions (every chosen variant and value) back to the agent chat. -->

## Technical requirements (satellite / backend — mandatory)

<!-- Required for any change touching src/satellite/**, collections, or icdc-core-facing paths. Remove this section only for pure-frontend specs.
- Performance: call frequency, instruction-budget impact.
- Memory & storage: collections / doc shapes, count, size, growth, cleanup.
- Scalability: behaviour at 10× / 100×; bulk reads over N+1.
- Upgrade & compatibility: schema, regenerated .did / bindings, breaking?
- Security: collection rules, caller permissions.
- Parameters: cite the canonical constants file, don't restate values. -->

## Implementation outline

<!-- Numbered steps grounded in real paths. -->

## Acceptance criteria

<!-- Verifiable, one checkbox per criterion. -->

- [ ] …

## Decisions

<!-- Options considered and why the chosen one won. Append here when the build reveals gaps (workflow step 4). -->
