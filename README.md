# Vici Social Markets

Vici Social Markets is a modern prediction platform built on the **Internet Computer**. It allows users to trade on binary outcome markets (YES/NO) with integrated social features, IC wallet management, and a streamlined mobile-first "Rush Mode" trading interface.

## 🚀 Key Features

- **Binary Outcome Markets**: Trade on YES/NO outcomes across various categories.
- **Social Integration**: Market-specific discussions, user profiles, following system, and activity feeds.
- **Rush Mode**: A swipe-based rapid trading interface designed for mobile-first engagement.
- **On-Chain Settlement**: Fully functional trading and settlement using the `clearing` and `registry` canisters.
- **Wallet & Portfolio**: Integrated collateral management for ICP and ckUSDC with real-time position tracking.
- **Leaderboards**: Track top performers based on P&L and trading volume.

## ⚙️ Backend Canisters (ICDC-Core)

The core trading logic and market registry are powered by high-performance Motoko-based canisters from the **[icdc-core](https://github.com/AntonioVentilii/icdc-core)** project:

- **Clearing Canister**: Handles margin accounts, collateral management, and on-chain trade matching.
- **Registry Canister**: Manages the prediction market lifecycle, including creation, discovery, and settlement.

## 🛠️ Technology Stack

- **Frontend**: [SvelteKit](https://kit.svelte.dev/) with **Svelte 5 (Runes)**.
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with a premium glassmorphic design system.
- **Backend/Storage**: [Juno](https://juno.build/) and Motoko-based canisters on the Internet Computer.
- **Blockchain**: [Internet Computer (IC)](https://internetcomputer.org/).
- **Authentication**: [Internet Identity](https://identity.ic0.app/).

## 📖 Project Guidelines & Rules

This project follows strict development patterns and terminology. See the following files for details:

- **[CLAUDE.md](./CLAUDE.md)**: Project memory, essential commands, and core patterns.
- **[.claude/rules/](./.claude/rules/)**: Detailed documentation for Svelte 5, coding standards, Juno, and backend logic.
- **Terminology**: Always use **"prediction"** instead of "bet".
- **Naming Conventions**: Suffix time-based variables with `_ms` (milliseconds) or `_ns` (nanoseconds).

## 📦 Project Structure

- `src/lib/api/`: Canister and Juno collection API definitions.
- `src/lib/components/`: Modular Svelte components (Market, Wallet, Social, etc.).
- `src/lib/services/`: Business logic and orchestration between UI and APIs.
- `src/lib/stores/`: Application state management using Svelte Runes.
- `src/lib/types/`: Shared TypeScript definitions.
- `scripts/`: Initialization and deployment scripts.

## 🏁 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (current version in `.node-version`)
- [dfx](https://internetcomputer.org/docs/current/developer-docs/setup/install) (Internet Computer SDK)
- [Juno CLI](https://juno.build/docs/miscellaneous/cli)

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd vici-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Local Deployment (Juno Emulator)

To deploy locally, we use the Juno emulator as the primary replica.

1. **Start the Juno emulator**:

   ```bash
   juno emulator start
   ```

2. **Deploy custom canisters** (in a new terminal):

   ```bash
   npm run deploy
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

> [!IMPORTANT]
> Do **NOT** run `dfx start`. The Juno emulator acts as the only local replica and avoids CORS/404 errors with custom canisters.
