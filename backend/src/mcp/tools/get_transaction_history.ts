import { getTransactionHistory } from '../../services/policyService'

export const getTransactionHistoryTool = {
  name: 'get_transaction_history',
  description: 'Get the transaction history for the managed wallet',
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
): Promise<{ items: { txHash: string; toAddress: string; amountEth: string; sentAt: number; explorerUrl: string }[] }> {
  const limit = args.limit ?? 10
  const items = getTransactionHistory(walletId, limit)
  return { items }
}
