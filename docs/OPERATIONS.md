# Operations

This document explains how to run, test, and troubleshoot SpongeWallet.

## Required environment

Backend env:

- `PORT`
- `BACKEND_URL`
- `BASE_SEPOLIA_RPC_URL`
- `TURNKEY_ORGANIZATION_ID`
- `TURNKEY_API_PUBLIC_KEY`
- `TURNKEY_API_PRIVATE_KEY`
- `PIMLICO_BUNDLER_URL`
- `PIMLICO_PAYMASTER_URL`
- `USDC_BASE_SEPOLIA_ADDRESS`
- `USDC_DECIMALS`

Reference:

- [backend/.env.example](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/backend/.env.example)

## Provider expectations

### RPC

Use a reliable HTTPS Base Sepolia RPC.

Avoid:

- anonymous public endpoints with hard rate limits
- websocket-only URLs unless the backend is explicitly using WebSocket transport

Symptoms of bad RPC configuration:

- balance reads fail
- sends fail before user operation submission
- `eth_call` or `eth_getCode` request failures
- `429 Too Many Requests`

### Pimlico

The configured bundler and paymaster URLs must both be valid.

Symptoms of Pimlico issues:

- user operation sponsorship failures
- paymaster rejections
- bundler submission errors
- sends failing after policy validation but before final tx receipt

### Turnkey

Turnkey credentials must have enough permissions to:

- create wallets
- read wallet accounts
- sign as the owner address

Symptoms of Turnkey issues:

- wallet creation fails
- smart-account derivation cannot sign
- send flow fails during signer creation

## Local startup

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

## Automated checks

Backend tests:

```bash
cd backend
npm test
```

Frontend lint:

```bash
cd frontend
npm run lint
```

Frontend production build:

```bash
cd frontend
npm run build
```

## Manual smoke test

### 1. Create a wallet

Call:

```bash
curl -sS -X POST http://127.0.0.1:3001/v1/wallets \
  -H 'Content-Type: application/json' \
  --data '{
    "name":"Smoke Test",
    "expiresAt":1794556800000,
    "maxTransactions":5,
    "maxAmountPerTxUsdc":"1.00",
    "allowedRecipients":["0x4c6923045ad957d41227bf3bd4dcc26908545784"]
  }'
```

Verify you get:

- `walletId`
- `address`
- `apiKey`

### 2. Fund the smart account

Send Base Sepolia USDC to the returned `address`.

The wallet should not require ETH for the supported USDC path.

### 3. Check balance

```bash
curl -sS http://127.0.0.1:3001/v1/balance \
  -H 'Authorization: Bearer <api-key>'
```

### 4. Send USDC

```bash
curl -sS -X POST http://127.0.0.1:3001/v1/payments \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <api-key>' \
  --data '{"to":"0x4c6923045ad957d41227bf3bd4dcc26908545784","amountUsdc":"0.01"}'
```

Expect:

- `txHash`
- `explorerUrl`
- decremented `remainingTransactions`

### 5. Check history

```bash
curl -sS http://127.0.0.1:3001/v1/transactions \
  -H 'Authorization: Bearer <api-key>'
```

Expect a row with:

- `userOpHash`
- `txHash`
- `status: "confirmed"`

## MCP smoke test

Initialize:

```bash
curl -sS -X POST http://127.0.0.1:3001/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Authorization: Bearer <api-key>' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke-test","version":"1.0.0"}}}'
```

List tools:

```bash
curl -sS -X POST http://127.0.0.1:3001/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Authorization: Bearer <api-key>' \
  --data '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

Call `get_balance`:

```bash
curl -sS -X POST http://127.0.0.1:3001/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Authorization: Bearer <api-key>' \
  --data '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_balance","arguments":{}}}'
```

## Common failure modes

### `401 Unauthorized`

Cause:

- missing bearer token
- invalid API key

### `400 Policy has expired`

Cause:

- `expiresAt` is in the past

### `400 No remaining transactions in policy`

Cause:

- tx budget exhausted

### `400 Recipient ... is not in the allowlist`

Cause:

- attempted send to a non-allowlisted address

### `400 Insufficient USDC balance`

Cause:

- smart account lacks enough USDC

### `500` during chain reads

Likely causes:

- RPC outage
- RPC rate limit
- bad RPC URL scheme

### `500` during user operation submission

Likely causes:

- Pimlico paymaster issues
- Pimlico bundler issues
- unsupported sponsorship config

## Important operational facts

- The address shown in the UI is the smart account and is the one to fund.
- The Turnkey owner EOA is not the deposit address.
- Successful sends decrement policy count only after confirmation.
- Transaction history is local application history, not reconstructed from chain indexing.
- If the schema version changes, the current initialization path recreates the schema.

## Recommended operator checklist

Before demos:

1. confirm backend starts cleanly
2. confirm the RPC endpoint is healthy
3. confirm Pimlico paymaster sponsorship is active
4. create a fresh wallet
5. fund it with Base Sepolia USDC
6. run one REST send
7. run one MCP read

If all seven pass, the stack is in a good state for a demo.
