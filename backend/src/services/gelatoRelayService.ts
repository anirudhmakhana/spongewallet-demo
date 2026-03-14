import { Hex, TransactionReceipt } from 'viem'
import { baseSepolia, config } from '../config'

type GelatoRpcSuccess<T> = {
  id: number
  jsonrpc: '2.0'
  result: T
}

type GelatoRpcFailure = {
  id: number
  jsonrpc: '2.0'
  error: {
    code: number
    message: string
    data?: unknown
  }
}

type GelatoStatusResponse = {
  chainId: string
  createdAt: number
  status: number | string
  hash?: Hex
  receipt?: TransactionReceipt
  message?: string
  data?: unknown
}

export type RelayState =
  | { status: 'pending' | 'submitted' }
  | { status: 'confirmed'; txHash: Hex; receipt: TransactionReceipt }
  | { status: 'failed'; message: string; txHash?: Hex }

async function gelatoRpc<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${config.gelatoBaseUrl}/rpc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': config.gelatoApiKey,
    },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method,
      params,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Gelato RPC request failed (${response.status}): ${body}`)
  }

  const payload = (await response.json()) as GelatoRpcSuccess<T> | GelatoRpcFailure
  if ('error' in payload) {
    throw new Error(payload.error.message)
  }

  return payload.result
}

export async function sendSponsoredTransaction(parameters: {
  to: `0x${string}`
  data: Hex
}): Promise<string> {
  return gelatoRpc<string>('relayer_sendTransaction', {
    chainId: String(baseSepolia.id),
    payment: {
      type: 'sponsored',
    },
    to: parameters.to,
    data: parameters.data,
  })
}

export async function getRelayState(id: string): Promise<RelayState> {
  const status = await gelatoRpc<GelatoStatusResponse>('relayer_getStatus', {
    id,
    logs: false,
  })
  const statusCode = status.status

  if (statusCode === 'pending' || statusCode === 'submitted' || statusCode === 100 || statusCode === 110) {
    return {
      status: statusCode === 'submitted' || statusCode === 110 ? 'submitted' : 'pending',
    }
  }

  if (statusCode === 'success' || statusCode === 200 || statusCode === 210) {
    const receipt = status.receipt
    if (!receipt) {
      throw new Error('Gelato reported success without a receipt')
    }

    return {
      status: 'confirmed',
      txHash: receipt.transactionHash,
      receipt,
    }
  }

  if (statusCode === 'reverted' || statusCode === 500) {
    const receipt = status.receipt
    return {
      status: 'failed',
      message: typeof status.message === 'string' ? status.message : 'Gelato relayed transaction reverted on-chain',
      txHash: receipt?.transactionHash,
    }
  }

  return {
    status: 'failed',
    message: typeof status.message === 'string' ? status.message : 'Gelato rejected the transaction',
  }
}

export async function waitForRelayReceipt(id: string): Promise<TransactionReceipt> {
  const deadline = Date.now() + 120_000

  while (Date.now() < deadline) {
    const status = await getRelayState(id)
    if (status.status === 'confirmed') {
      return status.receipt
    }

    if (status.status === 'failed') {
      throw new Error(status.message)
    }

    await new Promise((resolve) => setTimeout(resolve, 2_000))
  }

  throw new Error('Timed out waiting for Gelato relay receipt')
}
