import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../config', () => ({
  config: {
    usdcBaseSepoliaAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },
}))

vi.mock('../services/policyService', () => ({
  validatePaymentRequest: vi.fn(),
  createTransactionRecord: vi.fn(),
  updateTransactionFinalState: vi.fn(),
  decrementRemainingTransactions: vi.fn(),
}))

vi.mock('../services/pimlicoService', () => ({
  getSponsoredSmartAccountClient: vi.fn(),
}))

vi.mock('../services/usdcService', () => ({
  encodeUsdcTransferCall: vi.fn(),
}))

describe('Payment Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('persists userOpHash and decrements policy only after receipt confirmation', async () => {
    const { validatePaymentRequest, createTransactionRecord, updateTransactionFinalState, decrementRemainingTransactions } = await import('../services/policyService')
    const { getSponsoredSmartAccountClient } = await import('../services/pimlicoService')
    const { encodeUsdcTransferCall } = await import('../services/usdcService')

    vi.mocked(validatePaymentRequest).mockResolvedValue({
      valid: true,
      wallet: {
        id: 'wallet-1',
        ownerAddress: '0x1111111111111111111111111111111111111111',
        smartAccountAddress: '0x2222222222222222222222222222222222222222',
        turnkeyWalletId: 'tk-wallet',
        turnkeyAccountId: 'tk-account',
        createdAt: Date.now(),
      },
      policy: {
        id: 'policy-1',
        walletId: 'wallet-1',
        expiresAt: Date.now() + 60_000,
        maxTransactions: 10,
        remainingTransactions: 10,
        maxAmountPerTxUsdc: '5',
        createdAt: Date.now(),
        allowedRecipients: ['0x3333333333333333333333333333333333333333'],
      },
    })
    vi.mocked(encodeUsdcTransferCall).mockReturnValue('0xabcdef')
    vi.mocked(createTransactionRecord).mockReturnValue('tx-row-1')
    vi.mocked(decrementRemainingTransactions).mockReturnValue(9)
    vi.mocked(getSponsoredSmartAccountClient).mockResolvedValue({
      sendUserOperation: vi.fn().mockResolvedValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
      waitForUserOperationReceipt: vi.fn().mockResolvedValue({
        success: true,
        receipt: {
          transactionHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        },
      }),
    } as never)

    const { sendUsdcPayment } = await import('../services/paymentService')
    const result = await sendUsdcPayment(
      'wallet-1',
      '0x3333333333333333333333333333333333333333',
      '1.25'
    )

    expect(createTransactionRecord).toHaveBeenCalledWith({
      walletId: 'wallet-1',
      userOpHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      toAddress: '0x3333333333333333333333333333333333333333',
      amountUsdc: '1.25',
      status: 'submitted',
    })
    expect(updateTransactionFinalState).toHaveBeenCalledWith(
      'tx-row-1',
      'confirmed',
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    )
    expect(decrementRemainingTransactions).toHaveBeenCalledWith('policy-1')
    expect(result.remainingTransactions).toBe(9)
  })

  it('marks the transaction failed when receipt waiting throws', async () => {
    const { validatePaymentRequest, createTransactionRecord, updateTransactionFinalState, decrementRemainingTransactions } = await import('../services/policyService')
    const { getSponsoredSmartAccountClient } = await import('../services/pimlicoService')
    const { encodeUsdcTransferCall } = await import('../services/usdcService')

    vi.mocked(validatePaymentRequest).mockResolvedValue({
      valid: true,
      wallet: {
        id: 'wallet-1',
        ownerAddress: '0x1111111111111111111111111111111111111111',
        smartAccountAddress: '0x2222222222222222222222222222222222222222',
        turnkeyWalletId: 'tk-wallet',
        turnkeyAccountId: 'tk-account',
        createdAt: Date.now(),
      },
      policy: {
        id: 'policy-1',
        walletId: 'wallet-1',
        expiresAt: Date.now() + 60_000,
        maxTransactions: 10,
        remainingTransactions: 10,
        maxAmountPerTxUsdc: '5',
        createdAt: Date.now(),
        allowedRecipients: ['0x3333333333333333333333333333333333333333'],
      },
    })
    vi.mocked(encodeUsdcTransferCall).mockReturnValue('0xabcdef')
    vi.mocked(createTransactionRecord).mockReturnValue('tx-row-1')
    vi.mocked(getSponsoredSmartAccountClient).mockResolvedValue({
      sendUserOperation: vi.fn().mockResolvedValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
      waitForUserOperationReceipt: vi.fn().mockRejectedValue(new Error('bundler timeout')),
    } as never)

    const { sendUsdcPayment } = await import('../services/paymentService')

    await expect(
      sendUsdcPayment('wallet-1', '0x3333333333333333333333333333333333333333', '1.25')
    ).rejects.toThrow('bundler timeout')

    expect(updateTransactionFinalState).toHaveBeenCalledWith('tx-row-1', 'failed')
    expect(decrementRemainingTransactions).not.toHaveBeenCalled()
  })
})
