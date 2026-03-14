import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dotenv before anything else
vi.mock('dotenv', () => ({
  default: { config: vi.fn() },
  config: vi.fn(),
}))

// Mock config
vi.mock('../config', () => ({
  config: {
    encryptionSecret: 'test-secret-key-that-is-32-chars!!',
    port: 3001,
    backendUrl: 'http://localhost:3001',
  },
  baseSepolia: {
    id: 84532,
    name: 'Base Sepolia',
  },
}))

// Mock viem public client — must be before module imports
vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      getBalance: vi.fn().mockResolvedValue(BigInt('1000000000000000000')), // 1 ETH
    })),
  }
})

// Mock better-sqlite3
vi.mock('better-sqlite3', () => {
  const mockDb = {
    exec: vi.fn(),
    prepare: vi.fn(() => ({
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn(() => []),
    })),
    close: vi.fn(),
  }
  return { default: vi.fn(() => mockDb) }
})

import bcrypt from 'bcryptjs'

const FUTURE_EXPIRY = Date.now() + 1000 * 60 * 60 * 24 // 24 hours from now
const PAST_EXPIRY = Date.now() - 1000 * 60 // 1 minute ago

const TEST_WALLET = {
  id: 'wallet-1',
  address: '0xabc123abc123abc123abc123abc123abc123abc1',
  encryptedPrivateKey: 'iv:tag:encrypted',
  createdAt: Date.now(),
}

const TEST_POLICY = {
  id: 'policy-1',
  walletId: 'wallet-1',
  expiresAt: FUTURE_EXPIRY,
  maxTransactions: 10,
  remainingTransactions: 5,
  maxAmountPerTxEth: '0.1',
  createdAt: Date.now(),
}

const ALLOWLIST_ENTRIES = [
  { id: 'entry-1', policyId: 'policy-1', address: '0xrecipient123456789012345678901234567890' },
]

// We need to control db mock per-test, so we mock the module with factory
vi.mock('../db/schema', () => {
  const mockPrepare = vi.fn(() => ({
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn(() => []),
  }))
  return {
    db: {
      prepare: mockPrepare,
      exec: vi.fn(),
    },
    initDb: vi.fn(),
  }
})

