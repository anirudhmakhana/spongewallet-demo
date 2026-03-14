import { getTransactionHistory } from '../../services/policyService'

export const getTransactionHistoryTool = {
  name: 'get_transaction_history',
  description: 'Get the sponsored smart-account USDC transaction history',
  inputSchema: {
    type: 'object' as const,
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of transactions to return (default: 10)',
      },
    },
    required: [],
  },
}

export async function getTransactionHistoryHandler(
  walletId: string,
  args: { limit?: number }
): Promise<{ items: { userOpHash: string; txHash: string | null; toAddress: string; amountUsdc: string; status: string; sentAt: number; explorerUrl: string | null }[] }> {
  const limit = args.limit ?? 10
  return {
    items: getTransactionHistory(walletId, limit),
  }
}
