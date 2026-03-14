import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../db/schema'
import { getWallet } from '../services/walletService'
import { getActivePolicy } from '../services/policyService'
import { config } from '../config'

const router = Router()

interface ApiKeyRow {
  id: string
  walletId: string
  keyHash: string
  createdAt: number
}

// GET /skills/openclaw.md?walletId=x&apiKey=x
router.get('/skills/openclaw.md', async (req: Request, res: Response): Promise<void> => {
  try {
    const { walletId, apiKey } = req.query

    if (!walletId || typeof walletId !== 'string') {
      res.status(400).json({ error: 'Missing required query parameter: walletId' })
      return
    }

    if (!apiKey || typeof apiKey !== 'string') {
      res.status(400).json({ error: 'Missing required query parameter: apiKey' })
      return
    }

    // Validate wallet exists
    const wallet = getWallet(walletId)
    if (!wallet) {
      res.status(404).json({ error: 'Wallet not found' })
      return
    }

    // Validate apiKey against walletId's api_keys
    const stmt = db.prepare('SELECT * FROM api_keys WHERE walletId = ?')
    const rows = stmt.all(walletId) as ApiKeyRow[]

    let authenticated = false
    for (const row of rows) {
      const matches = await bcrypt.compare(apiKey, row.keyHash)
      if (matches) {
        authenticated = true
        break
      }
    }

    if (!authenticated) {
      res.status(401).json({ error: 'Unauthorized: Invalid API key' })
      return
    }

    // Load policy
    const policy = getActivePolicy(walletId)
    if (!policy) {
      res.status(404).json({ error: 'No active policy found for this wallet' })
      return
    }

    const expiresAtIso = new Date(policy.expiresAt).toISOString()
    const allowedRecipientsStr =
      policy.allowedRecipients.length > 0
        ? policy.allowedRecipients.join(', ')
        : '(none)'

    const skillContent = `---
name: spongewallet
version: 1.0.0
description: Managed ETH wallet on Base Sepolia with enforced spending limits. Send ETH autonomously within policy.
homepage: ${config.backendUrl}
user-invocable: true
metadata: {"openclaw":{"emoji":"🧽","category":"finance","primaryEnv":"SPONGEWALLET_API_KEY"}}
---

SPONGEWALLET QUICK REFERENCE
Base: ${config.backendUrl}
Auth: Authorization: Bearer ${apiKey}

## Claude Code Setup
claude mcp add --transport http spongewallet ${config.backendUrl}/mcp --header "Authorization: Bearer ${apiKey}"

## MCP Tools
get_balance → { address, chain, symbol, balanceEth }
send_payment(to, amountEth) → { txHash, explorerUrl, remainingTransactions }
get_transaction_history(limit?) → { items: [{txHash, toAddress, amountEth, sentAt, explorerUrl}] }

## REST API (alternative to MCP)
GET  /v1/balance          Authorization: Bearer ${apiKey}
POST /v1/payments         { "to": "0x...", "amountEth": "0.01" }
GET  /v1/transactions     ?limit=10

## Your Policy
- Wallet: ${wallet.address}
- Chain: Base Sepolia (chainId: 84532)
- Expires: ${expiresAtIso}
- Remaining transactions: ${policy.remainingTransactions}
- Max per transaction: ${policy.maxAmountPerTxEth} ETH
- Allowed recipients: ${allowedRecipientsStr}

## Rules
1. Always call get_balance before sending — verify sufficient funds
2. Only send to addresses in Allowed recipients
3. Never exceed Max per transaction
4. Report txHash + explorerUrl after every successful send
5. If rejected, report which limit was hit

## Error Reference
401 → Invalid API key
400/Policy expired → policy time limit exceeded
400/No remaining transactions → tx count exhausted
400/Recipient not in allowlist → address not permitted
400/Amount exceeds limit → reduce amountEth
400/Insufficient balance → wallet needs funding
`

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.send(skillContent)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate skill file'
    res.status(500).json({ error: message })
  }
})

export default router