describe('Policy Validation (validatePaymentRequest)', () => {
  const VALID_RECIPIENT = '0xrecipient123456789012345678901234567890'
  const INVALID_RECIPIENT = '0xdeadbeef1234567890abcdef1234567890abcd01'

  async function buildApiKeyRows(apiKey: string) {
    const hash = await bcrypt.hash(apiKey, 10)
    return [{ id: 'key-1', walletId: 'wallet-1', keyHash: hash, createdAt: Date.now() }]
  }

  async function setupMocksAndImport({
    apiKeyRows,
    walletRow,
    policyRow,
    allowlistRows,
  }: {
    apiKeyRows: object[]
    walletRow: object | undefined
    policyRow: object | undefined
    allowlistRows: object[]
  }) {
    const { db } = await import('../db/schema')
    const mockPrepare = db.prepare as ReturnType<typeof vi.fn>

    mockPrepare.mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM api_keys WHERE walletId')) {
        return { all: vi.fn(() => apiKeyRows), run: vi.fn(), get: vi.fn() }
      }
      if (sql.includes('SELECT * FROM wallets WHERE id')) {
        return { get: vi.fn(() => walletRow), run: vi.fn(), all: vi.fn(() => []) }
      }
      if (sql.includes('SELECT * FROM policies WHERE walletId')) {
        return { get: vi.fn(() => policyRow), run: vi.fn(), all: vi.fn(() => []) }
      }
      if (sql.includes('SELECT * FROM allowlist_entries WHERE policyId')) {
        return { all: vi.fn(() => allowlistRows), run: vi.fn(), get: vi.fn() }
      }
      return { run: vi.fn(), get: vi.fn(), all: vi.fn(() => []) }
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should reject invalid API key (step 1)', async () => {
    const validApiKey = 'correct-api-key-for-wallet'
    const wrongApiKey = 'wrong-api-key-completely-different'
    const apiKeyRows = await buildApiKeyRows(validApiKey)

    await setupMocksAndImport({
      apiKeyRows,
      walletRow: TEST_WALLET,
      policyRow: TEST_POLICY,
      allowlistRows: ALLOWLIST_ENTRIES,
    })

    const { validatePaymentRequest } = await import('../services/policyService')
    const result = await validatePaymentRequest(wrongApiKey, 'wallet-1', VALID_RECIPIENT, '0.01')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('Invalid API key')
    }
  })

  it('should reject expired policy (step 3)', async () => {
    const apiKey = 'valid-api-key-for-test-12345678'
    const apiKeyRows = await buildApiKeyRows(apiKey)
    const expiredPolicy = { ...TEST_POLICY, expiresAt: PAST_EXPIRY }

    await setupMocksAndImport({
      apiKeyRows,
      walletRow: TEST_WALLET,
      policyRow: expiredPolicy,
      allowlistRows: ALLOWLIST_ENTRIES,
    })

    const { validatePaymentRequest } = await import('../services/policyService')
    const result = await validatePaymentRequest(apiKey, 'wallet-1', VALID_RECIPIENT, '0.01')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('expired')
    }
  })

  it('should reject when zero remaining transactions (step 4)', async () => {
    const apiKey = 'valid-api-key-for-test-12345678'
    const apiKeyRows = await buildApiKeyRows(apiKey)
    const depletedPolicy = { ...TEST_POLICY, remainingTransactions: 0 }

    await setupMocksAndImport({
      apiKeyRows,
      walletRow: TEST_WALLET,
      policyRow: depletedPolicy,
      allowlistRows: ALLOWLIST_ENTRIES,
    })

    const { validatePaymentRequest } = await import('../services/policyService')
    const result = await validatePaymentRequest(apiKey, 'wallet-1', VALID_RECIPIENT, '0.01')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('remaining transactions')
    }
  })

  it('should reject non-allowlisted recipient address (step 5)', async () => {
    const apiKey = 'valid-api-key-for-test-12345678'
    const apiKeyRows = await buildApiKeyRows(apiKey)

    await setupMocksAndImport({
      apiKeyRows,
      walletRow: TEST_WALLET,
      policyRow: TEST_POLICY,
      allowlistRows: ALLOWLIST_ENTRIES,
    })

    const { validatePaymentRequest } = await import('../services/policyService')
    const result = await validatePaymentRequest(apiKey, 'wallet-1', INVALID_RECIPIENT, '0.01')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('allowlist')
    }
  })

  it('should reject amount exceeding max per transaction (step 6)', async () => {
    const apiKey = 'valid-api-key-for-test-12345678'
    const apiKeyRows = await buildApiKeyRows(apiKey)

    await setupMocksAndImport({
      apiKeyRows,
      walletRow: TEST_WALLET,
      policyRow: TEST_POLICY, // maxAmountPerTxEth: "0.1"
      allowlistRows: ALLOWLIST_ENTRIES,
    })

    const { validatePaymentRequest } = await import('../services/policyService')
    const result = await validatePaymentRequest(apiKey, 'wallet-1', VALID_RECIPIENT, '0.5') // over limit
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('exceeds maximum')
    }
  })

  it('should pass all checks for a valid payment request', async () => {
    const apiKey = 'valid-api-key-for-test-12345678'
    const apiKeyRows = await buildApiKeyRows(apiKey)

    await setupMocksAndImport({
      apiKeyRows,
      walletRow: TEST_WALLET,
      policyRow: TEST_POLICY,
      allowlistRows: ALLOWLIST_ENTRIES,
    })

    const { validatePaymentRequest } = await import('../services/policyService')
    const result = await validatePaymentRequest(apiKey, 'wallet-1', VALID_RECIPIENT, '0.01')
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.wallet).toBeDefined()
      expect(result.policy).toBeDefined()
    }
  })
})
