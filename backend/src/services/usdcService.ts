import {
  createPublicClient,
  encodeFunctionData,
  http,
  parseUnits,
  webSocket,
  type Hex,
} from 'viem'
import { baseSepolia, config } from '../config'

export const usdcAbi = [
  {
    type: 'function',
    stateMutability: 'view',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: config.baseSepoliaRpcUrl.startsWith('ws')
    ? webSocket(config.baseSepoliaRpcUrl)
    : http(config.baseSepoliaRpcUrl),
})

export interface TransferRequest {
  to: `0x${string}`
  amountUsdc: string
}

export function parseUsdcAmount(amountUsdc: string): bigint {
  return parseUnits(amountUsdc as `${number}`, config.usdcDecimals)
}

export async function getUsdcBalance(address: `0x${string}`): Promise<bigint> {
  return publicClient.readContract({
    address: config.usdcBaseSepoliaAddress as `0x${string}`,
    abi: usdcAbi,
    functionName: 'balanceOf',
    args: [address],
  })
}

export function encodeUsdcTransferCall(
  request: TransferRequest
): Hex {
  return encodeFunctionData({
    abi: usdcAbi,
    functionName: 'transfer',
    args: [request.to, parseUsdcAmount(request.amountUsdc)],
  })
}
