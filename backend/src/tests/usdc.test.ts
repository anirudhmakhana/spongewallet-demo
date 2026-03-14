import { describe, expect, it, vi } from 'vitest'

vi.mock('../config', () => ({
  config: {
    usdcBaseSepoliaAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    usdcDecimals: 6,
    baseSepoliaRpcUrl: 'https://example-rpc.local',
  },
  baseSepolia: {
    id: 84532,
    name: 'Base Sepolia',
  },
}))

describe('USDC service', () => {
  it('encodes ERC20 transfer calldata for smart-account execution', async () => {
    const { encodeUsdcTransferCall } = await import('../services/usdcService')

    const calldata = encodeUsdcTransferCall({
      to: '0x2222222222222222222222222222222222222222',
      amountUsdc: '5.25',
    })

    expect(calldata.startsWith('0x')).toBe(true)
    expect(calldata.length).toBeGreaterThan(10)
    expect(calldata.slice(0, 10)).toBe('0xa9059cbb')
  })

  it('parses 6-decimal USDC amounts into base units', async () => {
    const { parseUsdcAmount } = await import('../services/usdcService')

    expect(parseUsdcAmount('5.25')).toBe(5_250_000n)
    expect(parseUsdcAmount('0.000001')).toBe(1n)
  })
})
