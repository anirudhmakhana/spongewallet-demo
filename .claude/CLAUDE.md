# spongewallet — root context

## what this is
A gasless USDC agent wallet MVP on Base Sepolia. Turnkey manages wallet keys and signing. Gelato sponsors gas for relay submission.

## monorepo layout
- /backend — Express + TypeScript + SQLite + HTTP MCP server
- /frontend — Next.js + TypeScript + Tailwind + shadcn/ui

## absolute rules
- viem ONLY for all chain interactions. ethers is banned.
- Base Sepolia ONLY (chainId: 84532).
- USDC ONLY for transfers in this version.
- Turnkey is the signer and wallet manager.
- Gelato Turbo Relayer is the gas sponsor and relay submitter.
- API keys are bcrypt-hashed. Raw keys are returned once only.
- Frontend NEVER touches chain directly.
