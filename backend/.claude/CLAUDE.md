# backend context

## stack
- express + better-sqlite3 + @modelcontextprotocol/sdk + viem
- @turnkey/sdk-server + @turnkey/viem
- @gelatocloud/gasless

## database
- wallets: address + turnkeyWalletId + turnkeyAccountId
- api_keys: bcrypt hashes only
- policies: expiry + tx count + maxAmountPerTxUsdc
- allowlist_entries
- authorizations
- transactions

## payment flow
1. authenticate bearer api key
2. load wallet + active policy
3. validate expiry / tx count / allowlist / maxAmountPerTxUsdc
4. read USDC balance
5. build transferWithAuthorization typed data
6. sign with Turnkey
7. submit through Gelato sponsored relay
8. record confirmed tx and decrement counter

## tools
- get_balance
- send_payment(to, amountUsdc)
- get_transaction_history(limit?)
