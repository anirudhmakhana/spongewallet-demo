# SpongeWallet

A custodial agent wallet on Base Sepolia. You create a wallet, set spending limits, and hand an AI agent a single command to connect. The agent can then send ETH autonomously — but only within the policy you defined.

No private keys leave the server. No mainnet. No Privy. Just a managed wallet with server-enforced limits and an MCP interface that Claude Code speaks natively.

---

## What this is

Most AI agent wallet setups have the same problem: either the agent holds the private key (dangerous) or it goes through a full smart contract wallet (complex). SpongeWallet takes a third path — **custodial with enforced policy**.

You keep the private key on your server. The agent gets an API token. Every time the agent tries to send ETH, the backend runs through a policy check before ever touching the key. If any limit is exceeded, the send is rejected with a clear error. The agent never sees the key, never bypasses the policy, and always gets an answer it can report back to the user.

```
┌─────────────────────────────────────────────────────────────────┐
│                        SpongeWallet                             │
│                                                                 │
│   You define the rules.      Agent operates within them.        │
│                                                                 │
│   ┌──────────────────┐       ┌──────────────────────────────┐  │
│   │  Spending Policy │       │        AI Agent              │  │
│   │                  │       │   (Claude Code / OpenClaw)   │  │
│   │  ✓ Expires: 24h  │       │                              │  │
│   │  ✓ Max txns: 10  │──────►│  Can send ETH, check         │  │
│   │  ✓ Max/tx: 0.01  │       │  balance, view history       │  │
│   │  ✓ Allowlist: 2  │       │                              │  │
│   │    addresses     │       │  Cannot exceed any limit     │  │
│   └──────────────────┘       └──────────────────────────────┘  │
│                                                                 │
│   Private key stays on server. Agent only has an API token.     │
└─────────────────────────────────────────────────────────────────┘
```

---

## The full picture — how data flows

### Step 1: You create a wallet (browser → backend)

```
Browser (localhost:3000)              Backend (localhost:3001)
          │                                    │
          │  POST /v1/wallets                  │
          │  {                                 │
          │    name: "my agent",               │
          │    expiresAt: <ms timestamp>,      │
          │    maxTransactions: 10,            │
          │    maxAmountPerTxEth: "0.01",      │
          │    allowedRecipients: ["0x..."]    │
          │  }                                 │
          │───────────────────────────────────►│
          │                                    │ 1. viem generates keypair
          │                                    │    (secp256k1, random 32 bytes)
          │                                    │ 2. SHA-256(ENCRYPTION_SECRET)
          │                                    │    → 32-byte AES key
          │                                    │ 3. randomBytes(16) → IV
          │                                    │ 4. AES-256-GCM encrypt(privKey)
          │                                    │    store "iv:authTag:cipher" in SQLite
          │                                    │ 5. INSERT policies row
          │                                    │    INSERT allowlist_entries rows
          │                                    │ 6. randomBytes(32) → raw secret
          │                                    │    bcrypt.hash("walletId.secret", 12)
          │                                    │    store hash in SQLite
          │◄───────────────────────────────────│
          │  {                                 │
          │    walletId: "uuid",               │
          │    address: "0x...",               │  ← fund this address
          │    apiKey: "uuid.hexsecret"        │  ← shown once, never stored raw
          │  }                                 │
          │                                    │
          │  /setup/:walletId page renders     │
          │  → shows claude mcp add command    │
          │  → shows wallet address to fund    │
          │  → shows policy summary            │
```

### Step 2: You fund the wallet

Copy the wallet address from the setup page. Go to the Base Sepolia faucet and send some test ETH to that address. The backend reads the balance on-chain via viem before every send — no funding record needed in the database.

```
Faucet ──── testnet ETH ────► Wallet address (0x...)
                                      │
                              checked live by backend
                              on each send_payment call
```

### Step 3: You connect your agent (one command)

Copy the `claude mcp add` command from the setup page and run it once in your terminal:

```
claude mcp add --transport http spongewallet http://localhost:3001/mcp \
  --header "Authorization: Bearer <walletId.hexsecret>"
```

That registers the MCP server globally in Claude Code. From this point, every Claude Code session has access to the `spongewallet` tools.

### Step 4: Agent sends transactions (agent → backend → chain)

