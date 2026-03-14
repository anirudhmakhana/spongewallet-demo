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
  pimlicoBundlerUrl: requireEnv('PIMLICO_BUNDLER_URL'),
  pimlicoPaymasterUrl: requireEnv('PIMLICO_PAYMASTER_URL'),
  usdcBaseSepoliaAddress:
    process.env.USDC_BASE_SEPOLIA_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  usdcDecimals: parseInt(process.env.USDC_DECIMALS || '6', 10),
}

export { baseSepolia }
