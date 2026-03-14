import { entryPoint07Address } from 'viem/account-abstraction'
import { toSimpleSmartAccount } from 'permissionless/accounts'
import { baseSepolia } from '../config'
import { getTurnkeyOwnerAccount } from './turnkeyService'
import { publicClient } from './usdcService'

export async function getSmartAccount(ownerAddress: string) {
  const owner = await getTurnkeyOwnerAccount(ownerAddress)

  return toSimpleSmartAccount({
    client: publicClient,
    owner,
    entryPoint: {
      address: entryPoint07Address,
      version: '0.7',
    },
  })
}

export async function getSmartAccountAddress(ownerAddress: string): Promise<`0x${string}`> {
  const account = await getSmartAccount(ownerAddress)
  return account.address
}
