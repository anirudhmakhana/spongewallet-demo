import { Router, Request, Response } from 'express'
import { createPublicClient, http, formatEther } from 'viem'
import { baseSepolia } from 'viem/chains'
import bcrypt from 'bcryptjs'
import { db } from '../db/schema'
import { getWallet, decryptPrivateKey } from '../services/walletService'
import {
  validatePaymentRequest,
  decrementRemainingTransactions,
  recordTransaction,
  getTransactionHistory,
} from '../services/policyService'
import { sendPayment } from '../services/paymentService'

const router = Router()

const publicClient = createPublicClient({ chain: baseSepolia, transport: http() })

interface ApiKeyRow {
  id: string
  walletId: string
  keyHash: string
  createdAt: number
}

async function extractWalletIdFromBearer(
  authHeader: string | undefined
): Promise<{ walletId: string; apiKey: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const apiKey = authHeader.slice(7)

  // API key format: "{walletId}.{secret}" — extract walletId to avoid full table scan
  const dotIndex = apiKey.indexOf('.')
  if (dotIndex === -1) return null
  const walletId = apiKey.slice(0, dotIndex)

  const stmt = db.prepare('SELECT * FROM api_keys WHERE walletId = ?')
  const rows = stmt.all(walletId) as ApiKeyRow[]

  for (const row of rows) {
    const matches = await bcrypt.compare(apiKey, row.keyHash)
    if (matches) {
      return { walletId: row.walletId, apiKey }
    }
  }

  return null
}

// GET /v1/balance
router.get('/balance', async (req: Request, res: Response): Promise<void> => {
  try {
    const authResult = await extractWalletIdFromBearer(req.headers.authorization)
    if (!authResult) {
      res.status(401).json({ error: 'Unauthorized: Invalid or missing Bearer token' })
      return
    }

    const { walletId } = authResult
    const wallet = getWallet(walletId)
    if (!wallet) {
      res.status(404).json({ error: 'Wallet not found' })
      return
    }

    const balance = await publicClient.getBalance({ address: wallet.address as `0x${string}` })
    const balanceEth = formatEther(balance)

    res.json({
      address: wallet.address,
      balanceEth,
      chain: 'base-sepolia',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get balance'
    res.status(500).json({ error: message })
  }
})

// POST /v1/payments
router.post('/payments', async (req: Request, res: Response): Promise<void> => {
  try {
    const authResult = await extractWalletIdFromBearer(req.headers.authorization)
    if (!authResult) {
      res.status(401).json({ error: 'Unauthorized: Invalid or missing Bearer token' })
      return
    }

    const { walletId, apiKey } = authResult
    const { to, amountEth } = req.body

    if (!to || typeof to !== 'string') {
      res.status(400).json({ error: 'Missing required field: to' })
      return
    }

    if (!amountEth || typeof amountEth !== 'string') {
      res.status(400).json({ error: 'Missing required field: amountEth' })
      return
    }

    if (!/^0x[0-9a-fA-F]{40}$/.test(to)) {
      res.status(400).json({ error: 'Invalid recipient address format' })
      return
    }

    if (!/^\d+(\.\d+)?$/.test(amountEth)) {
      res.status(400).json({ error: 'Invalid amount format' })
      return
    }

    const validation = await validatePaymentRequest(apiKey, walletId, to, amountEth)

    if (!validation.valid) {
      res.status(400).json({ error: validation.error })
      return
    }

    const { wallet, policy } = validation

    const decryptedKey = decryptPrivateKey(wallet.encryptedPrivateKey)
    const { txHash, explorerUrl } = await sendPayment(decryptedKey, to, amountEth)

    recordTransaction(walletId, txHash, to, amountEth)
    const remainingTransactions = decrementRemainingTransactions(policy.id)

    res.json({ txHash, explorerUrl, remainingTransactions })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send payment'
    res.status(500).json({ error: message })
  }
})

// GET /v1/transactions
router.get('/transactions', async (req: Request, res: Response): Promise<void> => {
  try {
    const authResult = await extractWalletIdFromBearer(req.headers.authorization)
    if (!authResult) {
      res.status(401).json({ error: 'Unauthorized: Invalid or missing Bearer token' })
      return
    }

    const { walletId } = authResult
    const rawLimit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) {
      res.status(400).json({ error: 'limit must be an integer between 1 and 100' })
      return
    }
    const limit = rawLimit

    const items = getTransactionHistory(walletId, limit)
    res.json({ items })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get transactions'
    res.status(500).json({ error: message })
  }
})

export default router
