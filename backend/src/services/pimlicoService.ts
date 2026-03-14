import { http } from 'viem'
import { entryPoint07Address } from 'viem/account-abstraction'
import { createSmartAccountClient } from 'permissionless/clients'
import { createPimlicoClient } from 'permissionless/clients/pimlico'
import { baseSepolia, config } from '../config'
import { publicClient } from './usdcService'
import { getSmartAccount } from './smartAccountService'

export const pimlicoPaymasterClient = createPimlicoClient({
  chain: baseSepolia,
  transport: http(config.pimlicoPaymasterUrl),
  entryPoint: {
    address: entryPoint07Address,
    version: '0.7',
  },
})

export const pimlicoBundlerClient = createPimlicoClient({
  chain: baseSepolia,
  transport: http(config.pimlicoBundlerUrl),
  entryPoint: {
    address: entryPoint07Address,
    version: '0.7',
  },
})

export async function getSponsoredSmartAccountClient(ownerAddress: string) {
  const account = await getSmartAccount(ownerAddress)

  return createSmartAccountClient({
    account,
    chain: baseSepolia,
    client: publicClient,
    bundlerTransport: http(config.pimlicoBundlerUrl),
    paymaster: pimlicoPaymasterClient,
    userOperation: {
      estimateFeesPerGas: async () => {
        const gasPrice = await pimlicoBundlerClient.getUserOperationGasPrice()
        return gasPrice.fast
      },
    },
  })
}
