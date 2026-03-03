# CLAUDE.md - Vici Social Markets Memory

## Project Overview
Prediction platform on Internet Computer using SvelteKit (Runes), Juno, and Motoko.

## Essential Commands
- **Dev**: `npm run dev`
- **Build**: `npm run build`
- **Check**: `npm run check`
- **Deploy**: `npm run deploy` (targets Juno emulator via local network)
- **Identity**: @src/lib/services/identity.services.ts

## Rules & Patterns
- **Svelte 5**: Use runes and specific props destructuring.
- **Naming**: `_ms` (milliseconds), `_ns` (nanoseconds).
- **Terminology**: Use "prediction" instead of "bet".

## Documentation Imports
- @.claude/rules/svelte.md - Detailed Svelte 5 patterns
- @.claude/rules/coding-standards.md - General coding & naming rules
- @.claude/rules/juno.md - Juno config and patterns (ref: https://juno.build/llms-full.txt)
- @.claude/rules/backend.md - Canisters, Candid, and API layer logic
- @SPECS_V0.md - Project specification
- @TODO.md - Current progress

## Personalize & Evolve
> [!IMPORTANT]
> If you (the AI agent) recognize a change in project behavior, patterns, or requirements that differs from these instructions, you MUST proactively update the relevant memory files (`CLAUDE.md` or `.claude/rules/`) to reflect the new reality.
