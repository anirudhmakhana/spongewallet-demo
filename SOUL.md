# SOUL.md

This file captures the architectural intent of the repo and the rules that should remain true unless the product is intentionally re-scoped.

## What this repo is

SpongeWallet is a managed, policy-constrained AI wallet on Base Sepolia.

In the current branch it is:

- a sponsored USDC wallet
- powered by ERC-4337 smart accounts
- backed by Turnkey-managed owner keys
- executed through Pimlico bundler and paymaster infrastructure
- exposed to agents through REST and MCP

## What this repo is not

It is not:

- a raw private-key wallet
- an ETH wallet
- a multi-chain wallet
- a generic crypto super-app
- a user-browser signer product
- a self-custodial frontend wallet

## Core product principles

### 1. The smart account is the user-facing wallet

The address shown in the UI and given to the user for funding is the smart account address, not the Turnkey owner EOA.

Any feature that confuses these two addresses is wrong.

### 2. Policy enforcement lives in the backend

The spending policy is enforced by the application backend before a user operation is submitted.

Current policy dimensions:

- expiry
- max transactions
- remaining transactions
- max amount per transaction
- allowed recipients

If a request violates policy, it should fail before any on-chain submission attempt.

### 3. Turnkey protects signing, but the backend remains the control plane

Turnkey reduces key exposure and owns the sensitive owner signing primitive.
That does not make the product trustless.

The backend still:

- maps API keys to wallets
- loads policies
- decides whether to execute
- constructs the smart-account call
- sends the user operation

### 4. Pimlico sponsorship is part of the product promise

The product promise is that the smart account does not need ETH for supported USDC sends.

If a change requires ETH in the smart account, that is a product model change and should be treated explicitly, not introduced accidentally.

### 5. USDC-only scope is intentional

The app currently supports only Base Sepolia USDC because that keeps:

- policy semantics simple
- funding instructions clear
- agent behavior constrained
- testing predictable

ETH support, other ERC-20s, or mainnet support should be treated as separate scope changes.

## Current trust model

There are three meaningful trust boundaries:

### Turnkey

Responsible for owner key custody and signing.

### Backend

Responsible for:

- authentication
- wallet and policy lookup
- policy validation
- smart-account orchestration
- transaction recording

### Pimlico

Responsible for:

- bundling user operations
- sponsoring gas through the configured paymaster

## Data model invariants

The `wallets` table must always contain:

- `ownerAddress`
- `smartAccountAddress`
- `turnkeyWalletId`
- `turnkeyAccountId`

The `transactions` table is the history of attempted sponsored sends and must retain:

- `userOpHash`
- `txHash`
- `status`
- destination
- amount
- timestamp

The wallet should never be modeled as if it directly stores a usable private key in SQLite.

## Agent-surface invariants

The following tool names are part of the agent contract and should remain stable unless there is a deliberate breaking-change migration:

- `get_balance`
- `send_payment`
- `get_transaction_history`

The OpenClaw skill and the Claude Code MCP instructions should describe the same behavior as the backend actually provides.

## Design direction

If future work adds ETH support, extra assets, or broader AA controls, keep these principles:

- do not blur owner and smart-account addresses
- do not bypass policy enforcement
- do not add hidden gas assumptions
- do not reintroduce `ethers`
- do not widen scope without updating the skill, setup UI, and docs together

## Reality check

This repository started as a different architecture and has already changed substantially.
The current `soul` of the project is:

`managed AI wallet + policy engine + Turnkey owner + sponsored smart-account execution`

Any future change should be evaluated against that sentence first.
