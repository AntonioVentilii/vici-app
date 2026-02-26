# Project Status & TODO List

Based on the comparison between the current codebase and `SPECS_V0.md`.

## ✅ Completed (Implemented or Mocked)

### Core Systems

- [x] **Framework Setup**: SvelteKit project with Tailwind CSS and Juno integration.
- [x] **Authentication**: Internet Identity integration via Juno.
- [x] **Mock Backend**: `mockBackend.ts` implementing the `BackendInterface` for all core data needs.

### Markets

- [x] **Market Discovery**: Home page (`/`) and Markets page (`/markets`) lists.
- [x] **Market Details**: Deep-dive view for individual markets (`/markets/[id]`).
- [x] **Market Resolution**: Admin-only resolution flow for YES/NO/CANCELED outcomes.
- [x] **Market Creation**: Admin-only form to create new binary markets.

### Features

- [x] **Trading UI**: YES/NO prediction interface with volume and probability updates.
- [x] **Portfolio Tracking**: View active positions, current value, and unrealized P&L.
- [x] **Leaderboard**: Global ranking system based on P&L and win rate.
- [x] **Wallet Foundation**: Balance display, transaction history, and send/receive tabs.

---

## 🚀 TODO / Remaining Features

### 🔧 Core Infrastructure

- [ ] **Real Backend Integration**: Migrate from `mockBackend.ts` to real Motoko canisters on the Internet Computer.
- [ ] **Ledger Connectivity**: Connect the Wallet to the actual ICP and ckUSDC ledger canisters.
- [ ] **Real State Management**: Potentially migrate from custom stores/mocks to Juno collections or real inter-canister calls.

### 🍱 Missing Pages

- [ ] **Rush Mode**: Swipe-based rapid betting interface (Swipe Right = YES, Left = NO).
- [ ] **Learn Page**: Educational content and tutorials about prediction markets.
- [ ] **User Profile**: Dedicated settings and profile management page.

### 📈 Feature Enhancements

- [ ] **QR Code Generator**: Replace "QR CODE PLACEHOLDER" in the Receive tab with a functional generator.
- [ ] **Market Charts**: Implement probability-over-time charts using a charting library (e.g., Chart.js or D3).
- [ ] **Market Discussion**: Community comment threads per market.
- [ ] **Friends System UI**: User interface to add, remove, and view social connections.
- [ ] **Detailed Market Depth**: Position breakdown table and deeper liquidity insights.
- [ ] **Advanced Filtering**: Sort markets by trending status, volume, or "urgent" expired status in Admin.

---

## 📝 Technical Debt / Discrepancies

- [ ] **SPEC Sync**: Update `SPECS_V0.md` to reflect that the project uses **SvelteKit** instead of React.
- [ ] **Types & Interfaces**: Ensure all mock types align 1:1 with future Motoko actor definitions.
