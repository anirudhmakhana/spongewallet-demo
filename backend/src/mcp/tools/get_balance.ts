import { createPublicClient, http, formatEther } from 'viem'
import { baseSepolia } from 'viem/chains'
import { getWallet } from '../../services/walletService'

const publicClient = createPublicClient({ chain: baseSepolia, transport: http() })

export const getBalanceTool = {
  name: 'get_balance',
  description: 'Get the ETH balance of the managed wallet on Base Sepolia',
  inputSchema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
}

export async function getBalanceHandler(
  walletId: string,
  _args: Record<string, unknown>
): Promise<{ address: string; chain: string; symbol: string; balanceEth: string }> {
  const wallet = getWallet(walletId)
  if (!wallet) {
    throw new Error('Wallet not found')
  }

  const balance = await publicClient.getBalance({ address: wallet.address as `0x${string}` })
  const balanceEth = formatEther(balance)

  return {
    address: wallet.address,
    chain: 'base-sepolia',
    symbol: 'ETH',
    balanceEth,
  }
}
