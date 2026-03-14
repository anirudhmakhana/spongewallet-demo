import dotenv from 'dotenv'
import { baseSepolia } from 'viem/chains'

dotenv.config()

const encryptionSecret = process.env.ENCRYPTION_SECRET

if (!encryptionSecret) {
  throw new Error('ENCRYPTION_SECRET environment variable is required')
}

if (encryptionSecret.length < 32) {
  throw new Error('ENCRYPTION_SECRET must be at least 32 characters long')
}

export const config = {
  encryptionSecret,
  port: parseInt(process.env.PORT || '3001', 10),
  backendUrl: process.env.BACKEND_URL || 'http://localhost:3001',
}

export { baseSepolia }
