import { describe, expect, it, vi } from 'vitest'

vi.mock('../config', () => ({
  config: {
    usdcBaseSepoliaAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    usdcName: 'USDC',
    usdcVersion: '2',
    usdcDecimals: 6,
    baseSepoliaRpcUrl: 'https://example-rpc.local',
  },
  baseSepolia: {
    id: 84532,
    name: 'Base Sepolia',
  },
}))

describe('USDC authorization payloads', () => {
  it('builds deterministic typed data and calldata for transferWithAuthorization', async () => {
    const {
      buildTransferAuthorizationTypedData,
      encodeTransferWithAuthorizationCall,
    } = await import('../services/usdcService')

    const request = {
      from: '0x1111111111111111111111111111111111111111' as const,
      to: '0x2222222222222222222222222222222222222222' as const,
      amountUsdc: '5.25',
      validAfter: 1,
      validBefore: 2,
      nonce: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const,
    }

    const typedData = buildTransferAuthorizationTypedData(request) as Record<string, any>
    expect(typedData.domain.name).toBe('USDC')
    expect(typedData.domain.chainId).toBe(84532)
    expect(typedData.message.value).toBe(5_250_000n)

    const signature =
      '0x2a00000000000000000000000000000000000000000000000000000000000000' +
      '2b00000000000000000000000000000000000000000000000000000000000000' +
      '1b'
    const calldata = encodeTransferWithAuthorizationCall(request, signature as `0x${string}`)

    expect(calldata.startsWith('0x')).toBe(true)
    expect(calldata.length).toBeGreaterThan(10)
  })
})
