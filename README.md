# SpongeWallet

Gasless USDC agent wallet on Base Sepolia.

This repo now uses:

- `Turnkey` for wallet provisioning and EIP-712 signing
- `Gelato Turbo Relayer` for sponsored relay submission
- Circle USDC `transferWithAuthorization` on Base Sepolia
- `viem` only for chain reads, ABI encoding, and transaction helpers

## Apps

- `/backend` — Express + TypeScript API, SQLite persistence, MCP server
- `/frontend` — Next.js + TypeScript setup UI

## Runtime model

1. The backend creates a Turnkey-backed wallet/account.
2. The app stores wallet metadata and a bcrypt-hashed API key in SQLite.
3. The user funds the wallet with Base Sepolia USDC.
4. An agent calls `send_payment`.
5. The backend validates policy limits and allowlist rules.
6. Turnkey signs a USDC `transferWithAuthorization` payload.
7. Gelato submits the call and sponsors gas.

## Required backend env vars

See [backend/.env.example](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/backend/.env.example).

## Verification

- Backend: `npm test` and `npm run build` in `/backend`
- Frontend: `npm run lint` and `npm run build` in `/frontend`
