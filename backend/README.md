# SpongeWallet Backend

Express + TypeScript server that manages custodial wallets on Base Sepolia. Handles key generation, AES-256-GCM encryption, policy enforcement, and an MCP server that AI agents connect to directly.

---

## Directory structure

```
backend/
├── src/
│   ├── index.ts                    # Entry point — Express app setup, route mounting
│   ├── config/
│   │   └── index.ts                # Env vars: ENCRYPTION_SECRET, PORT, BACKEND_URL
│   ├── db/
│   │   └── schema.ts               # SQLite init, table definitions, shared db instance
│   ├── routes/
│   │   ├── wallets.ts              # POST /v1/wallets, GET /v1/wallets/:id, policy + api-key sub-routes
│   │   ├── payments.ts             # GET /v1/balance, POST /v1/payments, GET /v1/transactions
│   │   └── skills.ts               # GET /skills/openclaw.md
│   ├── services/
│   │   ├── walletService.ts        # Key generation, AES-256-GCM encrypt/decrypt, SQLite wallet CRUD
│   │   ├── policyService.ts        # Policy CRUD, payment validation pipeline, tx recording
│   │   ├── paymentService.ts       # viem walletClient — signs and broadcasts the actual tx
│   │   └── mcpService.ts           # MCP server factory — auth + tool dispatch per request
│   └── mcp/
│       └── tools/
│           ├── get_balance.ts      # MCP tool: get_balance
│           ├── send_payment.ts     # MCP tool: send_payment
│           └── get_transaction_history.ts  # MCP tool: get_transaction_history
├── src/tests/
│   ├── wallet.test.ts              # 11 unit tests: keygen, encrypt/decrypt, bcrypt
│   └── policy.test.ts              # 6 unit tests: payment validation pipeline
├── .env.example
├── spongewallet.db                 # SQLite file created on first run
└── package.json
```

---

## Environment variables

```
ENCRYPTION_SECRET   required, min 32 chars — SHA-256 hashed to produce the AES-256 key
PORT                default 3001
BACKEND_URL         default http://localhost:3001 — embedded in generated skill.md files
```

`ENCRYPTION_SECRET` is SHA-256 hashed at runtime in `walletService.ts` to produce the 32-byte AES key. This means any string >= 32 chars works as input, but changing it after wallets exist will make those wallets permanently unrecoverable.

---

## Database schema

Five tables, all using UUID primary keys and Unix timestamps in milliseconds.

```sql
wallets (
  id TEXT PRIMARY KEY,           -- UUID
  address TEXT,                  -- 0x... checksummed
  encryptedPrivateKey TEXT,      -- "iv:authTag:ciphertext" hex
  createdAt INTEGER
)

api_keys (
  id TEXT PRIMARY KEY,
  walletId TEXT,                 -- FK → wallets.id
  keyHash TEXT,                  -- bcrypt hash of "walletId.hexsecret"
  createdAt INTEGER
)

policies (
  id TEXT PRIMARY KEY,
  walletId TEXT,                 -- FK → wallets.id
  expiresAt INTEGER,             -- Unix ms
  maxTransactions INTEGER,
  remainingTransactions INTEGER, -- decremented on each successful send
  maxAmountPerTxEth TEXT,        -- stored as decimal string to avoid float precision issues
  createdAt INTEGER
)

allowlist_entries (
  id TEXT PRIMARY KEY,
  policyId TEXT,                 -- FK → policies.id
  address TEXT                   -- lowercase normalized
)

transactions (
  id TEXT PRIMARY KEY,
  walletId TEXT,                 -- FK → wallets.id
  txHash TEXT,
  toAddress TEXT,
  amountEth TEXT,
  sentAt INTEGER
)
```

`getActivePolicy()` always returns the most recently created policy for a wallet (`ORDER BY createdAt DESC LIMIT 1`). There's no "active flag" — latest wins.

---

## Service layer deep dive

### walletService.ts

**Key generation:**
```typescript
generateWallet()
  → viem's generatePrivateKey()     // cryptographically random 32-byte privkey
  → privateKeyToAddress(privateKey) // secp256k1 pubkey → keccak256 → address
  → { privateKey, address }
```

