import { getAddress } from 'viem'
import { config } from '../config'
import {
  createTransactionRecord,
  decrementRemainingTransactions,
  updateTransactionFinalState,
  validatePaymentRequest,
} from './policyService'
import { getSponsoredSmartAccountClient } from './pimlicoService'
import { encodeUsdcTransferCall } from './usdcService'

export async function sendUsdcPayment(
  walletId: string,
  to: string,
  amountUsdc: string
): Promise<{ txHash: string; explorerUrl: string; remainingTransactions: number }> {
  const validation = await validatePaymentRequest(walletId, to, amountUsdc)

  if (!validation.valid) {
    throw new Error(validation.error)
  }

  const { wallet, policy } = validation
  const normalizedTo = getAddress(to)
  const callData = encodeUsdcTransferCall({
    to: normalizedTo,
    amountUsdc,
  })

  const smartAccountClient = await getSponsoredSmartAccountClient(
    wallet.ownerAddress as `0x${string}`
  )

  const userOpHash = await smartAccountClient.sendUserOperation({
    calls: [
      {
        to: config.usdcBaseSepoliaAddress as `0x${string}`,
        data: callData,
        value: 0n,
      },
    ],
  })

  const transactionId = createTransactionRecord({
    walletId,
    userOpHash,
    toAddress: normalizedTo,
    amountUsdc,
    status: 'submitted',
  })

  try {
    const receipt = await smartAccountClient.waitForUserOperationReceipt({
      hash: userOpHash,
      timeout: 120_000,
    })

    const txHash = receipt.receipt.transactionHash
    if (!receipt.success || !txHash) {
      updateTransactionFinalState(transactionId, 'failed', txHash)
      throw new Error('Sponsored user operation failed onchain')
    }

    updateTransactionFinalState(transactionId, 'confirmed', txHash)
    const remainingTransactions = decrementRemainingTransactions(policy.id)

    return {
      txHash,
      explorerUrl: `https://sepolia.basescan.org/tx/${txHash}`,
      remainingTransactions,
    }
  } catch (error) {
    updateTransactionFinalState(transactionId, 'failed')
    const message =
      error instanceof Error ? error.message : 'Failed to submit sponsored user operation'
    throw new Error(message)
  }
}
