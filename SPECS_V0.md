# Vici Social Markets – Complete Specification

---

## Core Concept

A prediction/betting platform on the Internet Computer where users trade on binary outcome markets (YES/NO), with social features, IC wallet integration, and admin market resolution controls.

---

## Technology Stack

### Backend

- Motoko on Internet Computer
- Stable storage for all data persistence
- Inter-canister calls to:
  - ICP Ledger
  - ckUSDC Ledger

### Frontend

- React with TypeScript
- Vite bundler
- pnpm package manager
- Tailwind CSS for styling
- React Query for state management and caching
- React Router for navigation
- QR code generation library

### Authentication

- Internet Identity (passkeys, Google, Apple, Microsoft)

---

## User Roles & Access Control

### Owner (single Principal)

- Set at canister initialization
- Cannot be changed
- Can add/remove admins
- Has all admin privileges

### Admins (managed set of Principals)

- Can create/resolve markets
- Can manage market outcomes
- Added/removed by owner only

### Authenticated Users

- Can place bets
- Can send/receive ICP and ckUSDC
- Can add/remove friends
- Can create private markets (if enabled)
- Can view portfolio, wallet, rush mode

### Unauthenticated Users

- Can view all markets
- Can view market details, analytics, depth
- Can view leaderboard
- Can view educational content
- Prompted to login only when attempting actions

---

# Core Features

---

## 1. Markets System

### Market Types

- Public Markets: Anyone can bet
- Private/Invite-Only Markets: Only invited users can bet (future feature)

### Market Properties

- Title and description
- Binary outcomes (YES/NO)
- Expiry date/time
- Status: Open, Expired, Resolved
- Outcome (after resolution): YES, NO, CANCELED
- Volume breakdown (total, YES, NO)
- Current probabilities/odds
- Creator Principal
- Invite list (for private markets)

### Market States

- Open: Active betting, before expiry
- Expired: Past expiry date, awaiting resolution
- Resolved: Outcome determined by admin

### Market Creation

- Admin-only operation
- Form inputs:
  - Title
  - Description
  - Expiry date

- Option to make invite-only (future)

### Market Resolution

- Admin-only operation via dedicated dashboard
- Sorted by expiry date (expired first)
- Expired unresolved markets have urgent styling
- Inline controls to select outcome:
  - YES
  - NO
  - CANCELED

---

## 2. Trading/Betting System

### Trading Mechanics

- Users place bets using their balance
- Binary outcomes: YES or NO
- Amount input with validation
- Real-time odds display
- Position tracking per user per market

### User Positions

- Track YES and NO holdings per market
- Show current value and unrealized P&L
- Aggregate across all markets in portfolio

### Trading Flow

1. User selects market
2. Chooses YES or NO
3. Enters amount
4. Confirms trade
5. Balance updated
6. Position recorded
7. Market volume/probabilities recalculated

### Unauthenticated Trading

- Trading interface visible
- Login prompt appears when user attempts to place bet

---

## 3. Wallet System

### Supported Tokens

- ICP (Internet Computer Protocol token)
- ckUSDC (chain-key USDC)

### Wallet Features

- Balance display for both tokens
- Transaction history table
- Send functionality
- Receive functionality with QR code
- Copy Principal ID to clipboard

### Send Flow

1. Select token type (ICP or ckUSDC)
2. Enter recipient Principal ID
3. Enter amount
4. Validation checks
5. Submit transaction
6. Inter-canister call to ledger
7. Update local balance and history

### Receive Flow

- Display user's Principal ID
- Generate QR code of Principal
- Copy button for easy sharing

### Transaction History

- Timestamp
- Token type
- Amount
- Recipient/Sender
- Transaction type (send/receive)
- Status

---

## 4. Friends System (Planned)

### Features

- Add/remove friends by Principal ID
- View friends list
- Quick-select friends when inviting to markets
- Support for friend-based private markets

### Use Cases

- Social betting circles
- Private group predictions
- Friends-only market creation

---

## 5. Rush Betting Mode (Planned)

Concept: Swipe-based rapid betting through a queue of ~10 markets.

### Controls

