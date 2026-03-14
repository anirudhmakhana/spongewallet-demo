# SOUL.md — the why behind spongewallet

This document is not a README. It's the thinking behind the decisions — the constraints that shaped the architecture, the trade-offs we chose, and the things we decided not to build. Read this before touching anything structural.

---

## The core insight

Most agent wallet setups pick one of two bad options:

**Option A: Give the agent the private key.**
Flexible, but you've handed an LLM complete, unconstrained control over an onchain asset. One prompt injection, one hallucination, one compromised system prompt — and funds are gone.

**Option B: Use a smart contract wallet.**
Safe, but complex. You're now deploying contracts, paying mainnet gas for policy enforcement, and debugging Solidity for what is fundamentally a simple authorization problem.

SpongeWallet takes a third path: **custodial with server-enforced policy**. The private key stays on the server. The agent gets an API token. Every send attempt runs through a policy check before the key is ever touched. Simple, auditable, and requires zero onchain infrastructure beyond testnet ETH.

The tradeoff: you're trusting the server. That's fine — you're already running it.

---

## Why custodial is the right call for agent demos

When you're building an agent demo, the threat model is:
- The agent hallucinates a send to the wrong address
- The agent gets prompt-injected and tries to drain the wallet
- The dev accidentally sets a policy too permissive and sends real money somewhere

None of these require a sophisticated attacker. They're just normal things that go wrong during development. A spending policy that lives server-side (not in the agent's context window) handles all three cheaply.

If you want to demo trustless custody — use a smart contract. SpongeWallet is not that. It's the right tool for "let me give this agent $5 of testnet ETH and see what it does."

---

## Why Base Sepolia, and why only Base Sepolia

**Base Sepolia is the only chain.** This is not a configurable option — it's enforced at every level (backend config, frontend display, CLAUDE.md rules).

The reasons:
1. ETH is free (testnet faucet). Demos don't cost money.
2. Base is the chain most AI-native projects are building on. It's EVM-compatible, fast, and has good tooling.
3. Restricting to one chain makes the security model simpler. No `chainId` mismatch bugs, no "mainnet mode" codepath that someone accidentally enables.

If you need another chain, fork the repo. Don't add a `chain` parameter to this one.

---

## Why viem and not ethers

viem is typed, modern, and tree-shakeable. ethers v5 has footguns around BigNumber and provider abstraction that have caused real bugs in production wallet code. ethers v6 fixed most of this but viem is now the community standard for new projects.

**ethers is banned in this codebase.** Not because it's wrong — it works fine — but because mixing two chain libraries in the same codebase is a maintenance hazard. If you're adding a dependency that pulls in ethers transitively, audit it.

---

## Why SQLite and not Postgres

Because this is a self-hosted demo server and SQLite is a file. No connection pool, no migrations tool, no separate process. You run `npm run dev` and it works.

The encrypted private key store is sensitive data, but SQLite is not inherently less secure than Postgres — both require disk access to read. The threat model here is someone with access to the running process, not a database breach. The AES-256-GCM encryption on private keys means a raw SQLite dump is useless without the `ENCRYPTION_SECRET`.

If you're moving this to production: keep SQLite for small deployments, switch to Postgres if you need multiple instances.

---

## The payment validation order is a contract, not a suggestion

Steps ① through ⑩ in the payment flow are ordered by cheapness, not by importance. We check expiry before allowlist because a timestamp comparison is microseconds; bcrypt is 100ms+. The order:

```
① auth (bcrypt) — only expensive check, done first to reject garbage fast
② load wallet + policy
③ expiry
④ tx count
⑤ allowlist
⑥ amount ceiling
⑦ balance (live RPC call)
⑧ sign + broadcast (decrypt key here, not before)
⑨ record
⑩ decrement counter
```

The private key is decrypted **only at step ⑧**, after every validation passes. This means a failed policy check never touches the key. This sequence must not be reordered. If you think you have a reason to reorder it, you're probably wrong.

---

## Why the API key format is `walletId.secret`

A 64-char hex secret is opaque — to verify it against a bcrypt hash, you'd need to scan every hash in the `api_keys` table. That's O(n) bcrypt operations.

Prefixing the walletId gives the server a free lookup scope: parse the walletId from the token, load only that wallet's keys, do one bcrypt compare. It also means a token from one wallet cannot be used to authenticate against another wallet's key hash — the walletId in the token and the walletId in the key record must match.

The walletId is not a secret. The 64-char hex part is.

---

## What this is not

- **Not a production custody service.** No HSM, no key sharding, no MFA. The ENCRYPTION_SECRET is a config var, not an HSM-backed secret.
- **Not a multi-agent system.** One wallet, one policy, one API key per session. No RBAC.
- **Not a smart contract wallet.** Policy lives in SQLite, not onchain. The server is the trust anchor.
- **Not chain-agnostic.** Base Sepolia only.
- **Not a replacement for Privy/Dynamic/etc.** Those handle real user custody. This handles agent wallets for demos.

---

## The frontend's job is display, not logic

The frontend never calls `viem`. It never constructs a transaction. It never holds the private key. It never holds the API key beyond the current browser session (sessionStorage, not localStorage — cleared on tab close).

Every bit of chain interaction goes through the backend REST API. This is non-negotiable because:
1. The private key must never leave the server
2. Policy enforcement must be server-side or it's not enforcement
3. If the frontend did chain stuff, a compromised page could bypass the policy entirely

The frontend is a form + a display page. Keep it that way.

---

## Skills and MCP

The `/mcp` endpoint speaks the MCP protocol (StreamableHTTP). Claude Code connects to it with a single `claude mcp add` command. Every tool call — `get_balance`, `send_payment`, `get_transaction_history` — authenticates the Bearer token on every request. There is no session state. Each call is independently authorized.

The `skills/openclaw.md` endpoint generates a self-describing skill file for OpenClaw agents. It embeds the live policy state so the agent knows its own constraints without calling `get_balance` first. This is a convenience — the backend still enforces the policy regardless of what the skill file says.

---

## If you're extending this

Before adding a feature, ask:
- Does this widen the blast radius (more funds at risk, more chains, more trust surface)?
- Does this add a mainnet codepath?
- Does this let the agent or the frontend bypass a policy check?

If the answer to any of these is yes, think harder. The constraint is the feature.
