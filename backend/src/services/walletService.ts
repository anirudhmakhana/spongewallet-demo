import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db/schema'

export interface WalletRow {
  id: string
  ownerAddress: string
  smartAccountAddress: string
  turnkeyWalletId: string
  turnkeyAccountId: string
  createdAt: number
}

export function storeWallet(
  ownerAddress: string,
  smartAccountAddress: string,
  turnkeyWalletId: string,
  turnkeyAccountId: string
): string {
  const walletId = uuidv4()
  const createdAt = Date.now()

  const stmt = db.prepare(
    'INSERT INTO wallets (id, ownerAddress, smartAccountAddress, turnkeyWalletId, turnkeyAccountId, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
  )
  stmt.run(walletId, ownerAddress, smartAccountAddress, turnkeyWalletId, turnkeyAccountId, createdAt)

  return walletId
}

export function getWallet(walletId: string): WalletRow | null {
  const stmt = db.prepare('SELECT * FROM wallets WHERE id = ?')
  const row = stmt.get(walletId) as WalletRow | undefined
  return row || null
}

export async function createApiKey(walletId: string): Promise<string> {
  const rawKey = `${walletId}.${randomBytes(32).toString('hex')}`
  const keyHash = await bcrypt.hash(rawKey, 12)
  const apiKeyId = uuidv4()
  const createdAt = Date.now()

  const stmt = db.prepare(
    'INSERT INTO api_keys (id, walletId, keyHash, createdAt) VALUES (?, ?, ?, ?)'
  )
  stmt.run(apiKeyId, walletId, keyHash, createdAt)

  return rawKey
}
