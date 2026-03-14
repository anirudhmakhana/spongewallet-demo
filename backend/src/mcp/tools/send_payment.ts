import { validatePaymentRequest, decrementRemainingTransactions, recordTransaction } from '../../services/policyService'
import { decryptPrivateKey } from '../../services/walletService'
import { sendPayment } from '../../services/paymentService'

export const sendPaymentTool = {
  name: 'send_payment',
  description: 'Send ETH to an address on Base Sepolia, subject to policy limits',
  inputSchema: {
    type: 'object' as const,
    properties: {
      to: {
        type: 'string',
        description: 'Recipient Ethereum address (0x...)',
      },
      amountEth: {
        type: 'string',
        description: 'Amount to send in ETH (e.g. "0.001")',
      },
    },
    required: ['to', 'amountEth'],
  },
}

export async function sendPaymentHandler(
  walletId: string,
  apiKey: string,
  args: { to: string; amountEth: string }
): Promise<{ txHash: string; explorerUrl: string; remainingTransactions: number }> {
  const { to, amountEth } = args

  // Validate address format
  if (!/^0x[0-9a-fA-F]{40}$/.test(to)) {
    throw new Error('Invalid recipient address format')
  }

  // Validate amount format
  if (!/^\d+(\.\d+)?$/.test(amountEth)) {
    throw new Error('Invalid amount format')
  }

  const validation = await validatePaymentRequest(apiKey, walletId, to, amountEth)

  if (!validation.valid) {
    throw new Error(validation.error)
  }

  const { wallet, policy } = validation

  // Decrypt private key and send payment
  const decryptedKey = decryptPrivateKey(wallet.encryptedPrivateKey)
  const { txHash, explorerUrl } = await sendPayment(decryptedKey, to, amountEth)

  // Record transaction
  recordTransaction(walletId, txHash, to, amountEth)

  // Decrement remaining transactions
  const remainingTransactions = decrementRemainingTransactions(policy.id)

  return { txHash, explorerUrl, remainingTransactions }
}
