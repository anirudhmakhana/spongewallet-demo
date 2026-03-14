import dotenv from 'dotenv'
import { baseSepolia } from 'viem/chains'

dotenv.config()

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} environment variable is required`)
  }

  return value
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  backendUrl: process.env.BACKEND_URL || 'http://localhost:3001',
  baseSepoliaRpcUrl: requireEnv('BASE_SEPOLIA_RPC_URL'),
  turnkeyOrganizationId: requireEnv('TURNKEY_ORGANIZATION_ID'),
  turnkeyApiPublicKey: requireEnv('TURNKEY_API_PUBLIC_KEY'),
  turnkeyApiPrivateKey: requireEnv('TURNKEY_API_PRIVATE_KEY'),
  gelatoApiKey: requireEnv('GELATO_API_KEY'),
  gelatoBaseUrl: process.env.GELATO_BASE_URL || 'https://api.t.gelato.cloud',
  usdcBaseSepoliaAddress:
    process.env.USDC_BASE_SEPOLIA_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  usdcName: process.env.USDC_NAME || 'USDC',
  usdcVersion: process.env.USDC_VERSION || '2',
  usdcDecimals: parseInt(process.env.USDC_DECIMALS || '6', 10),
  authorizationLifetimeSeconds: parseInt(process.env.AUTHORIZATION_LIFETIME_SECONDS || '600', 10),
}

export { baseSepolia }
