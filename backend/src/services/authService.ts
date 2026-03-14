import bcrypt from 'bcryptjs'
import { db } from '../db/schema'

interface ApiKeyRow {
  id: string
  walletId: string
  keyHash: string
  createdAt: number
}

export async function authenticateBearer(
  authHeader: string | undefined
): Promise<{ walletId: string; apiKey: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const apiKey = authHeader.slice(7)
  const dotIndex = apiKey.indexOf('.')

  if (dotIndex === -1) {
    return null
  }

  const walletId = apiKey.slice(0, dotIndex)
  const stmt = db.prepare('SELECT * FROM api_keys WHERE walletId = ?')
  const rows = stmt.all(walletId) as ApiKeyRow[]

  for (const row of rows) {
    const matches = await bcrypt.compare(apiKey, row.keyHash)
    if (matches) {
      return { walletId: row.walletId, apiKey }
    }
  }

  return null
}
