import { getAddress } from 'viem'
import { sendUsdcPayment } from '../../services/paymentService'

export const sendPaymentTool = {
  name: 'send_payment',
  description: 'Send gasless USDC to an address on Base Sepolia, subject to policy limits',
  inputSchema: {
    type: 'object' as const,
    properties: {
      to: {
        type: 'string',
        description: 'Recipient Ethereum address (0x...)',
      },
      amountUsdc: {
        type: 'string',
        description: 'Amount to send in USDC, up to 6 decimals (e.g. "5.25")',
      },
    },
    required: ['to', 'amountUsdc'],
  },
}

export async function sendPaymentHandler(
  walletId: string,
  args: { to: string; amountUsdc: string }
): Promise<{ txHash: string; explorerUrl: string; remainingTransactions: number }> {
  const { to, amountUsdc } = args

  if (!/^0x[0-9a-fA-F]{40}$/.test(to)) {
    throw new Error('Invalid recipient address format')
  }

  if (!/^\d+(\.\d{1,6})?$/.test(amountUsdc)) {
    throw new Error('amountUsdc must be a valid USDC decimal string with up to 6 decimals')
  }

  return sendUsdcPayment(walletId, getAddress(to), amountUsdc)
}
