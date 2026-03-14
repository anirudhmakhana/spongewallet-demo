import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../config', () => ({
  config: {
    usdcDecimals: 6,
  },
  baseSepolia: {
    id: 84532,
    name: 'Base Sepolia',
  },
}))

vi.mock('../services/walletService', () => ({
  getWallet: vi.fn(),
}))

vi.mock('../services/usdcService', () => ({
  getUsdcBalance: vi.fn(),
  parseUsdcAmount: (value: string) => {
    const [whole, fraction = ''] = value.split('.')
    return BigInt(whole) * 1_000_000n + BigInt((fraction + '000000').slice(0, 6))
  },
}))

vi.mock('../db/schema', () => ({
  db: {
    prepare: vi.fn(),
  },
}))

const FUTURE_EXPIRY = Date.now() + 1000 * 60 * 60
const PAST_EXPIRY = Date.now() - 1000 * 60

describe('Policy Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function setupMocks({
    wallet,
    policy,
    allowlist,
    balance,
  }: {
    wallet: object | null
    policy: object | null
    allowlist: object[]
    balance: bigint
  }) {
    const { getWallet } = await import('../services/walletService')
    const { getUsdcBalance } = await import('../services/usdcService')
    const { db } = await import('../db/schema')

    vi.mocked(getWallet).mockReturnValue(wallet as never)
    vi.mocked(getUsdcBalance).mockResolvedValue(balance)

    const prepareMock = db.prepare as ReturnType<typeof vi.fn>
    prepareMock.mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM policies WHERE walletId')) {
        return { get: vi.fn(() => policy) }
      }

      if (sql.includes('SELECT * FROM allowlist_entries WHERE policyId')) {
        return { all: vi.fn(() => allowlist) }
      }

      return { get: vi.fn(), all: vi.fn(() => []), run: vi.fn() }
    })
  }

  it('rejects expired policies', async () => {
    await setupMocks({
      wallet: {
        id: 'wallet-1',
        ownerAddress: '0x1234567890123456789012345678901234567890',
        smartAccountAddress: '0x9999999999999999999999999999999999999999',
        turnkeyWalletId: 'tk-wallet',
        turnkeyAccountId: 'tk-account',
        createdAt: Date.now(),
      },
      policy: {
        id: 'policy-1',
        walletId: 'wallet-1',
        expiresAt: PAST_EXPIRY,
        maxTransactions: 10,
        remainingTransactions: 10,
        maxAmountPerTxUsdc: '5',
        createdAt: Date.now(),
      },
      allowlist: [{ address: '0xabc0000000000000000000000000000000000000' }],
      balance: 10_000_000n,
    })

    const { validatePaymentRequest } = await import('../services/policyService')
    const result = await validatePaymentRequest(
      'wallet-1',
      '0xabc0000000000000000000000000000000000000',
      '1'
    )

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('expired')
    }
  })

  it('rejects exhausted transaction counts', async () => {
    await setupMocks({
      wallet: {
        id: 'wallet-1',
        ownerAddress: '0x1234567890123456789012345678901234567890',
        smartAccountAddress: '0x9999999999999999999999999999999999999999',
        turnkeyWalletId: 'tk-wallet',
        turnkeyAccountId: 'tk-account',
        createdAt: Date.now(),
      },
      policy: {
        id: 'policy-1',
        walletId: 'wallet-1',
        expiresAt: FUTURE_EXPIRY,
        maxTransactions: 10,
        remainingTransactions: 0,
        maxAmountPerTxUsdc: '5',
        createdAt: Date.now(),
      },
      allowlist: [{ address: '0xabc0000000000000000000000000000000000000' }],
      balance: 10_000_000n,
    })

    const { validatePaymentRequest } = await import('../services/policyService')
    const result = await validatePaymentRequest(
      'wallet-1',
      '0xabc0000000000000000000000000000000000000',
      '1'
    )

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('remaining transactions')
    }
  })

  it('rejects recipients outside the allowlist', async () => {
    await setupMocks({
      wallet: {
        id: 'wallet-1',
        ownerAddress: '0x1234567890123456789012345678901234567890',
        smartAccountAddress: '0x9999999999999999999999999999999999999999',
        turnkeyWalletId: 'tk-wallet',
        turnkeyAccountId: 'tk-account',
        createdAt: Date.now(),
      },
      policy: {
        id: 'policy-1',
        walletId: 'wallet-1',
        expiresAt: FUTURE_EXPIRY,
        maxTransactions: 10,
        remainingTransactions: 10,
        maxAmountPerTxUsdc: '5',
        createdAt: Date.now(),
      },
      allowlist: [{ address: '0xabc0000000000000000000000000000000000000' }],
      balance: 10_000_000n,
    })

    const { validatePaymentRequest } = await import('../services/policyService')
    const result = await validatePaymentRequest(
      'wallet-1',
      '0xdef0000000000000000000000000000000000000',
      '1'
    )

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('allowlist')
    }
  })

  it('rejects amounts above the per-transaction USDC ceiling', async () => {
    await setupMocks({
      wallet: {
        id: 'wallet-1',
        ownerAddress: '0x1234567890123456789012345678901234567890',
        smartAccountAddress: '0x9999999999999999999999999999999999999999',
        turnkeyWalletId: 'tk-wallet',
        turnkeyAccountId: 'tk-account',
        createdAt: Date.now(),
      },
      policy: {
        id: 'policy-1',
        walletId: 'wallet-1',
        expiresAt: FUTURE_EXPIRY,
        maxTransactions: 10,
        remainingTransactions: 10,
        maxAmountPerTxUsdc: '5',
        createdAt: Date.now(),
      },
      allowlist: [{ address: '0xabc0000000000000000000000000000000000000' }],
      balance: 10_000_000n,
    })

    const { validatePaymentRequest } = await import('../services/policyService')
    const result = await validatePaymentRequest(
      'wallet-1',
      '0xabc0000000000000000000000000000000000000',
      '10'
    )

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('exceeds maximum')
    }
  })

  it('rejects insufficient USDC balance', async () => {
    await setupMocks({
      wallet: {
        id: 'wallet-1',
        ownerAddress: '0x1234567890123456789012345678901234567890',
        smartAccountAddress: '0x9999999999999999999999999999999999999999',
        turnkeyWalletId: 'tk-wallet',
        turnkeyAccountId: 'tk-account',
        createdAt: Date.now(),
      },
      policy: {
        id: 'policy-1',
        walletId: 'wallet-1',
        expiresAt: FUTURE_EXPIRY,
        maxTransactions: 10,
        remainingTransactions: 10,
        maxAmountPerTxUsdc: '5',
        createdAt: Date.now(),
      },
      allowlist: [{ address: '0xabc0000000000000000000000000000000000000' }],
      balance: 500_000n,
    })

    const { validatePaymentRequest } = await import('../services/policyService')
    const result = await validatePaymentRequest(
      'wallet-1',
      '0xabc0000000000000000000000000000000000000',
      '1'
    )

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('Insufficient USDC balance')
    }
  })

  it('passes for a valid gasless USDC payment request', async () => {
    await setupMocks({
      wallet: {
        id: 'wallet-1',
        ownerAddress: '0x1234567890123456789012345678901234567890',
        smartAccountAddress: '0x9999999999999999999999999999999999999999',
        turnkeyWalletId: 'tk-wallet',
        turnkeyAccountId: 'tk-account',
        createdAt: Date.now(),
      },
      policy: {
        id: 'policy-1',
        walletId: 'wallet-1',
        expiresAt: FUTURE_EXPIRY,
        maxTransactions: 10,
        remainingTransactions: 10,
        maxAmountPerTxUsdc: '5',
        createdAt: Date.now(),
      },
      allowlist: [{ address: '0xabc0000000000000000000000000000000000000' }],
      balance: 10_000_000n,
    })

    const { validatePaymentRequest } = await import('../services/policyService')
    const result = await validatePaymentRequest(
      'wallet-1',
      '0xabc0000000000000000000000000000000000000',
      '1.25'
    )

    expect(result.valid).toBe(true)
  })
})