- Swipe Right: Place YES bet
- Swipe Left: Place NO bet
- Swipe Up: Skip market

### Flow

1. Enter Rush mode
2. Backend fetches ~10 open markets for user
3. Present first market
4. User swipes to act
5. Trade executes immediately
6. Next market appears
7. Continue until queue exhausted

### Data Integration

- Dedicated React Query hook
- Cache invalidation after each trade
- Balance/positions/transactions update

---

# Pages & Navigation

---

## Navigation Structure

### Header (always visible)

- Logo/Brand (links to Home)
- Markets
- Leaderboard
- Learn
- Portfolio (auth required)
- Wallet (auth required)
- Rush (auth required)
- Admin (admin/owner only)
- User Profile Dropdown (when authenticated)
- Balance Display (when authenticated)
- Login/Logout

---

## 1. Home Page

**Purpose:** Direct market discovery and engagement

### Layout

- Full markets list (replaces previous hero/stats content)
- Search bar
- Filter tabs: All | Trending | Expiring | Resolved
- Market cards grid with:
  - Title
  - Current probabilities
  - Volume
  - Expiry countdown
  - Quick bet buttons (prompts login if needed)

**Access:** Public (no authentication required)

---

## 2. Markets Page

**Purpose:** Browse and discover all markets

### Layout

- Search bar (filter by title/description)
- Filter tabs: All | Trending | Expiring | Resolved
- Market cards grid
- Sorting options (by volume, expiry, trending)

**Access:** Public

---

## 3. Market Detail Page

**Purpose:** View single market with full data and place bets

### A. Market Header

- Title and description
- Status badge (Open/Expired/Resolved)
- Expiry countdown or date
- Creator information

### B. Trading Interface

- Current probabilities/odds (YES/NO)
- Bet amount input
- YES/NO action buttons
- Login prompt for unauthenticated users

### C. Market Analytics

- Charts showing probability over time
- Volume trends
- Historical data

### D. Market Depth Panel

- Forecasts: Current YES and NO probabilities prominently displayed
- Total volume
- YES volume
- NO volume
- Position breakdown table

### E. Market Discussion

- Comment thread
- Timestamp and author for each comment
- Post comment form (prompts login if unauthenticated)

**Access:** Public for viewing; authentication required for betting/commenting

---

## 4. Portfolio Page

**Purpose:** View user's positions and performance

### A. Summary Stats

- Total portfolio value
- Unrealized P&L
- Active positions count

### B. Active Positions Table

- Market title
- Position (YES/NO and amount)
- Current value
- Unrealized P&L
- Link to market detail

### C. Resolved Positions

- Historical completed positions
- Final outcome and payout

**Access:** Authenticated users only

---

## 5. Wallet Page

**Purpose:** Manage ICP and ckUSDC balances

### A. Balance Display

- ICP balance (prominent, large font)
- ckUSDC balance (prominent, large font)

### B. Tabs: Send | Receive | History

#### Send Tab

- Token selector (ICP or ckUSDC)
- Recipient Principal input
- Amount input
- Submit button
- Validation messages

#### Receive Tab

- User's Principal ID display
- Copy to clipboard button
- QR code image of Principal

#### History Tab

Transaction table:

- Date/Time
- Type (Send/Receive)
- Token
- Amount
- Counterparty
- Status

**Access:** Authenticated users only

---

## 6. Rush Mode Page (Planned)

**Purpose:** Quick swipe-based betting

### Layout

- Full-screen market card
- Swipe gesture area
- Visual cues for swipe directions
- Progress indicator (e.g., "3/10 markets")
- Skip/exit controls

**Access:** Authenticated users only

---

## 7. Leaderboard Page

**Purpose:** Show top performers

### Layout

Ranking table:

- Rank
- User (anonymized or Principal)
- Total P&L
- Win rate
- Active positions

Time period filters:

- All-time
- Monthly
- Weekly

**Access:** Public

---

## 8. Learn Page

**Purpose:** Educational content about prediction markets and how Vici works

### A. Informative Content (moved from old HomePage)

Hero banner:

> Predict. Trade. Win.

Stats section:

- Active markets count
- Starting coins/balance info
- Trading hours/availability

