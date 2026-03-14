import { formatUnits } from 'viem'
import { config } from '../../config'
import { getUsdcBalance } from '../../services/usdcService'
import { getWallet } from '../../services/walletService'

export const getBalanceTool = {
  name: 'get_balance',
  description: 'Get the USDC balance of the sponsored smart account on Base Sepolia',
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

  const balance = await getUsdcBalance(wallet.smartAccountAddress as `0x${string}`)

  return {
    address: wallet.smartAccountAddress,
    chain: 'base-sepolia',
    symbol: 'USDC',
    balanceUsdc: formatUnits(balance, config.usdcDecimals),
  }
}
