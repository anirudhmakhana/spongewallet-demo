# backend context

## stack

- express
- better-sqlite3
- `@modelcontextprotocol/sdk`
- `viem`
- `permissionless`
- `@turnkey/sdk-server`
- `@turnkey/viem`

## wallet model

- Turnkey provisions the owner wallet/account
- the backend derives a Base Sepolia `SimpleAccount`
- the smart account address is the funded wallet
- the owner address is stored for signing and smart-account control

## database

- `wallets`
  - `ownerAddress`
  - `smartAccountAddress`
  - `turnkeyWalletId`
  - `turnkeyAccountId`
- `api_keys`
  - bcrypt hashes only
- `policies`
  - expiry
  - max tx count
  - remaining tx count
  - `maxAmountPerTxUsdc`
- `allowlist_entries`
- `transactions`
  - `userOpHash`
  - `txHash`
  - `status`
  - recipient
  - amount

## payment flow

1. authenticate bearer API key
2. load wallet + active policy
3. validate expiry / tx count / allowlist / amount limit
4. read USDC balance from the smart account
5. encode ERC-20 `transfer(address,uint256)`
6. create Turnkey-backed owner signer
7. derive the `SimpleAccount`
8. build sponsored smart-account client with Pimlico
9. submit user operation
10. persist `userOpHash`
11. wait for receipt
12. persist `txHash`, mark confirmed, decrement counter

## tools

- `get_balance`
- `send_payment(to, amountUsdc)`
- `get_transaction_history(limit?)`

## backend invariants

- never treat the owner EOA as the funded wallet
- never bypass policy validation before send
- never decrement remaining tx count before confirmation
- never store plaintext API keys or raw private keys
