import { beforeEach, describe, expect, it, vi } from 'vitest'
import bcrypt from 'bcryptjs'

const runMock = vi.fn()
const getMock = vi.fn()

vi.mock('better-sqlite3', () => {
  return {
    default: vi.fn(() => ({
      exec: vi.fn(),
      pragma: vi.fn(() => 2),
      prepare: vi.fn(() => ({
        run: runMock,
        get: getMock,
        all: vi.fn(() => []),
      })),
    })),
  }
})

describe('Wallet Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stores turnkey-backed wallet metadata', async () => {
    const { storeWallet } = await import('../services/walletService')
    const walletId = storeWallet(
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
      'tk-wallet',
      'tk-account'
    )

    expect(walletId).toBeTruthy()
    expect(runMock).toHaveBeenCalled()
  })

  it('returns stored wallet rows', async () => {
    getMock.mockReturnValueOnce({
      id: 'wallet-1',
      ownerAddress: '0x1111111111111111111111111111111111111111',
      smartAccountAddress: '0x2222222222222222222222222222222222222222',
      turnkeyWalletId: 'tk-wallet',
      turnkeyAccountId: 'tk-account',
      createdAt: Date.now(),
    })

    const { getWallet } = await import('../services/walletService')
    const wallet = getWallet('wallet-1')

    expect(wallet?.turnkeyWalletId).toBe('tk-wallet')
    expect(wallet?.turnkeyAccountId).toBe('tk-account')
    expect(wallet?.smartAccountAddress).toBe('0x2222222222222222222222222222222222222222')
  })

  it('creates bcrypt-protected API keys with the wallet id prefix', async () => {
    const { createApiKey } = await import('../services/walletService')
    const apiKey = await createApiKey('wallet-123')

    expect(apiKey.startsWith('wallet-123.')).toBe(true)
    const [, , keyHash] = runMock.mock.calls.at(-1) ?? []
    expect(typeof keyHash).toBe('string')
    expect(await bcrypt.compare(apiKey, keyHash)).toBe(true)
  })
})