**Encryption (`encryptPrivateKey`):**
```
ENCRYPTION_SECRET
  → SHA-256 → 32-byte AES key
  → randomBytes(16) → IV (unique per encryption)
  → AES-256-GCM encrypt(privateKey)
  → produces: ciphertext + 16-byte authTag
  → stored as: "iv_hex:authTag_hex:ciphertext_hex"
```

GCM mode provides both confidentiality (encryption) and integrity (auth tag). If the ciphertext is tampered with, `decipher.final()` throws before the key is returned.

**Decryption (`decryptPrivateKey`):**
Splits the stored string on `:`, reconstructs IV + authTag + ciphertext, runs `createDecipheriv` with the same key, calls `setAuthTag`, and decrypts. Any corruption throws — the plaintext private key is never returned in that case.

---

### policyService.ts

The most critical file. Contains the payment validation pipeline that every send must pass.

**`createPolicy(walletId, expiresAt, maxTransactions, maxAmountPerTxEth, allowedRecipients)`**

Inserts one row into `policies` (with `remainingTransactions = maxTransactions`) and one row per address into `allowlist_entries`. Addresses are stored lowercase-normalized.

**`getActivePolicy(walletId)`**

Queries `policies` for the latest row, then joins `allowlist_entries` to reconstruct the `allowedRecipients` array. Returns `null` if no policy exists.

**`validatePaymentRequest(apiKey, walletId, to, amountEth)`**

10-step pipeline, executed in strict order. Returns `{ valid: true, wallet, policy }` or `{ valid: false, error }`. Never signs if any step fails.

```
Step 1 — Authenticate API key
  Extract walletId from "walletId.hexsecret" format (dot as separator)
  Query api_keys WHERE walletId = ?
  bcrypt.compare(rawKey, storedHash) for each row
  → Fail: "Invalid API key"

Step 2 — Load wallet + active policy
  getWallet(walletId) + getActivePolicy(walletId)
  → Fail: "Wallet not found" or "No active policy"

Step 3 — Expiry check
  policy.expiresAt > Date.now()
  → Fail: "Policy has expired"

Step 4 — Transaction count
  policy.remainingTransactions > 0
  → Fail: "No remaining transactions in policy"

Step 5 — Allowlist check
  to.toLowerCase() in policy.allowedRecipients
  → Fail: "Recipient address X is not in the allowlist"

Step 6 — Amount ceiling
  parseEther(amountEth) <= parseEther(maxAmountPerTxEth)
  (comparison in wei — no float arithmetic)
  → Fail: "Amount X ETH exceeds limit of Y ETH"

Step 7 — On-chain balance
  publicClient.getBalance({ address: wallet.address })
  balance >= amountWei + parseEther("0.0005")  // 0.0005 ETH gas buffer
  → Fail: "Insufficient balance. Have X ETH, need Y ETH + gas"

→ Return { valid: true, wallet, policy }
```

After a successful send, two more operations run:

```
Step 8  — recordTransaction(walletId, txHash, toAddress, amountEth)
          INSERT into transactions table

Step 9  — decrementRemainingTransactions(policyId)
          UPDATE policies SET remainingTransactions = remainingTransactions - 1
          RETURNING remainingTransactions
```

These happen after the transaction is confirmed on-chain, so the count is only decremented for real sends.

---

### paymentService.ts

Thin wrapper around viem. Takes a decrypted private key string and sends a native ETH transfer on Base Sepolia.

```typescript
privateKeyToAccount(decryptedPrivateKey)
  → account object

createWalletClient({ account, chain: baseSepolia, transport: http() })
  → walletClient

walletClient.sendTransaction({ to, value: parseEther(amountEth) })
  → txHash (hex)

publicClient.waitForTransactionReceipt({ hash: txHash })
  → waits for 1 confirmation before returning
```

The private key lives in memory only during this function call. It is not stored, not logged, and goes out of scope when the function returns.

---

### mcpService.ts

Creates a fresh MCP `Server` instance per HTTP request. This is stateless — each `POST /mcp` call gets its own server.

