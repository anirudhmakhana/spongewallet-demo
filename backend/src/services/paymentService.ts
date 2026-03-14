import { randomBytes } from 'crypto'
import { getAddress } from 'viem'
import { config } from '../config'
import { sendSponsoredTransaction, getRelayState, waitForRelayReceipt } from './gelatoRelayService'
import {
  createAuthorizationRecord,
  decrementRemainingTransactions,
  recordTransaction,
  updateAuthorizationAfterSubmission,
  updateAuthorizationFinalState,
  validatePaymentRequest,
} from './policyService'
import {
  buildTransferAuthorizationTypedData,
  encodeTransferWithAuthorizationCall,
} from './usdcService'
import { signUsdcAuthorization } from './turnkeyService'

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
  const validAfter = Math.floor(Date.now() / 1000) - 60
  const validBefore = validAfter + config.authorizationLifetimeSeconds
  const nonce = `0x${randomBytes(32).toString('hex')}` as `0x${string}`
  const normalizedTo = getAddress(to)
  const authorizationId = createAuthorizationRecord({
    walletId,
    nonce,
    toAddress: normalizedTo,
    amountUsdc,
    validAfter,
    validBefore,
    status: 'pending',
  })

  try {
    const authorizationRequest = {
      from: wallet.address as `0x${string}`,
      to: normalizedTo,
      amountUsdc,
      validAfter,
      validBefore,
      nonce,
    }

    const typedData = buildTransferAuthorizationTypedData(authorizationRequest)
    const signature = await signUsdcAuthorization(wallet.address, typedData)
    const data = encodeTransferWithAuthorizationCall(authorizationRequest, signature)

    const gelatoTaskId = await sendSponsoredTransaction({
      to: config.usdcBaseSepoliaAddress as `0x${string}`,
      data,
    })

    updateAuthorizationAfterSubmission(authorizationId, gelatoTaskId, 'submitted')

    const receipt = await waitForRelayReceipt(gelatoTaskId)
    updateAuthorizationFinalState(authorizationId, 'confirmed', receipt.transactionHash)
    recordTransaction(walletId, receipt.transactionHash, normalizedTo, amountUsdc)
    const remainingTransactions = decrementRemainingTransactions(policy.id)

    return {
      txHash: receipt.transactionHash,
      explorerUrl: `https://sepolia.basescan.org/tx/${receipt.transactionHash}`,
      remainingTransactions,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit Gelato relay transaction'

    try {
      const rows = getRelayStateForAuthorization(authorizationId)
      if (rows?.gelatoTaskId) {
        const relayState = await getRelayState(rows.gelatoTaskId)
        if (relayState.status === 'confirmed') {
          updateAuthorizationFinalState(authorizationId, 'confirmed', relayState.txHash)
        } else if (relayState.status === 'failed') {
          updateAuthorizationFinalState(authorizationId, 'failed', relayState.txHash)
        }
      } else {
        updateAuthorizationFinalState(authorizationId, 'failed_prebroadcast')
      }
    } catch {
      updateAuthorizationFinalState(authorizationId, 'failed')
    }

    throw new Error(message)
  }
}

function getRelayStateForAuthorization(
  authorizationId: string
): { gelatoTaskId: string | null } | null {
  // Local import avoids a circular module edge for this narrow lookup.
  const { db } = require('../db/schema') as typeof import('../db/schema')
  const stmt = db.prepare('SELECT gelatoTaskId FROM authorizations WHERE id = ?')
  const row = stmt.get(authorizationId) as { gelatoTaskId: string | null } | undefined
  return row || null
}
