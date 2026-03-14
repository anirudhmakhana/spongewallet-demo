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
version: 2.0.0
description: Gasless USDC wallet on Base Sepolia. Uses Turnkey for signing and Gelato for sponsored relay submission.
homepage: ${config.backendUrl}
user-invocable: true
metadata: {"openclaw":{"emoji":"🧽","category":"finance","primaryEnv":"SPONGEWALLET_API_KEY","requires":{"env":["SPONGEWALLET_API_KEY"]}}}
---

SPONGEWALLET QUICK REFERENCE
Base: ${config.backendUrl}
Auth: Authorization: Bearer <SPONGEWALLET_API_KEY>
Asset: USDC only
Chain: Base Sepolia (84532)
Execution: Turnkey signs transferWithAuthorization, Gelato sponsors gas

## Claude Code Setup
claude mcp add --transport http spongewallet ${config.backendUrl}/mcp --header "Authorization: Bearer <SPONGEWALLET_API_KEY>"

## MCP Tools
get_balance → { address, chain, symbol, balanceUsdc }
send_payment(to, amountUsdc) → { txHash, explorerUrl, remainingTransactions }
get_transaction_history(limit?) → { items: [{txHash, toAddress, amountUsdc, sentAt, explorerUrl}] }

## REST API (alternative to MCP)
GET  /v1/balance          Authorization: Bearer <SPONGEWALLET_API_KEY>
POST /v1/payments         { "to": "0x...", "amountUsdc": "5.25" }
GET  /v1/transactions     ?limit=10

## Wallet Policy
- Wallet: ${wallet.address}
- Expires: ${new Date(policy.expiresAt).toISOString()}
- Remaining transactions: ${policy.remainingTransactions}
- Max per transaction: ${policy.maxAmountPerTxUsdc} USDC
- Allowed recipients: ${policy.allowedRecipients.join(', ')}

## Rules
1. Always call get_balance before sending
2. Only send USDC to allowed recipients
3. Never exceed the USDC limit
4. The wallet does not need ETH; Gelato sponsors gas
5. Report txHash + explorerUrl after each successful send
`

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.send(skillContent)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate skill file'
    res.status(500).json({ error: message })
  }
})

export default router