```
Claude Code                  Backend                    Base Sepolia
     │                          │                            │
     │  POST /mcp               │                            │
     │  tool: send_payment      │                            │
     │  { to: "0x...",          │                            │
     │    amountEth: "0.005" }  │                            │
     │  Authorization: Bearer …─►                            │
     │                          │ ① auth: bcrypt verify key  │
     │                          │ ② load wallet + policy     │
     │                          │ ③ expiresAt > now?         │
     │                          │ ④ remainingTxns > 0?       │
     │                          │ ⑤ "0x..." in allowlist?    │
     │                          │ ⑥ 0.005 ≤ 0.01 ETH?       │
     │                          │ ⑦ balance ≥ 0.005 + gas?  │
     │                          │                            │
     │                          │   ALL PASS                 │
     │                          │                            │
     │                          │ decrypt privKey (memory)   │
     │                          │ viem.sendTransaction ─────►│
     │                          │◄── txHash confirmed        │
     │                          │                            │
     │                          │ record tx in SQLite        │
     │                          │ decrement remainingTxns    │
     │◄─ { txHash,              │                            │
     │     explorerUrl,         │                            │
     │     remainingTxns: 9 }   │                            │
```

If any check fails, the private key is never decrypted and the agent receives a clear error:

```
① → "Invalid API key"
③ → "Policy has expired"
④ → "No remaining transactions in policy"
⑤ → "Recipient address 0x... is not in the allowlist"
⑥ → "Amount 0.02 ETH exceeds limit of 0.01 ETH"
⑦ → "Insufficient balance. Have 0.003 ETH, need 0.005 ETH + gas"
```

---

## Understanding the create wallet form

When you open `http://localhost:3000/create`, you'll see this form:

```
┌─────────────────────────────────────────────────────┐
│  Create Agent Wallet                                │
│  Generate a managed ETH wallet on Base Sepolia      │
│  with spending limits                               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Wallet Name (optional)                             │
│  ┌───────────────────────────────────────────────┐  │
│  │  my trading agent                             │  │
│  └───────────────────────────────────────────────┘  │
│  Just a label for you — not used in auth            │
│                                                     │
│  Expires In                                         │
│  ┌───────────────────────────────────────────────┐  │
│  │  24 hours                               ▼    │  │
│  └───────────────────────────────────────────────┘  │
│  After this, all sends are rejected — even with     │
│  transactions remaining. Forces re-authorization.   │
│  Options: 1h / 6h / 24h / 7d / 30d                 │
│                                                     │
│  Max Transactions                                   │
│  ┌───────────────────────────────────────────────┐  │
│  │  10                                           │  │
│  └───────────────────────────────────────────────┘  │
│  Total number of sends the agent can make.          │
│  Counter decrements on each confirmed send.         │
│  When it hits 0, all sends are rejected.            │
│                                                     │
│  Max Amount per Transaction (ETH)                   │
│  ┌───────────────────────────────────────────────┐  │
│  │  0.01                                         │  │
│  └───────────────────────────────────────────────┘  │
│  Ceiling per individual send. The agent can send    │
│  0.001 ETH, but not 0.02 ETH. Checked in wei —     │
│  no floating point rounding.                        │
│                                                     │
│  Allowed Recipients (one address per line)          │
│  ┌───────────────────────────────────────────────┐  │
│  │  0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045  │  │
│  │  0x742d35Cc6634C0532925a3b844Bc454e4438f44e  │  │
│  └───────────────────────────────────────────────┘  │
│  The agent can ONLY send to these addresses.        │
│  Any other address is rejected before signing.      │
│  Must be valid 0x + 40 hex char Ethereum addresses. │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │              Create Wallet                    │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### What each field actually does

**Wallet Name**
Optional. Stored in the backend but not used in authentication or policy enforcement. Useful if you're creating multiple wallets and want to tell them apart.

**Expires In**
Converted to an absolute Unix timestamp in milliseconds at the moment you click Create. The backend compares `policy.expiresAt > Date.now()` on every send attempt. Once expired, the agent cannot send anything — even if it has remaining transactions. You'd need to create a new policy (via `POST /v1/wallets/:id/policy`) or a new wallet entirely.

Think of this as a session window. It limits the blast radius of a leaked API key in time.

**Max Transactions**
A hard counter stored in SQLite as `remainingTransactions`. Every confirmed send decrements it by one. The backend checks `remainingTransactions > 0` before signing. When it hits zero, the agent gets a `"No remaining transactions"` error. This is the total budget for the agent's lifetime on this policy.

Example: set to 10, agent sends 7 payments → 3 remaining. The 8th payment goes through fine, not the 11th.

**Max Amount per Transaction (ETH)**
A per-send ceiling. Stored as a string (not a float) and compared in wei to avoid floating point precision issues. `0.01 ETH` means the agent can send any amount up to and including `0.01 ETH` in a single call. Multiple calls are each checked independently — there is no rolling total check.

Example: `maxAmountPerTxEth: "0.01"`, agent calls `send_payment("0x...", "0.005")` → passes. Agent calls `send_payment("0x...", "0.02")` → rejected.

**Allowed Recipients**
A whitelist of Ethereum addresses stored in the `allowlist_entries` table. Addresses are normalized to lowercase on storage and compared lowercase on check. The agent cannot send to any address not on this list, regardless of amount or remaining transactions.

This is your most powerful restriction. If your agent is supposed to pay a single treasury address, put only that address here. Even a compromised agent or stolen API key cannot send ETH anywhere else.

---

## What happens after you click Create Wallet

All of this happens in a single backend call before the page redirects:

```
POST /v1/wallets
        │
        ├─ generate keypair
        │   viem.generatePrivateKey() → 32 random bytes
        │   privateKeyToAddress()     → 0x checksum address
        │
        ├─ encrypt private key
        │   SHA-256(ENCRYPTION_SECRET) → 32-byte AES key
        │   randomBytes(16)            → unique IV
        │   AES-256-GCM encrypt        → ciphertext + auth tag
        │   stored as "iv:tag:cipher"  → never the raw key
        │
        ├─ store wallet in SQLite
        │   wallets: { id, address, encryptedPrivateKey, createdAt }
        │
        ├─ create policy
        │   policies: { id, walletId, expiresAt, maxTransactions,
        │               remainingTransactions, maxAmountPerTxEth }
        │   allowlist_entries: one row per recipient address
        │
        ├─ generate API key
        │   randomBytes(32).toString('hex') → 64-char secret
        │   format: "walletId.secret"       → encodes wallet scope
        │   bcrypt.hash(key, 12)            → stored hash only
        │
        └─ return { walletId, address, apiKey }
                        │          │        │
                        │          │        └─ shown once in browser
                        │          │           stored in sessionStorage
                        │          │           never in DB as plaintext
                        │          │
                        │          └─ copy this → fund it with testnet ETH
                        │
                        └─ used to fetch policy + build setup page
