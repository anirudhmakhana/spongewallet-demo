# Backend

Express + TypeScript backend for a gasless USDC wallet on Base Sepolia.

## Core services

- `turnkeyService.ts` — wallet provisioning and typed-data signing
- `usdcService.ts` — USDC balance reads and `transferWithAuthorization` encoding
- `gelatoRelayService.ts` — sponsored relay submission and status polling
- `policyService.ts` — expiry, tx-count, allowlist, and max-USDC validation
- `mcpService.ts` — Claude/OpenClaw-facing MCP tools

## Database tables

- `wallets`
- `api_keys`
- `policies`
- `allowlist_entries`
- `authorizations`
- `transactions`

## API

- `POST /v1/wallets`
- `GET /v1/wallets/:id`
- `POST /v1/wallets/:id/policy`
- `POST /v1/wallets/:id/api-keys`
- `GET /v1/balance`
- `POST /v1/payments`
- `GET /v1/transactions`
- `GET /skills/openclaw.md`
- `POST /mcp`

## MCP tools

- `get_balance`
- `send_payment({ to, amountUsdc })`
- `get_transaction_history({ limit? })`

## Commands

- `npm run dev`
- `npm run build`
- `npm test`
