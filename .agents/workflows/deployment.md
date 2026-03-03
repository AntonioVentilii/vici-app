---
description: local deployment workflow using Juno emulator
---

This workflow ensures that custom canisters and the Juno satellite share the same port and environment, avoiding 404 and CORS errors.

1. Stop any running replicas or emulators.
// turbo
2. Start the Juno emulator:
```bash
juno emulator start
```
3. In a new terminal, deploy the custom canisters targeting the Juno port:
// turbo
```bash
npm run deploy
```
4. Start the SvelteKit development server:
```bash
npm run dev
```

> [!IMPORTANT]
> Do NOT run `dfx start`. The Juno emulator acts as the only local replica.
