import { generatePrivateKey, privateKeyToAddress } from 'viem/accounts'
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db/schema'
import { config } from '../config'

interface WalletRow {
  id: string
  address: string
  encryptedPrivateKey: string
  createdAt: number
}

function getEncryptionKey(): Buffer {
  return createHash('sha256').update(config.encryptionSecret).digest()
}

export function encryptPrivateKey(privateKey: string): string {
  const iv = randomBytes(16)
  const key = getEncryptionKey()
  const cipher = createCipheriv('aes-256-gcm', key, iv)

  const encrypted = Buffer.concat([
    cipher.update(privateKey, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptPrivateKey(encryptedData: string): string {
  const parts = encryptedData.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted private key format')
  }

  const [ivHex, authTagHex, encryptedHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const key = getEncryptionKey()

  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}

export function generateWallet(): { privateKey: string; address: string } {
  const privateKey = generatePrivateKey()
  const address = privateKeyToAddress(privateKey)
  return { privateKey, address }
}

export function storeWallet(address: string, encryptedPrivateKey: string): string {
  const walletId = uuidv4()
  const createdAt = Date.now()

  const stmt = db.prepare(
    'INSERT INTO wallets (id, address, encryptedPrivateKey, createdAt) VALUES (?, ?, ?, ?)'
  )
  stmt.run(walletId, address, encryptedPrivateKey, createdAt)

  return walletId
}

export function getWallet(walletId: string): WalletRow | null {
  const stmt = db.prepare('SELECT * FROM wallets WHERE id = ?')
  const row = stmt.get(walletId) as WalletRow | undefined
  return row || null
}