Feature highlights:

- What are prediction markets
- How betting works
- Probability mechanics

### B. Educational Articles

- How to place a bet
- Understanding probabilities
- Market resolution process
- Wallet and token management
- Best practices and strategies

**Access:** Public

---

## 9. Admin Page

**Purpose:** Admin and owner control panel

**Access:** Admins and owner only

### A. Market Creation

Form to create new markets:

- Title
- Description
- Expiry date/time
- Privacy option (public/invite-only, future)
- Submit button

### B. Market Resolution Dashboard

Sorted list of all markets (expired first)

Each row shows:

- Market title
- Status
- Expiry date
- Current outcome (if resolved)

Inline resolution controls:

- Outcome selector (YES/NO/CANCELED)
- Resolve button

Urgent styling for expired unresolved markets:

- Red/orange background or border
- Bold text
- "EXPIRED - NEEDS RESOLUTION" badge

### C. Admin Management (owner only)

Current Admins List:

- Principal ID
- Remove button (next to each)

Add Admin Form:

- Principal ID input
- Add button

---

## 10. Profile Page (Planned)

**Purpose:** User profile and settings

**Access:** Authenticated users only

---

# Styling & Design

## Framework

- Tailwind CSS

## Theme

- Modern, clean interface
- Dark/light mode support (optional)
- Responsive design (mobile-first)

## Colour Scheme

- Primary: Brand colour (customizable)
- Success: Green (YES, positive P&L)
- Danger: Red (NO, negative P&L)
- Warning: Orange/Yellow (urgent actions)
- Neutral: Grays for backgrounds/borders

## Typography

- Clear, readable fonts
- Hierarchy: large titles, medium body, small metadata

## Components

- Consistent button styles (primary, secondary, danger)
- Form inputs with validation states
- Cards for markets and content blocks
- Tables for positions, transactions, leaderboard
- Badges for status indicators
- Modals/dialogs for confirmations

## Urgent Styling (for expired markets)

- Red or orange background
- Bold borders
- Large "EXPIRED" or "NEEDS RESOLUTION" badge
- Positioned at top of resolution list

---

# Backend Architecture

## Data Models

### Market

```ts
{
  id: Text;
  title: Text;
  description: Text;
  creator: Principal;
  expiryDate: Int; // timestamp
  status: "Open" | "Expired" | "Resolved";
  outcome: ?"YES" | "NO" | "CANCELED";
  isInviteOnly: Bool;
  inviteList: [Principal];
  totalVolume: Nat;
  yesVolume: Nat;
  noVolume: Nat;
  yesProbability: Float;
  noProbability: Float;
}
```

### Position

```ts
{
	marketId: Text;
	user: Principal;
	yesAmount: Nat;
	noAmount: Nat;
}
```

### Transaction

```ts
{
  id: Text;
  user: Principal;
  timestamp: Int;
  type: "Trade" | "Send" | "Receive";
  marketId: ?Text;
  amount: Nat;
  token: "ICP" | "ckUSDC";
  counterparty: ?Principal;
}
```

### User Balance

```ts
{
	principal: Principal;
	icpBalance: Nat;
	ckusdcBalance: Nat;
}
```

### Admin List

```ts
{
	owner: Principal; // immutable
	admins: Set<Principal>;
}
```

### Friend List (Planned)

```ts
{
	user: Principal;
	friends: [Principal];
}
```

---

## Backend Functions

### Markets

- `createMarket` (admin)
- `getMarkets` (public query)
- `getMarket` (public query)
- `resolveMarket` (admin)
- `placeBet` (authenticated)

### Wallet

- `getBalances` (query, authenticated)
- `sendICP` (authenticated)
- `sendCkUSDC` (authenticated)
- `getTransactions` (query, authenticated)

### Admin Management

- `getAdmins` (query, owner)
- `addAdmin` (owner)
- `removeAdmin` (owner)
- `isAdmin` (query, public)

### Friends (Planned)

- `addFriend` (authenticated)
- `removeFriend` (authenticated)
- `getFriends` (query, authenticated)

### Rush Mode (Planned)

