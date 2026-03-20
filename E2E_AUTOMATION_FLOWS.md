# 🤖 VICI Automation Checklist (P0 Flows)

This document outlines the critical user flows that must be verified to ensure the VICI platform is "perfect for P0". These flows are designed to be used as a blueprint for future E2E automation tests.

## 1. Authentication & Identity

### 1.1 Developer Login

- **URL:** `/`
- **Action:** Open Login Modal -> Click "Sign in for Dev"
- **Verification:** User menu appears in header; wallet shows non-zero balance.

### 1.2 Logout

- **URL:** Any
- **Action:** Open User Menu -> Click "Log out"
- **Verification:** User is redirected to landing page; "Sign in" button is visible.

### 1.3 Profile Customization

- **URL:** `/profile`
- **Action:** Click on an emoji in the "Choose Your Identity" section.
- **Verification:** Success toast/indicator; Avatar icon in header updates to reflect the new selection.

---

## 2. Wallet & Financials

### 2.1 Deposit Margin (Collateral)

- **URL:** `/wallet`
- **Action:** Click "Manage" in Clearing Collateral -> Enter amount -> "Confirm Deposit"
- **Verification:** Balance in "Clearing Collateral" increases; system transaction log shows success.

---

## 3. Prediction Execution

### 3.1 Standard Order (Market Detail)

- **URL:** `/markets/[market_id]`
- **Action:** Click on an Outcome (e.g., "Yes") -> Select/Enter Amount -> Click "Confirm [Outcome]"
- **Verification:** Prediction appears in "Recent Prediction Context" on Profile page; Wallet balance adjusts.

### 3.2 Flow Mode Execution (Swipe)

- **URL:** `/flow`
- **Action:** Set default amount -> Swipe Right (Yes) or Swipe Left (No) on a card.
- **Verification:** Card slides out; "Prediction placed" feedback appears; next card in stack is revealed.

---

## 4. Discovery & Engagement

### 4.1 Feed Interaction

- **URL:** `/` (Home)
- **Action:** Scroll through the infinite market feed.
- **Verification:** New cards load dynamically; cards display correct market metadata (category, end date, probability).

### 4.2 Leaderboard Viewing

- **URL:** `/leaders`
- **Action:** Toggle between "Accuracy", "Profit", and "Volume" tabs.
- **Verification:** Ranking list updates; current user is highlighted if they are in the top list.

### 4.3 Market Details Deep-link

- **URL:** `/markets/[market_id]`
- **Action:** Navigate directly to a market URL.
- **Verification:** Page loads with full resolution criteria, probability charts, and activity history.

---

## 5. UI/UX Settings

### 5.1 Theme Switching

- **URL:** Any
- **Action:** Open User Menu -> Click "Peach", "Light", or "Dark" theme icons.
- **Verification:** `data-theme` attribute on `<html>` or `<body>` updates; background and text colors change instantly.

---

## 6. Edge Cases to Automate (P0 Bonus)

- [ ] Attempting to trade with **zero margin**.
- [ ] Swiping on the **last card** in a finite stack.
- [ ] Navigating to a **non-existent market ID** (404 handling).
- [ ] Placing a prediction **after market resolution**.
