import {
  createPublicClient,
  encodeFunctionData,
  Hex,
  http,
  parseSignature,
  parseUnits,
  TypedData,
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
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'transferWithAuthorization',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(config.baseSepoliaRpcUrl),
})

export interface TransferAuthorizationRequest {
  from: `0x${string}`
  to: `0x${string}`
  amountUsdc: string
  validAfter: number
  validBefore: number
  nonce: Hex
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

export function buildTransferAuthorizationTypedData(
  request: TransferAuthorizationRequest
): TypedData | { [key: string]: unknown } {
  return {
    domain: {
      name: config.usdcName,
      version: config.usdcVersion,
      chainId: baseSepolia.id,
      verifyingContract: config.usdcBaseSepoliaAddress as `0x${string}`,
    },
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    },
    primaryType: 'TransferWithAuthorization',
    message: {
      from: request.from,
      to: request.to,
      value: parseUsdcAmount(request.amountUsdc),
      validAfter: BigInt(request.validAfter),
      validBefore: BigInt(request.validBefore),
      nonce: request.nonce,
    },
  }
}

export function encodeTransferWithAuthorizationCall(
  request: TransferAuthorizationRequest,
  signature: Hex
): Hex {
  const parsed = parseSignature(signature)

  return encodeFunctionData({
    abi: usdcAbi,
    functionName: 'transferWithAuthorization',
    args: [
      request.from,
      request.to,
      parseUsdcAmount(request.amountUsdc),
      BigInt(request.validAfter),
      BigInt(request.validBefore),
      request.nonce,
      Number(parsed.v ?? 27n),
      parsed.r,
      parsed.s,
    ],
  })
}
