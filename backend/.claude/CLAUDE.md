# backend context

## location
/Users/anirudhmakhana/Documents/krsnalabs/spongewallet-demo/backend

## stack
- express + better-sqlite3 + @modelcontextprotocol/sdk + viem + bcryptjs + uuid + dotenv + cors
- typescript, tsx (dev), vitest (tests)

## db tables
wallets: id (uuid), address, encryptedPrivateKey, createdAt
api_keys: id (uuid), walletId, keyHash, createdAt
policies: id (uuid), walletId, expiresAt, maxTransactions, remainingTransactions, maxAmountPerTxEth
allowlist_entries: id (uuid), policyId, address
transactions: id (uuid), walletId, txHash, toAddress, amountEth, sentAt

## payment validation order — never change this sequence
1. authenticate api key (bcrypt compare against keyHash)
2. load wallet + active policy
3. check expiresAt > Date.now()
4. check remainingTransactions > 0
5. check toAddress in allowlist_entries for this policy
6. check amountEth <= maxAmountPerTxEth
7. check wallet ETH balance >= amountEth + estimated gas
8. decrypt private key, sign and send via viem walletClient
9. persist transaction record
10. decrement remainingTransactions

## never sign if any validation step fails
return descriptive error for each failure case

## REST endpoints
POST   /v1/wallets                        → { walletId, address }
GET    /v1/wallets/:id                    → { walletId, address, policy? }
POST   /v1/wallets/:id/policy             → { policyId }
POST   /v1/wallets/:id/api-keys           → { apiKey } (raw, shown once)
GET    /v1/balance                        → { address, balanceEth } (Bearer auth)
POST   /v1/payments                       → { txHash, explorerUrl, remainingTransactions } (Bearer auth)
GET    /v1/transactions                   → { items: [...] } (Bearer auth)
GET    /skills/openclaw.md                → markdown skill file (query: walletId, apiKey)
POST   /mcp                              → MCP StreamableHTTP endpoint (Bearer auth)

## MCP tools
- get_balance: returns address, chain, symbol, balanceEth
- send_payment(to, amountEth): validates policy, signs, returns txHash + explorerUrl
- get_transaction_history(limit?): returns array of past transactions

## security rules
- bcrypt cost factor >= 10 for api keys
- AES-256-GCM for private key encryption, unique IV per encryption
- parameterized queries everywhere (better-sqlite3 prepared statements)
- validate ethereum addresses: must match /^0x[0-9a-fA-F]{40}$/
- never log raw private keys or raw api keys
- authenticate on EVERY MCP tool call