- `getRushQueue` (query, authenticated) — returns ~10 markets

---

## Inter-Canister Calls

### ICP Ledger

- Query balance
- Transfer tokens
- Get transaction history

### ckUSDC Ledger

- Query balance
- Transfer tokens
- Get transaction history

---

## Frontend State Management

### React Query Hooks

#### Markets

- `useMarkets` — fetch all markets
- `useMarket(id)` — fetch single market
- `useCreateMarket` — mutation
- `useResolveMarket` — mutation
- `usePlaceBet` — mutation

#### Wallet

- `useWalletBalances` — query
- `useSendICP` — mutation
- `useSendCkUSDC` — mutation
- `useWalletTransactions` — query

#### Portfolio

- `usePositions` — query
- `usePortfolioStats` — query

#### Admin

- `useAdminList` — query
- `useAddAdmin` — mutation
- `useRemoveAdmin` — mutation

#### Friends (Planned)

- `useFriends` — query
- `useAddFriend` — mutation
- `useRemoveFriend` — mutation

#### Rush (Planned)

- `useRushQueue` — query
- `useRushBet` — mutation

---

## Cache Invalidation Rules

After trade:

- Invalidate balances
- Invalidate positions
- Invalidate market detail
- Invalidate transactions

After resolution:

- Invalidate markets list
- Invalidate market detail

After send/receive:

- Invalidate balances
- Invalidate transactions

After admin change:

- Invalidate admin list

---

## User Flows

### Flow 1: Unauthenticated User Browsing

1. Land on Home page
2. See markets list immediately
3. Click on a market
4. View full market details, analytics, depth, discussion
5. Attempt to place bet → Login prompt appears
6. Authenticate via Internet Identity
7. Redirect back to market
8. Place bet successfully

### Flow 2: Authenticated User Trading

1. Log in
2. Browse markets
3. Click market
4. Review probabilities and depth
5. Enter bet amount
6. Select YES or NO
7. Confirm trade
8. Balance updated
9. View position in Portfolio

### Flow 3: Admin Resolving Market

1. Log in as admin/owner
2. Navigate to Admin page
3. Scroll to Market Resolution section
4. See expired markets at top with urgent styling
5. Select outcome (YES/NO/CANCELED)
6. Click Resolve
7. Market status updated
8. Payouts distributed

### Flow 4: Owner Managing Admins

1. Log in as owner
2. Navigate to Admin page
3. Scroll to Admin Management section
4. View current admin list
5. Enter new Principal ID
6. Click Add Admin
7. Admin added

OR

1. Click Remove next to existing admin
2. Admin removed

### Flow 5: User Sending Tokens

1. Log in
2. Navigate to Wallet page
3. Click Send tab
4. Select token
5. Enter recipient Principal ID
6. Enter amount
7. Click Send
8. Transaction submitted to ledger
9. Balance updated
10. Transaction appears in History

---

## Key Implementation Details

### Authentication UX

- No login wall for browsing
- Login prompt appears contextually
- Clear messaging:
  - "Sign in to place this bet"
  - "Sign in to send tokens"

### Market Resolution Urgency

- Expired markets sorted to top
- Visual hierarchy:
  - Expired
  - Expiring soon
  - Far future

- Colour coding:
  - Red → expired
  - Orange → expiring within 24h
  - Neutral → others

### Admin vs Owner

- Owner cannot be removed
- Owner can add/remove admins
- Admins can create/resolve markets
- Both pass `isAdmin` checks

### Private Markets Logic (Planned)

- Only invitees can place bets
- All users can view market
- Invitees can see invite list

### Rush Mode Logic (Planned)

- Backend filters to open markets user can bet on
- Returns limited set (~10)
- Frontend handles swipe gestures
- Each swipe triggers immediate trade
- Next market loads automatically

---

## Future Enhancements

- Friends system fully implemented
- Private/invite-only markets operational
- Rush betting mode with swipe UI
- Profile page with user settings
- Mobile app
- Advanced analytics and charts
- Market maker roles
- Liquidity pools
- Multi-outcome markets
- API for third-party integrations

---

This specification covers every major component, flow, and technical detail of the application as currently built and planned.
