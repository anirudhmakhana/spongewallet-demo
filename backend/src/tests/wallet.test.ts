import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'

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
  return {
    default: vi.fn(() => mockDb),
  }
})

// Mock dotenv before config loads
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

// Mock db/schema
vi.mock('../db/schema', () => ({
  db: {
    prepare: vi.fn(() => ({
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn(() => []),
    })),
    exec: vi.fn(),
  },
  initDb: vi.fn(),
}))

describe('Wallet Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateWallet', () => {
    it('should return a valid 0x address with 42 characters', async () => {
      const { generateWallet } = await import('../services/walletService')
      const { address } = generateWallet()

      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/)
      expect(address).toHaveLength(42)
    })

    it('should return a private key in 0x format', async () => {
      const { generateWallet } = await import('../services/walletService')
      const { privateKey } = generateWallet()

      expect(privateKey).toMatch(/^0x[0-9a-fA-F]{64}$/)
    })

    it('should generate unique wallets each call', async () => {
      const { generateWallet } = await import('../services/walletService')
      const wallet1 = generateWallet()
      const wallet2 = generateWallet()

      expect(wallet1.address).not.toBe(wallet2.address)
      expect(wallet1.privateKey).not.toBe(wallet2.privateKey)
    })
  })

  describe('encryptPrivateKey / decryptPrivateKey', () => {
    it('should encrypt and decrypt private key in a roundtrip', async () => {
      const { encryptPrivateKey, decryptPrivateKey, generateWallet } = await import('../services/walletService')
      const { privateKey } = generateWallet()

      const encrypted = encryptPrivateKey(privateKey)
      const decrypted = decryptPrivateKey(encrypted)

      expect(decrypted).toBe(privateKey)
    })

    it('should produce different ciphertext for same input (unique IV per call)', async () => {
      const { encryptPrivateKey, generateWallet } = await import('../services/walletService')
      const { privateKey } = generateWallet()

      const encrypted1 = encryptPrivateKey(privateKey)
      const encrypted2 = encryptPrivateKey(privateKey)

      expect(encrypted1).not.toBe(encrypted2)
    })

    it('should store encrypted data in iv:authTag:ciphertext format', async () => {
      const { encryptPrivateKey, generateWallet } = await import('../services/walletService')
      const { privateKey } = generateWallet()

      const encrypted = encryptPrivateKey(privateKey)
      const parts = encrypted.split(':')

      expect(parts).toHaveLength(3)
      // IV is 16 bytes = 32 hex chars
      expect(parts[0]).toHaveLength(32)
      // Auth tag is 16 bytes = 32 hex chars
      expect(parts[1]).toHaveLength(32)
    })

    it('should throw on invalid encrypted format', async () => {
      const { decryptPrivateKey } = await import('../services/walletService')

      expect(() => decryptPrivateKey('invalid')).toThrow('Invalid encrypted private key format')
    })
  })

  describe('bcrypt API key hashing', () => {
    it('should verify raw key against hash successfully', async () => {
      const rawKey = 'my-super-secret-api-key-64chars1234567890abcdef'
      const hash = await bcrypt.hash(rawKey, 10)
      const matches = await bcrypt.compare(rawKey, hash)

      expect(matches).toBe(true)
    })

    it('should fail verification with wrong key', async () => {
      const rawKey = 'correct-api-key-long-enough-12345'
      const wrongKey = 'wrong-api-key-long-enough-123456'
      const hash = await bcrypt.hash(rawKey, 10)
      const matches = await bcrypt.compare(wrongKey, hash)

      expect(matches).toBe(false)
    })

    it('should produce different hashes for same key (bcrypt salting)', async () => {
      const rawKey = 'test-api-key-long-enough-12345678'
      const hash1 = await bcrypt.hash(rawKey, 10)
      const hash2 = await bcrypt.hash(rawKey, 10)

      expect(hash1).not.toBe(hash2)
    })

    it('should still verify successfully even with different salts', async () => {
      const rawKey = 'test-api-key-long-enough-12345678'
      const hash1 = await bcrypt.hash(rawKey, 10)
      const hash2 = await bcrypt.hash(rawKey, 10)

      const [matches1, matches2] = await Promise.all([
        bcrypt.compare(rawKey, hash1),
        bcrypt.compare(rawKey, hash2),
      ])

      expect(matches1).toBe(true)
      expect(matches2).toBe(true)
    })
  })
})
