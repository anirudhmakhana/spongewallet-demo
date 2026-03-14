import { Router, Request, Response } from 'express'
import { authenticateBearer } from '../services/authService'
import { createPolicy, getActivePolicy } from '../services/policyService'
import { provisionWallet } from '../services/turnkeyService'
import { createApiKey, getWallet, storeWallet } from '../services/walletService'

const router = Router()

function isValidEthereumAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value)
}

function isValidUsdcAmount(value: string): boolean {
  return /^\d+(\.\d{1,6})?$/.test(value)
}

function buildWalletResponse(walletId: string) {
  const wallet = getWallet(walletId)
  if (!wallet) {
    return null
  }

  const policy = getActivePolicy(walletId)

  return {
    walletId: wallet.id,
    address: wallet.address,
    policy: policy
      ? {
          id: policy.id,
          expiresAt: policy.expiresAt,
          maxTransactions: policy.maxTransactions,
          remainingTransactions: policy.remainingTransactions,
          maxAmountPerTxUsdc: policy.maxAmountPerTxUsdc,
          allowedRecipients: policy.allowedRecipients,
        }
      : undefined,
  }
}

// POST /v1/wallets
router.post('/wallets', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, expiresAt, maxTransactions, maxAmountPerTxUsdc, allowedRecipients } = req.body

    if (typeof expiresAt !== 'number' || expiresAt <= Date.now()) {
      res.status(400).json({ error: 'expiresAt must be a future unix timestamp in milliseconds' })
      return
    }

    if (
      typeof maxTransactions !== 'number' ||
      maxTransactions <= 0 ||
      !Number.isInteger(maxTransactions)
    ) {
      res.status(400).json({ error: 'maxTransactions must be a positive integer' })
      return
    }

    if (typeof maxAmountPerTxUsdc !== 'string' || !isValidUsdcAmount(maxAmountPerTxUsdc)) {
      res.status(400).json({ error: 'maxAmountPerTxUsdc must be a valid USDC decimal string' })
      return
    }

    if (!Array.isArray(allowedRecipients) || allowedRecipients.length === 0) {
      res.status(400).json({ error: 'allowedRecipients must be a non-empty array of Ethereum addresses' })
      return
    }

    for (const recipient of allowedRecipients) {
      if (typeof recipient !== 'string' || !isValidEthereumAddress(recipient)) {
        res.status(400).json({ error: `Invalid Ethereum address: ${recipient}` })
        return
      }
    }

    const turnkeyWallet = await provisionWallet(name)
    const walletId = storeWallet(
      turnkeyWallet.address,
      turnkeyWallet.turnkeyWalletId,
      turnkeyWallet.turnkeyAccountId
    )

    createPolicy(walletId, expiresAt, maxTransactions, maxAmountPerTxUsdc, allowedRecipients)
    const apiKey = await createApiKey(walletId)

    res.status(201).json({ walletId, address: turnkeyWallet.address, apiKey })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create wallet'
    res.status(500).json({ error: message })
  }
})

// GET /v1/me
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    const authResult = await authenticateBearer(req.headers.authorization)
    if (!authResult) {
      res.status(401).json({ error: 'Unauthorized: Invalid or missing Bearer token' })
      return
    }

    const payload = buildWalletResponse(authResult.walletId)
    if (!payload) {
      res.status(404).json({ error: 'Wallet not found' })
      return
    }

    res.json(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to restore wallet session'
    res.status(500).json({ error: message })
  }
})

// GET /v1/wallets/:id
router.get('/wallets/:id', (req: Request, res: Response): void => {
  try {
    const payload = buildWalletResponse(req.params.id)
    if (!payload) {
      res.status(404).json({ error: 'Wallet not found' })
      return
    }

    res.json(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get wallet'
    res.status(500).json({ error: message })
  }
})

// POST /v1/wallets/:id/policy
router.post('/wallets/:id/policy', (req: Request, res: Response): void => {
  try {
    const wallet = getWallet(req.params.id)
    if (!wallet) {
      res.status(404).json({ error: 'Wallet not found' })
      return
    }

    const { expiresAt, maxTransactions, maxAmountPerTxUsdc, allowedRecipients } = req.body

    if (typeof expiresAt !== 'number' || expiresAt <= Date.now()) {
      res.status(400).json({ error: 'expiresAt must be a future unix timestamp in milliseconds' })
      return
    }

    if (
      typeof maxTransactions !== 'number' ||
      maxTransactions <= 0 ||
      !Number.isInteger(maxTransactions)
    ) {
      res.status(400).json({ error: 'maxTransactions must be a positive integer' })
      return
    }

    if (typeof maxAmountPerTxUsdc !== 'string' || !isValidUsdcAmount(maxAmountPerTxUsdc)) {
      res.status(400).json({ error: 'maxAmountPerTxUsdc must be a valid USDC decimal string' })
      return
    }

    if (!Array.isArray(allowedRecipients) || allowedRecipients.length === 0) {
      res.status(400).json({ error: 'allowedRecipients must be a non-empty array of Ethereum addresses' })
      return
    }

    for (const recipient of allowedRecipients) {
      if (typeof recipient !== 'string' || !isValidEthereumAddress(recipient)) {
        res.status(400).json({ error: `Invalid Ethereum address: ${recipient}` })
        return
      }
    }

    const policyId = createPolicy(
      req.params.id,
      expiresAt,
      maxTransactions,
      maxAmountPerTxUsdc,
      allowedRecipients
    )

    res.status(201).json({ policyId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create policy'
    res.status(500).json({ error: message })
  }
})

// POST /v1/wallets/:id/api-keys
router.post('/wallets/:id/api-keys', async (req: Request, res: Response): Promise<void> => {
  try {
    const wallet = getWallet(req.params.id)
    if (!wallet) {
      res.status(404).json({ error: 'Wallet not found' })
      return
    }

    const apiKey = await createApiKey(req.params.id)
    res.status(201).json({ apiKey })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create API key'
    res.status(500).json({ error: message })
  }
})

export default router
