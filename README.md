# Sepolia Betting dApp Frontend

Single-page frontend for contract `0x6E556F9e7e680D8bBB969D300F96ccED40E94905` on Sepolia.

Stack:

- Bun (package manager + scripts)
- Vite + React + TypeScript
- wagmi + viem
- RainbowKit
- TanStack Query
- shadcn/ui (base-nova)

Scope included in v1:

- Player flows: connect wallet, read rounds/stats, place bet, claim payout/refund.
- Privileged flows with role-gated UX:
  - Operator: create/update/delete/open/close/settle/cancel rounds.
  - Admin: mint tokens, set minimum bet.
  - Treasurer: withdraw fees.
- Realtime refresh from contract events.
- Frontend-only settled/canceled history from events (no backend indexer).
- Full transaction feedback (pending/success/error + explorer links + recent transactions).
- Dark mode only.

Excluded in v1:

- Role grant/revoke UI.
- metadataURI parsing/rendering.
- Backend indexer/subgraph.
- Automated E2E suite.

## 1) Prerequisites

- Bun `>= 1.3`
- Sepolia wallet with test ETH + GAME balance for interactions.

## 2) Environment Variables

Copy and edit env file:

```bash
cp .env.example .env
```

Required:

- `VITE_WALLETCONNECT_PROJECT_ID`: WalletConnect Cloud project ID.

Optional:

- `VITE_SEPOLIA_RPC_URL`: custom Sepolia RPC endpoint.

## 3) Run (Bun-Only)

Install dependencies:

```bash
bun install
```

Start dev server:

```bash
bun run dev
```

Type-check:

```bash
bun run typecheck
```

Lint:

```bash
bun run lint
```

Build:

```bash
bun run build
```

Run all checks:

```bash
bun run check
```

## 4) Main App Structure

- `src/main.tsx`: app entry + provider mount.
- `src/components/app-providers.tsx`: WagmiProvider -> QueryClientProvider -> RainbowKitProvider -> ThemeProvider.
- `src/App.tsx`: single-page dashboard UI and flows.
- `src/lib/web3/*`: chain config, ABI, contract helpers, mappers, formatting, error decoding.
- `src/hooks/*`: reads, writes/tx feedback, role checks, realtime sync, history loading.

## 5) Manual Verification Checklist

Player flow:

1. Connect wallet on Sepolia.
2. Confirm active rounds/stats render.
3. Place bet on an OPEN round with amount >= min bet.
4. Claim payout/refund using claim center after round finalization.

Privileged flow:

1. Confirm role-gated panels are visible with disabled warnings when role is missing.
2. As operator, exercise round lifecycle actions.
3. As admin, mint and update min bet.
4. As treasurer, withdraw fees.

Sync/history flow:

1. Trigger on-chain events (`BetPlaced`, `RoundOpened`, `RoundSettled`, `RoundCanceled`, `PayoutClaimed`, `RefundClaimed`).
2. Confirm UI refreshes without manual reload.
3. Confirm history tab updates and supports loading older block windows.

## 6) Notes

- WalletConnect project ID can be placeholder in local development but must be replaced before production.
- History is browser-cached event aggregation in block windows; this is intentionally limited for v1.
- Randomness in the contract is demo-level and not suitable for high-value production betting.
