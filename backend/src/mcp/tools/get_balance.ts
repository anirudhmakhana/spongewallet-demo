import { formatUnits } from 'viem'
import { config } from '../../config'
import { getUsdcBalance } from '../../services/usdcService'
import { getWallet } from '../../services/walletService'

export const getBalanceTool = {
  name: 'get_balance',
  description: 'Get the gasless USDC balance of the managed wallet on Base Sepolia',
  inputSchema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
}

export async function getBalanceHandler(
  walletId: string
): Promise<{ address: string; chain: string; symbol: string; balanceUsdc: string }> {
  const wallet = getWallet(walletId)
  if (!wallet) {
    throw new Error('Wallet not found')
  }

  const balance = await getUsdcBalance(wallet.address as `0x${string}`)

  return {
    address: wallet.address,
    chain: 'base-sepolia',
    symbol: 'USDC',
    balanceUsdc: formatUnits(balance, config.usdcDecimals),
  }
}
