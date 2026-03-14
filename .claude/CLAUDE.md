# spongewallet — root context

## what this is

A managed AI wallet on Base Sepolia for sponsored USDC transfers.

The current architecture is:

- Turnkey for owner key custody and signing
- ERC-4337 `SimpleAccount` smart accounts
- Pimlico bundler + paymaster for sponsored user operations
- Express backend as policy/control plane
- Next.js frontend for onboarding, restore, and setup

## monorepo layout

- `/backend` — Express + TypeScript + SQLite + MCP server
- `/frontend` — Next.js + TypeScript + Tailwind + shadcn/ui
- `/docs` — architecture and operations docs

## absolute rules

- `viem` ONLY for chain interactions. `ethers` is banned.
- Base Sepolia ONLY (`chainId: 84532`).
- USDC ONLY in this branch.
- the smart account address is the user-facing wallet address.
- the Turnkey owner EOA is not the address users fund.
- Pimlico is the gas sponsor and bundler path.
- API keys are bcrypt-hashed and raw keys are returned once only.
- frontend NEVER touches chain providers directly.
- policy enforcement lives in the backend before user operation submission.

## important mental model

This is an AA-powered wallet product, but still a managed system.

The backend:

- authenticates API keys
- loads the wallet and active policy
- validates spending rules
- derives the smart account
- submits sponsored user operations

Turnkey protects keys, but the backend remains the control plane.