```

The browser stores the raw `apiKey` in `sessionStorage` (not `localStorage`) so it survives the redirect to `/setup/:walletId` but disappears when you close the tab. That's intentional — it matches the "shown once" security model.

---

## The setup page — what you get

After creation you land on `/setup/:walletId` with five cards:

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠  Your API key is shown only once.                        │
│     Copy and save it now — it cannot be recovered.          │
└─────────────────────────────────────────────────────────────┘

┌── API Key ──────────────────────────────── [ Save Now ] ───┐
│  uuid.64hexchars                             [ Copy ]       │
│  This key will not be shown again.                          │
└─────────────────────────────────────────────────────────────┘

┌── Connect Claude Code ────────────────── [ Run this once ] ─┐
│  claude mcp add --transport http spongewallet                │
│    http://localhost:3001/mcp                                 │
│    --header "Authorization: Bearer uuid.64hexchars"          │
│                                        [ Copy Command ]      │
└─────────────────────────────────────────────────────────────┘

┌── skill.md File ────────────────────────────────────────────┐
│  http://localhost:3001/skills/openclaw.md?walletId=...       │
│  Install via OpenClaw:                                       │
│  /install http://localhost:3001/skills/...    [ Copy ]       │
└─────────────────────────────────────────────────────────────┘

┌── Fund Your Wallet ─────────────────── [ Base Sepolia only ]─┐
│  0x1234...abcd                              [ Copy ]         │
│  View on Basescan →                                          │
└─────────────────────────────────────────────────────────────┘

┌── Spending Policy ──────────────────────────────────────────┐
│  Expiry              Remaining Txns      Max per Tx ETH      │
│  Mar 15 2026 16:00   10                  0.01 ETH            │
│                                                              │
│  Allowed Recipients                                          │
│  [ 0xd8dA6B...96045 ]  [ 0x742d35...f44e ]                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

- Node.js 18+
- Base Sepolia testnet ETH: https://www.alchemy.com/faucets/base-sepolia

---

## Quick start

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:

```
ENCRYPTION_SECRET=your-random-string-minimum-32-chars-long
PORT=3001
BACKEND_URL=http://localhost:3001
```

`ENCRYPTION_SECRET` is SHA-256 hashed to produce the AES-256 key for private key encryption. Use at least 32 random characters. **If you change this after creating wallets, those wallets are permanently unrecoverable.**

```bash
npm run dev
# Backend running on http://localhost:3001
# SQLite database: backend/spongewallet.db (created on first run)
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

