# Frontend

The frontend is a Next.js setup console for SpongeWallet.

Its job is not to execute blockchain logic directly.
It is a thin operator UI over the backend that handles:

- wallet creation
- policy configuration
- API key reveal
- wallet restore
- Claude Code setup instructions
- OpenClaw skill install instructions

## Pages

### `/`

Landing page plus restore flow.

The restore flow accepts a previously saved API key, calls `GET /v1/me`, and restores wallet context into `sessionStorage` so the user can return to the setup screen.

### `/create`

Creates a wallet and initial policy in a single backend call.

Inputs:

- optional wallet name
- expiry duration
- max transaction count
- max amount per transaction in USDC
- allowlisted recipient addresses

### `/policy`

Legacy route retained for compatibility.

### `/setup/[walletId]`

Displays:

- one-time API key from session storage
- Claude Code MCP command
- OpenClaw skill URL
- smart account funding address
- current policy summary

## Data model from the frontend's perspective

The frontend treats `address` from the backend as the smart account address.

It does not need the Turnkey owner address for normal operation.

The frontend stores minimal session state:

- `apiKey_${walletId}`
- `address_${walletId}`

This state is held in `sessionStorage`, not persisted server-side by the frontend.

## Backend contract

The frontend depends on:

- `POST /v1/wallets`
- `GET /v1/wallets/:id`
- `GET /v1/me`
- `GET /skills/openclaw.md?walletId=...`

It does not talk to the chain directly.

## UX assumptions

- Base Sepolia only
- USDC only
- the smart account is the displayed wallet address
- Pimlico sponsors user operations, so the wallet does not need ETH
- the raw API key is shown once and must be saved by the operator

## Important screens

- [app/page.tsx](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/frontend/app/page.tsx)
- [app/create/page.tsx](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/frontend/app/create/page.tsx)
- [app/setup/[walletId]/page.tsx](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/frontend/app/setup/%5BwalletId%5D/page.tsx)

## Commands

```bash
npm run dev
npm run lint
npm run build
```

## Frontend behavior guidelines

- never describe the Turnkey owner address as the wallet the user should fund
- never imply ETH is required for normal USDC sends
- never imply the API key can be recovered later if the user has not saved it
- keep Claude Code and OpenClaw instructions aligned with the backend-generated skill and MCP contracts

For broader product and runtime context, see:

- [README.md](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/README.md)
- [SOUL.md](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/SOUL.md)
- [docs/ARCHITECTURE.md](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/docs/ARCHITECTURE.md)
