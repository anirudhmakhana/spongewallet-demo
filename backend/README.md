# Backend

The backend is the control plane for SpongeWallet.

It is an Express + TypeScript service that:

- provisions Turnkey-backed owner wallets
- derives ERC-4337 smart accounts on Base Sepolia
- authenticates bearer API keys
- validates wallet policy
- submits sponsored user operations through Pimlico
- records transaction history in SQLite
- exposes both REST and MCP interfaces

## Stack

- Node.js
- TypeScript
- Express
- `better-sqlite3`
- `viem`
- `permissionless`
- Turnkey server SDK
- MCP SDK

## Runtime responsibilities

### Authentication

Bearer API keys are stored hashed with bcrypt.
The backend never stores plaintext API keys after creation.

### Wallet provisioning

Wallet creation happens through Turnkey.

The backend stores:

- Turnkey wallet id
- Turnkey account id
- owner address
- derived smart account address

### Policy enforcement

All payment requests pass through policy validation before submission.

Current rules:

- policy must exist
- policy must not be expired
- remaining transaction count must be positive
- recipient must be allowlisted
- requested amount must be within the configured max
- smart account must hold enough USDC

### Smart-account execution

The send path is:

1. validate policy
2. encode USDC `transfer(address,uint256)`
3. derive the `SimpleAccount`
4. build a sponsored smart-account client
5. submit the user operation
6. wait for receipt
7. persist `userOpHash`, `txHash`, and status
8. decrement remaining tx count only after confirmation

## File map

### Core configuration

- [src/config/index.ts](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/backend/src/config/index.ts)
  - env loading
  - Base Sepolia config
  - required runtime variables

### Database

- [src/db/schema.ts](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/backend/src/db/schema.ts)
  - SQLite schema
  - schema recreation logic
  - current schema version

### Services

- [src/services/authService.ts](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/backend/src/services/authService.ts)
  - bearer auth and wallet lookup
- [src/services/walletService.ts](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/backend/src/services/walletService.ts)
  - wallet metadata storage
  - API key creation
- [src/services/turnkeyService.ts](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/backend/src/services/turnkeyService.ts)
  - Turnkey wallet provisioning
  - Turnkey-backed owner account creation
- [src/services/smartAccountService.ts](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/backend/src/services/smartAccountService.ts)
  - `SimpleAccount` derivation
- [src/services/pimlicoService.ts](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/backend/src/services/pimlicoService.ts)
  - bundler/paymaster clients
  - sponsored smart-account client creation
- [src/services/usdcService.ts](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/backend/src/services/usdcService.ts)
  - USDC ABI
  - balance reads
  - ERC-20 calldata encoding
  - RPC transport setup
- [src/services/policyService.ts](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/backend/src/services/policyService.ts)
  - policy reads/writes
  - send validation
  - transaction persistence
- [src/services/paymentService.ts](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/backend/src/services/paymentService.ts)
  - end-to-end sponsored send orchestration
- [src/services/mcpService.ts](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/backend/src/services/mcpService.ts)
  - MCP server wiring

### Routes

- [src/routes/wallets.ts](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/backend/src/routes/wallets.ts)
- [src/routes/payments.ts](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/backend/src/routes/payments.ts)
- [src/routes/skills.ts](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/backend/src/routes/skills.ts)

### MCP tools

- [src/mcp/tools/get_balance.ts](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/backend/src/mcp/tools/get_balance.ts)
- [src/mcp/tools/send_payment.ts](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/backend/src/mcp/tools/send_payment.ts)
- [src/mcp/tools/get_transaction_history.ts](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/backend/src/mcp/tools/get_transaction_history.ts)

## Database schema

### `wallets`

- `id`
- `ownerAddress`
- `smartAccountAddress`
- `turnkeyWalletId`
- `turnkeyAccountId`
- `createdAt`

### `api_keys`

- `id`
- `walletId`
- `keyHash`
- `createdAt`

### `policies`

- `id`
- `walletId`
- `expiresAt`
- `maxTransactions`
- `remainingTransactions`
- `maxAmountPerTxUsdc`
- `createdAt`

### `allowlist_entries`

- `id`
- `policyId`
- `address`

### `transactions`

- `id`
- `walletId`
- `userOpHash`
- `txHash`
- `toAddress`
- `amountUsdc`
- `status`
- `sentAt`

## REST API

### `POST /v1/wallets`

Creates:

- Turnkey owner wallet
- derived smart account
- initial policy
- API key

Returns:

- `walletId`
- `address` (smart account address)
- `apiKey`

### `GET /v1/me`

Restores wallet context from the bearer API key.

### `GET /v1/wallets/:id`

Returns public wallet metadata and active policy.

### `POST /v1/wallets/:id/policy`

Creates a new policy row for an existing wallet.
The latest row is treated as active.

### `POST /v1/wallets/:id/api-keys`

Issues a new API key for the wallet.

### `GET /v1/balance`

Returns:

- smart account address
- chain
- symbol
- current USDC balance

### `POST /v1/payments`

Body:

```json
{
  "to": "0x...",
  "amountUsdc": "0.01"
}
```

Returns:

- `txHash`
- `explorerUrl`
- `remainingTransactions`

### `GET /v1/transactions`

Returns persisted transaction rows including:

- `userOpHash`
- `txHash`
- `status`
- `toAddress`
- `amountUsdc`
- `sentAt`

## MCP

The MCP endpoint is:

- `POST /mcp`

Tool names are stable:

- `get_balance`
- `send_payment`
- `get_transaction_history`

Agents authenticate with the same bearer API key used for REST.

## Environment

See [backend/.env.example](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/backend/.env.example).

Required values:

- `BASE_SEPOLIA_RPC_URL`
- `TURNKEY_ORGANIZATION_ID`
- `TURNKEY_API_PUBLIC_KEY`
- `TURNKEY_API_PRIVATE_KEY`
- `PIMLICO_BUNDLER_URL`
- `PIMLICO_PAYMASTER_URL`

## Commands

```bash
npm run dev
npm run build
npm test
```

## Operational notes

- The smart account should be funded with USDC, not ETH.
- Pimlico sponsorship must remain active for sends to succeed.
- A poor or rate-limited RPC can still break reads and preflight checks even if Pimlico is healthy.
- The backend recreates schema when the schema version changes, so treat schema changes carefully.

For deeper runtime and troubleshooting guidance, see:

- [docs/ARCHITECTURE.md](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/docs/ARCHITECTURE.md)
- [docs/OPERATIONS.md](/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/docs/OPERATIONS.md)
