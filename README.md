# SpongeWallet

SpongeWallet is a managed AI-agent wallet for Base Sepolia that gives an agent a sponsored USDC spending account with server-enforced policy limits.

This branch uses:

- Turnkey for owner key custody and signing
- ERC-4337 smart accounts (`SimpleAccount`, EntryPoint `0.7`)
- Pimlico for bundling and paymaster sponsorship
- `viem` for chain reads, calldata encoding, and client wiring
- SQLite for local persistence
- MCP plus REST so Claude Code and OpenClaw can both use the same wallet

## What the product does

The app creates a smart account for an AI agent, issues an API key for that wallet, and lets the agent:

- read the wallet's USDC balance
- send USDC to an allowlisted set of addresses
- inspect its own transaction history

Every send is checked against a server-side policy before a user operation is submitted:

- expiry timestamp
- remaining transaction count
- per-transaction USDC limit
- recipient allowlist
- on-chain USDC balance

## High-level architecture

The system has two apps:

- `/backend`
  - Express API
  - SQLite persistence
  - Turnkey integration
  - smart-account derivation
  - Pimlico bundler/paymaster integration
  - MCP endpoint
- `/frontend`
  - Next.js onboarding and setup UI
  - API key reveal and restore flow
  - Claude Code / OpenClaw integration instructions

The wallet model is:

1. Turnkey provisions an owner EOA.
2. The backend derives a Base Sepolia `SimpleAccount` from that owner.
3. The smart account address is the address shown to the user and the one that receives USDC.
4. The agent authenticates with a bearer API key.
5. When the agent sends USDC, the backend validates policy and uses Pimlico to submit a sponsored user operation.

The smart account is the funded wallet.
The Turnkey owner address is an implementation detail stored for signing and recovery of the smart account identity.

## Main user flows

### Wallet creation

1. The frontend posts to `POST /v1/wallets`.
2. The backend provisions a Turnkey wallet/account.
3. The backend derives the smart account address.
4. The backend stores:
   - owner address
   - smart account address
   - Turnkey wallet/account ids
   - policy
   - bcrypt-hashed API key
5. The frontend shows:
   - API key
   - MCP command
   - OpenClaw skill URL
   - smart account funding address

### Balance read

1. The agent calls REST or MCP with the bearer API key.
2. The backend resolves the wallet from the API key.
3. The backend reads `USDC.balanceOf(smartAccountAddress)` on Base Sepolia.
4. The backend returns the human-readable USDC balance.

### Sponsored send

1. The agent calls `send_payment(to, amountUsdc)`.
2. The backend authenticates the API key.
3. The backend validates:
   - wallet exists
   - policy exists
   - policy not expired
   - remaining tx count > 0
   - recipient is allowlisted
   - amount is within the per-tx limit
   - smart account has enough USDC
4. The backend encodes a normal ERC-20 `transfer(address,uint256)` call.
5. The backend creates a Turnkey-backed owner account.
6. The backend derives the `SimpleAccount`.
7. The backend submits a sponsored user operation through Pimlico.
8. On confirmation, the backend:
   - stores `userOpHash`
   - stores `txHash`
   - marks the transaction `confirmed`
   - decrements remaining tx count

## Current scope

- Base Sepolia only
- USDC only
- sponsored user operations
- one policy per wallet, with the latest policy considered active

## Explicit non-goals in this branch

- mainnet support
- ETH sends
- arbitrary ERC-20s
- swaps, bridges, or commerce integrations
- non-custodial end-user signing from the browser
- multi-chain routing

## Important files

- [SOUL.md](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/SOUL.md)
- [backend/README.md](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/backend/README.md)
- [frontend/README.md](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/frontend/README.md)
- [docs/ARCHITECTURE.md](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/docs/ARCHITECTURE.md)
- [docs/OPERATIONS.md](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/docs/OPERATIONS.md)

## Required backend environment

See [backend/.env.example](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/backend/.env.example).

Key variables:

- `BASE_SEPOLIA_RPC_URL`
- `TURNKEY_ORGANIZATION_ID`
- `TURNKEY_API_PUBLIC_KEY`
- `TURNKEY_API_PRIVATE_KEY`
- `PIMLICO_BUNDLER_URL`
- `PIMLICO_PAYMASTER_URL`
- `BACKEND_URL`

## Local development

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Verification

Automated checks:

- `cd backend && npm test`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`

Live smoke test:

1. Create a wallet.
2. Fund the smart account with Base Sepolia USDC.
3. Call `GET /v1/balance`.
4. Call `POST /v1/payments`.
5. Call `GET /v1/transactions`.
6. Call the MCP `get_balance` and `get_transaction_history` tools.

## Notes on trust and control

This is not a fully self-custodial wallet product.

The backend is still the control plane:

- it decides which requests are allowed
- it selects the active policy
- it submits user operations
- it exposes agent-facing APIs

Turnkey protects owner keys from raw exposure, but the product remains a managed wallet system.