---

## Connecting to Claude Code

Copy the command from the setup page and run it once:

```bash
claude mcp add --transport http spongewallet http://localhost:3001/mcp \
  --header "Authorization: Bearer <your-api-key>"
```

Verify it registered:

```bash
claude --mcp-debug
# spongewallet ✓
```

Then use it in any Claude Code session:

```
Check my spongewallet balance
```
```
Send 0.001 ETH to 0xRECIPIENT using spongewallet
```
```
Show my last 5 spongewallet transactions
```

Claude will call `get_balance`, `send_payment`, or `get_transaction_history` through MCP. The backend validates the policy on every call and returns the result (or the specific limit that was hit) as structured text.

---

## Connecting to OpenClaw

Copy the `/install` command from the setup page:

```
/install http://localhost:3001/skills/openclaw.md?walletId=<id>&apiKey=<key>
```

This fetches the `skill.md` file, which is a self-contained reference containing:
- The MCP server URL and auth token
- The `claude mcp add` command
- All three tool signatures with example return values
- The REST API alternative
- Your live policy (address, expiry, remaining tx, max ETH, allowlist)
- Rules the agent must follow
- Error reference with every rejection code

---

## API reference

All authenticated endpoints use `Authorization: Bearer <apiKey>`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/v1/wallets` | — | Create wallet + policy + API key atomically |
| `GET` | `/v1/wallets/:id` | — | Get wallet address and active policy |
| `POST` | `/v1/wallets/:id/policy` | — | Update spending policy |
| `POST` | `/v1/wallets/:id/api-keys` | — | Generate a new API key |
| `GET` | `/v1/balance` | Bearer | ETH balance of the wallet |
| `POST` | `/v1/payments` | Bearer | Send ETH (policy enforced) |
| `GET` | `/v1/transactions` | Bearer | Transaction history |
| `GET` | `/skills/openclaw.md` | query params | skill.md for OpenClaw |
| `POST` | `/mcp` | Bearer | MCP StreamableHTTP endpoint |

### POST /v1/wallets

```json
{
  "name": "my agent",
  "expiresAt": 1750000000000,
  "maxTransactions": 10,
  "maxAmountPerTxEth": "0.01",
  "allowedRecipients": ["0x..."]
}
```

Response:

```json
{
  "walletId": "uuid",
  "address": "0x...",
  "apiKey": "uuid.hexsecret"
}
```

`apiKey` is returned once only — bcrypt-hashed before storage, cannot be recovered.

---

## Payment validation order

Every `send_payment` — via MCP or REST — runs these steps in sequence. First failure stops execution:

```
① Authenticate API key      bcrypt.compare(rawKey, storedHash)
② Load wallet + policy      SELECT from wallets + policies
③ Check expiry              policy.expiresAt > Date.now()
④ Check tx count            policy.remainingTransactions > 0
⑤ Check allowlist           to.toLowerCase() in allowlist_entries
⑥ Check amount              parseEther(amount) ≤ parseEther(maxPerTx)
⑦ Check balance             getBalance(address) ≥ amount + gas buffer
⑧ Sign + broadcast          viem.sendTransaction (privkey decrypted here)
⑨ Record transaction        INSERT into transactions table
⑩ Decrement counter         remainingTransactions -= 1
```

The private key is decrypted only at step ⑧, after all seven validations pass.

---

## Security properties

- **Private keys**: AES-256-GCM encrypted with a unique IV per key. Stored as `iv:authTag:ciphertext`. Decrypted in memory only during signing, never logged.
- **API keys**: `walletId.32-random-bytes-hex`. The walletId prefix scopes the bcrypt lookup without a full table scan. Hash stored only (cost 12). Raw key returned once on creation.
- **Policy enforcement**: Entirely server-side. The agent holds only an API token. No policy field can be bypassed from the client side.
- **Chain scope**: Base Sepolia (chainId: 84532) only. No mainnet code path exists anywhere in the codebase.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Express + TypeScript |
| Database | SQLite via better-sqlite3 |
| Chain | viem + Base Sepolia |
| MCP | @modelcontextprotocol/sdk (StreamableHTTP) |
| Frontend | Next.js 14 App Router + Tailwind + shadcn/ui |
