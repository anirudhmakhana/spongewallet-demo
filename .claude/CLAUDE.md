# spongewallet — root context

## what this is
A custodial agent wallet MVP on Base Sepolia. Gives AI agents a managed ETH wallet with spending limits enforced server-side.

## monorepo layout
- /backend — Express + TypeScript + SQLite + HTTP MCP server
- /frontend — Next.js 14 + TypeScript + Tailwind + shadcn/ui

## absolute rules — all teammates must follow
- viem ONLY for all chain interactions. ethers is BANNED.
- Base Sepolia ONLY (chainId: 84532). No other chains, no mainnet paths.
- TypeScript everywhere in both apps.
- Private keys MUST be AES-256-GCM encrypted before storing in SQLite using ENCRYPTION_SECRET env var. Never store or log raw private keys.
- API keys stored as bcrypt hash. Returned raw ONCE on creation only.
- Frontend NEVER touches chain directly. All chain interactions go through backend REST APIs.

## stack
- backend: express + better-sqlite3 + @modelcontextprotocol/sdk + viem + bcryptjs
- frontend: next.js 14 + tailwind + shadcn/ui
- chain: base sepolia (chainId: 84532)

## env vars
ENCRYPTION_SECRET=minimum-32-char-random-string
PORT=3001
BACKEND_URL=http://localhost:3001
