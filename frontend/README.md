# Frontend

Next.js setup UI for the gasless USDC SpongeWallet flow.

## Pages

- `/` — landing page
- `/create` — create wallet + policy in one call
- `/policy` — legacy redirect to `/create`
- `/setup/[walletId]` — show API key, MCP command, skill URL, wallet address, and policy summary

## Backend contract

The frontend expects:

- `POST /v1/wallets`
- `GET /v1/wallets/:id`
- `GET /skills/openclaw.md?walletId=...`

## UX assumptions

- Base Sepolia only
- USDC only
- Gelato sponsors gas
- the raw API key is shown once and kept only in `sessionStorage`
