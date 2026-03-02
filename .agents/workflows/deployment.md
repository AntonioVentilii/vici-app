# Local Deployment Workflow

To use both Juno (for auth/datastore) and DFX (for Registry/Clearing canisters) together, follow these steps:

### 1. Start Juno Emulator (Single Replica)

Juno runs on port **5987** and acts as the replica for all canisters.

> [!IMPORTANT]
> You **must** have Juno running before running the deploy command.

```bash
juno emulator start
```

### 2. Deploy Custom Canisters to Juno

We use the `--network local` flag to target port **5987**.

```bash
dfx deploy --network local
```

### 4. Run Frontend

```bash
npm run dev
```

---

- **Juno & Custom Canisters**: All run on port **5987** (Juno Emulator).
- **CORS Handling**: Requests to `/api` are proxied by Vite to `localhost:5987`.
