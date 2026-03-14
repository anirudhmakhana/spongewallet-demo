import { Router, Request, Response } from 'express'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import {
  generateWallet,
  encryptPrivateKey,
  storeWallet,
  getWallet,
} from '../services/walletService'
import { createPolicy, getActivePolicy } from '../services/policyService'
import { db } from '../db/schema'

const router = Router()

// POST /v1/wallets
router.post('/wallets', async (req: Request, res: Response): Promise<void> => {
  try {
    const { privateKey, address } = generateWallet()
    const encryptedKey = encryptPrivateKey(privateKey)
    const walletId = storeWallet(address, encryptedKey)

    const { name, expiresAt, maxTransactions, maxAmountPerTxEth, allowedRecipients } = req.body
    const hasPolicyFields =
      expiresAt !== undefined ||
      maxTransactions !== undefined ||
      maxAmountPerTxEth !== undefined ||
      allowedRecipients !== undefined

    if (!hasPolicyFields) {
      res.status(201).json({ walletId, address })
      return
    }

    // Validate all policy fields are present
    if (expiresAt === undefined || maxTransactions === undefined || maxAmountPerTxEth === undefined || allowedRecipients === undefined) {
      res.status(400).json({ error: 'If any policy field is provided, all are required: expiresAt, maxTransactions, maxAmountPerTxEth, allowedRecipients' })
      return
    }

    // Validate expiresAt
    if (typeof expiresAt !== 'number' || expiresAt <= Date.now()) {
      res.status(400).json({ error: 'expiresAt must be a future unix timestamp in milliseconds' })
      return
    }

    // Validate maxTransactions
    if (typeof maxTransactions !== 'number' || maxTransactions <= 0 || !Number.isInteger(maxTransactions)) {
      res.status(400).json({ error: 'maxTransactions must be a positive integer' })
      return
    }

    // Validate maxAmountPerTxEth
    if (typeof maxAmountPerTxEth !== 'string' || !/^\d+(\.\d+)?$/.test(maxAmountPerTxEth)) {
      res.status(400).json({ error: 'maxAmountPerTxEth must be a valid decimal string (e.g. "0.01")' })
      return
    }

    // Validate allowedRecipients
    if (!Array.isArray(allowedRecipients) || allowedRecipients.length === 0) {
      res.status(400).json({ error: 'allowedRecipients must be a non-empty array of Ethereum addresses' })
      return
    }

    const addressRegex = /^0x[0-9a-fA-F]{40}$/
    for (const addr of allowedRecipients) {
      if (typeof addr !== 'string' || !addressRegex.test(addr)) {
        res.status(400).json({ error: `Invalid Ethereum address: ${addr}` })
        return
      }
    }

    createPolicy(walletId, expiresAt, maxTransactions, maxAmountPerTxEth, allowedRecipients)

    // Generate API key
    const rawKey = `${walletId}.${randomBytes(32).toString('hex')}`
    const keyHash = await bcrypt.hash(rawKey, 12)
    const apiKeyId = uuidv4()
    const createdAt = Date.now()
    const stmt = db.prepare(
      'INSERT INTO api_keys (id, walletId, keyHash, createdAt) VALUES (?, ?, ?, ?)'
    )
    stmt.run(apiKeyId, walletId, keyHash, createdAt)

    res.status(201).json({ walletId, address, apiKey: rawKey })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create wallet'
    res.status(500).json({ error: message })
  }
})

// GET /v1/wallets/:id
router.get('/wallets/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const wallet = getWallet(id)

    if (!wallet) {
      res.status(404).json({ error: 'Wallet not found' })
      return
    }

    const policy = getActivePolicy(id)

    const response: {
      walletId: string
      address: string
      policy?: {
        id: string
        expiresAt: number
        maxTransactions: number
        remainingTransactions: number
        maxAmountPerTxEth: string
        allowedRecipients: string[]
      }
    } = {
      walletId: wallet.id,
      address: wallet.address,
    }

    if (policy) {
      response.policy = {
        id: policy.id,
        expiresAt: policy.expiresAt,
        maxTransactions: policy.maxTransactions,
        remainingTransactions: policy.remainingTransactions,
        maxAmountPerTxEth: policy.maxAmountPerTxEth,
        allowedRecipients: policy.allowedRecipients,
      }
    }

    res.json(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get wallet'
    res.status(500).json({ error: message })
  }
})

// POST /v1/wallets/:id/policy
router.post('/wallets/:id/policy', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { expiresAt, maxTransactions, maxAmountPerTxEth, allowedRecipients } = req.body

    // Validate wallet exists
    const wallet = getWallet(id)
    if (!wallet) {
      res.status(404).json({ error: 'Wallet not found' })
      return
    }

    // Validate expiresAt
    if (typeof expiresAt !== 'number' || expiresAt <= Date.now()) {
      res.status(400).json({ error: 'expiresAt must be a future unix timestamp in milliseconds' })
      return
    }

    // Validate maxTransactions
    if (typeof maxTransactions !== 'number' || maxTransactions <= 0 || !Number.isInteger(maxTransactions)) {
      res.status(400).json({ error: 'maxTransactions must be a positive integer' })
      return
    }

    // Validate maxAmountPerTxEth
    if (typeof maxAmountPerTxEth !== 'string' || !/^\d+(\.\d+)?$/.test(maxAmountPerTxEth)) {
      res.status(400).json({ error: 'maxAmountPerTxEth must be a valid decimal string (e.g. "0.01")' })
      return
    }

    // Validate allowedRecipients
    if (!Array.isArray(allowedRecipients) || allowedRecipients.length === 0) {
      res.status(400).json({ error: 'allowedRecipients must be a non-empty array of Ethereum addresses' })
      return
    }

    const addressRegex = /^0x[0-9a-fA-F]{40}$/
    for (const addr of allowedRecipients) {
      if (typeof addr !== 'string' || !addressRegex.test(addr)) {
        res.status(400).json({ error: `Invalid Ethereum address: ${addr}` })
        return
      }
    }

    const policyId = createPolicy(id, expiresAt, maxTransactions, maxAmountPerTxEth, allowedRecipients)

    res.status(201).json({ policyId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create policy'
    res.status(500).json({ error: message })
  }
})

// POST /v1/wallets/:id/api-keys
router.post('/wallets/:id/api-keys', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    // Validate wallet exists
    const wallet = getWallet(id)
    if (!wallet) {
      res.status(404).json({ error: 'Wallet not found' })
      return
    }

    // Generate raw API key — encode walletId as prefix so auth can pre-filter DB lookup
    const rawKey = `${id}.${randomBytes(32).toString('hex')}`

    // Hash with bcrypt, cost factor 12
    const keyHash = await bcrypt.hash(rawKey, 12)

    // Store hash
    const apiKeyId = uuidv4()
    const createdAt = Date.now()
    const stmt = db.prepare(
      'INSERT INTO api_keys (id, walletId, keyHash, createdAt) VALUES (?, ?, ?, ?)'
    )
    stmt.run(apiKeyId, id, keyHash, createdAt)

    // Return raw key once — never stored
    res.status(201).json({ apiKey: rawKey })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create API key'
    res.status(500).json({ error: message })
  }
})

export default router
