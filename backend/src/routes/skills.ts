import { Router, Request, Response } from 'express'
import { config } from '../config'
import { getActivePolicy } from '../services/policyService'
import { getWallet } from '../services/walletService'

const router = Router()

router.get('/skills/openclaw.md', (req: Request, res: Response): void => {
  try {
    const walletId = req.query.walletId

    if (!walletId || typeof walletId !== 'string') {
      res.status(400).json({ error: 'Missing required query parameter: walletId' })
      return
    }

    const wallet = getWallet(walletId)
    if (!wallet) {
      res.status(404).json({ error: 'Wallet not found' })
      return
    }

    const policy = getActivePolicy(walletId)
    if (!policy) {
      res.status(404).json({ error: 'No active policy found for this wallet' })
      return
    }

    const skillContent = `---
name: spongewallet
version: 3.0.0
description: Sponsored smart-account USDC wallet for AI agents on Base Sepolia with strict spending-policy enforcement.
homepage: ${config.backendUrl}
user-invocable: true
metadata: {"openclaw":{"emoji":"🧽","category":"finance","primaryEnv":"SPONGEWALLET_API_KEY","requires":{"env":["SPONGEWALLET_API_KEY"]}}}
---

\`\`\`
SPONGEWALLET AGENT GUIDE
Base:   ${config.backendUrl}
Auth:   Authorization: Bearer <SPONGEWALLET_API_KEY>
Asset:  USDC only
Chain:  Base Sepolia (84532)
Wallet: ${wallet.smartAccountAddress}

Execution model:
- Turnkey controls the smart-account owner signer
- A Base Sepolia SimpleAccount executes transfers through ERC-4337
- Pimlico sponsors user operations, so the wallet does not need ETH
- Policy checks happen before any user operation is submitted

Primary interface:
- MCP first
- REST as fallback
\`\`\`

# SpongeWallet Skill

This skill is **doc-only**. There is no local CLI. The agent should use the SpongeWallet MCP server when available, and use the REST API only as a fallback.

## What this wallet can do

1. Check the wallet's current USDC balance on Base Sepolia
2. Send sponsored USDC from its smart account to approved recipient addresses
3. View recent transaction history

## Claude Code Setup

\`\`\`bash
claude mcp add --transport http spongewallet ${config.backendUrl}/mcp --header "Authorization: Bearer <SPONGEWALLET_API_KEY>"
\`\`\`

## MCP Tools

- \`get_balance\` -> returns \`{ address, chain, symbol, balanceUsdc }\`
- \`send_payment(to, amountUsdc)\` -> returns \`{ txHash, explorerUrl, remainingTransactions }\`
- \`get_transaction_history(limit?)\` -> returns recent transfer records with \`userOpHash\`, \`txHash\`, and \`status\`

## REST API Fallback

Use REST only if MCP is unavailable.

- \`GET ${config.backendUrl}/v1/balance\`
- \`POST ${config.backendUrl}/v1/payments\` with \`{ "to": "0x...", "amountUsdc": "0.01" }\`
- \`GET ${config.backendUrl}/v1/transactions?limit=10\`

## Wallet Policy Snapshot

- Smart account address: \`${wallet.smartAccountAddress}\`
- Owner signer address: \`${wallet.ownerAddress}\`
- Expires at: \`${new Date(policy.expiresAt).toISOString()}\`
- Remaining transactions: \`${policy.remainingTransactions}\`
- Max per transaction: \`${policy.maxAmountPerTxUsdc} USDC\`
- Allowed recipients:
${policy.allowedRecipients.map((address) => `  - \`${address}\``).join('\n')}

## Required Agent Behavior

1. Always check the balance before attempting a transfer
2. Only send to addresses listed in the allowed-recipient policy
3. Never exceed the per-transaction USDC limit
4. Treat policy rejection as final unless the human updates the policy
5. After a successful send, report:
   - amount sent
   - recipient
   - userOpHash if available
   - txHash
   - explorerUrl
   - remaining transaction count

## Recommended Send Workflow

1. Call \`get_balance\`
2. Confirm the requested recipient is in the allowed list
3. Confirm the requested amount is within policy
4. Call \`send_payment\`
5. Report the result clearly

## Error Guide

- \`401 Unauthorized\` -> API key is missing, invalid, or expired
- \`400 Policy has expired\` -> wallet can no longer transact under the current policy
- \`400 No remaining transactions in policy\` -> transaction count has been exhausted
- \`400 Recipient ... is not in the allowlist\` -> recipient is not approved
- \`400 Amount ... exceeds maximum per transaction limit\` -> amount is above policy
- \`400 Insufficient USDC balance\` -> fund the smart account with more Base Sepolia USDC
- \`5xx\` from Pimlico/bundler/paymaster -> sponsorship or user operation execution failed upstream

## Notes

- Fund the smart account address with Base Sepolia USDC only
- This wallet does not need ETH for gas; Pimlico sponsors user operations
- This skill should never invent unsupported capabilities such as swaps, bridges, or non-USDC transfers
- If the owner already has an API key, they can restore the wallet from the SpongeWallet home page using that saved key
`

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.send(skillContent)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate skill file'
    res.status(500).json({ error: message })
  }
})

export default router
