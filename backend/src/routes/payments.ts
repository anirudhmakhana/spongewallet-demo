import { Router, Request, Response } from 'express'
import { formatUnits, getAddress } from 'viem'
import { authenticateBearer } from '../services/authService'
import { getTransactionHistory } from '../services/policyService'
import { sendUsdcPayment } from '../services/paymentService'
import { getUsdcBalance } from '../services/usdcService'
import { getWallet } from '../services/walletService'
import { config } from '../config'

const router = Router()

function isValidEthereumAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value)
}

function isValidUsdcAmount(value: string): boolean {
  return /^\d+(\.\d{1,6})?$/.test(value)
}

function getPaymentErrorStatus(message: string): number {
  if (message === 'Wallet not found') {
    return 404
  }

  if (
    message === 'No active policy found for this wallet' ||
    message === 'Policy has expired' ||
    message === 'No remaining transactions in policy' ||
    message.includes('is not in the allowlist') ||
    message.includes('exceeds maximum per transaction limit') ||
    message.startsWith('Insufficient USDC balance')
  ) {
    return 400
  }

  return 500
}

// GET /v1/balance
router.get('/balance', async (req: Request, res: Response): Promise<void> => {
  try {
    const authResult = await authenticateBearer(req.headers.authorization)
    if (!authResult) {
      res.status(401).json({ error: 'Unauthorized: Invalid or missing Bearer token' })
      return
    }

    const wallet = getWallet(authResult.walletId)
    if (!wallet) {
      res.status(404).json({ error: 'Wallet not found' })
      return
    }

    const balance = await getUsdcBalance(wallet.address as `0x${string}`)

    res.json({
      address: wallet.address,
      chain: 'base-sepolia',
      symbol: 'USDC',
      balanceUsdc: formatUnits(balance, config.usdcDecimals),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get balance'
    res.status(500).json({ error: message })
  }
})

// POST /v1/payments
router.post('/payments', async (req: Request, res: Response): Promise<void> => {
  try {
    const authResult = await authenticateBearer(req.headers.authorization)
    if (!authResult) {
      res.status(401).json({ error: 'Unauthorized: Invalid or missing Bearer token' })
      return
    }

    const { to, amountUsdc } = req.body

    if (typeof to !== 'string' || !isValidEthereumAddress(to)) {
      res.status(400).json({ error: 'Invalid recipient address format' })
      return
    }

    if (typeof amountUsdc !== 'string' || !isValidUsdcAmount(amountUsdc)) {
      res.status(400).json({ error: 'amountUsdc must be a valid USDC decimal string with up to 6 decimals' })
      return
    }

    const result = await sendUsdcPayment(authResult.walletId, getAddress(to), amountUsdc)
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send payment'
    res.status(getPaymentErrorStatus(message)).json({ error: message })
  }
})

// GET /v1/transactions
router.get('/transactions', async (req: Request, res: Response): Promise<void> => {
  try {
    const authResult = await authenticateBearer(req.headers.authorization)
    if (!authResult) {
      res.status(401).json({ error: 'Unauthorized: Invalid or missing Bearer token' })
      return
    }

    const rawLimit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) {
      res.status(400).json({ error: 'limit must be an integer between 1 and 100' })
      return
    }

    const items = getTransactionHistory(authResult.walletId, rawLimit)
    res.json({ items })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get transactions'
    res.status(500).json({ error: message })
  }
})

export default router