**Auth flow:**
```
req.headers.authorization = "Bearer walletId.hexsecret"
  → extract walletId from prefix (everything before first dot)
  → query api_keys WHERE walletId = ?
  → bcrypt.compare for each row
  → if match: { walletId, apiKey } passed to tool handlers
  → if no match: 401
```

**Tool dispatch:**
```
ListToolsRequestSchema → returns [getBalanceTool, sendPaymentTool, getTransactionHistoryTool]

CallToolRequestSchema → switch on tool name:
  "get_balance"            → getBalanceHandler(walletId, args)
  "send_payment"           → sendPaymentHandler(walletId, apiKey, args)
  "get_transaction_history"→ getTransactionHistoryHandler(walletId, args)
```

Uses `StreamableHTTPServerTransport` with `sessionIdGenerator: undefined` — stateless mode. The MCP SDK handles the protocol framing; the handler just returns JSON content.

---

## Routes

### wallets.ts

**`POST /v1/wallets`**

Accepts optional body `{ name, expiresAt, maxTransactions, maxAmountPerTxEth, allowedRecipients }`.

- Always: generates keypair, encrypts private key, stores wallet.
- If policy fields present: validates all fields (same rules as the sub-route), calls `createPolicy`, generates and bcrypt-hashes an API key, returns `{ walletId, address, apiKey }`.
- If no policy fields: returns `{ walletId, address }` (backward compat).

Partial policy fields (e.g. only `expiresAt` provided) → 400 error requiring all or none.

**`GET /v1/wallets/:id`**

Returns wallet address + active policy if one exists. No auth — walletId is a UUID, treated as a non-secret identifier.

**`POST /v1/wallets/:id/policy`**

Creates a new policy for an existing wallet. Replaces the effective policy (latest row wins on read). Used for policy updates after creation.

**`POST /v1/wallets/:id/api-keys`**

Generates a new API key for an existing wallet. Raw key returned once, never stored. Useful for re-keying if the original key is lost.

### payments.ts

All three endpoints parse `Authorization: Bearer` with the same `extractWalletIdFromBearer` helper. The walletId prefix avoids a full table scan before bcrypt.

**`GET /v1/balance`** — reads balance from Base Sepolia via viem `publicClient.getBalance`.

**`POST /v1/payments`** — runs the full 10-step `validatePaymentRequest` pipeline, then `sendPayment`, `recordTransaction`, `decrementRemainingTransactions`.

**`GET /v1/transactions`** — returns `transactions` rows for the wallet, ordered by `sentAt DESC`, limit 1–100.

### skills.ts

**`GET /skills/openclaw.md?walletId=x&apiKey=x`**

Authenticates the API key, loads the active policy, generates a markdown skill file embedding:
- MCP server URL and auth token
- `claude mcp add` command (ready to copy-paste)
- All three tool signatures with return shapes
- REST API quick reference
- Live policy values (wallet address, expiry ISO, remaining tx, max ETH, allowlist)
- Rules for the agent to follow
- Error reference with HTTP status codes

The file is served as `text/plain` and can be fetched directly by OpenClaw's `/install` command or downloaded from the setup page.

---

## Running tests

```bash
npm run test
```

17 tests across two files:

`wallet.test.ts` (11 tests):
- `generateWallet()` produces valid address and private key
- Each call produces a unique keypair
- `encryptPrivateKey` + `decryptPrivateKey` round-trips correctly
- Each encryption uses a unique IV (ciphertexts differ for same input)
- AES auth tag catches tampered ciphertext
- bcrypt hash/verify round-trip for API key format

`policy.test.ts` (6 tests):
- Full valid payment request passes all 7 steps
- Invalid API key → step 1 failure
- Expired policy → step 3 failure
- Zero remaining transactions → step 4 failure
- Non-allowlisted address → step 5 failure
- Amount over limit → step 6 failure

---

## Starting the server

```bash
# Development (tsx watch)
npm run dev

# Production build
npm run build
npm start
```

The SQLite database is created at `backend/spongewallet.db` on first run. Tables are created with `CREATE TABLE IF NOT EXISTS` — safe to restart without data loss.
