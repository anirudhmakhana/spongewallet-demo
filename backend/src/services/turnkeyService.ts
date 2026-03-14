import { Turnkey, defaultEthereumAccountAtIndex } from '@turnkey/sdk-server'
import { signTypedData as turnkeySignTypedData } from '@turnkey/viem'
import { getAddress, Hex, TypedData } from 'viem'
import { config } from '../config'

const turnkey = new Turnkey({
  apiBaseUrl: 'https://api.turnkey.com',
  apiPrivateKey: config.turnkeyApiPrivateKey,
  apiPublicKey: config.turnkeyApiPublicKey,
  defaultOrganizationId: config.turnkeyOrganizationId,
})

const turnkeyClient = turnkey.apiClient()

function findNestedValue(
  input: unknown,
  predicate: (value: unknown) => boolean
): unknown | null {
  if (predicate(input)) {
    return input
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      const found = findNestedValue(item, predicate)
      if (found !== null) {
        return found
      }
    }
    return null
  }

  if (input && typeof input === 'object') {
    for (const value of Object.values(input)) {
      const found = findNestedValue(value, predicate)
      if (found !== null) {
        return found
      }
    }
  }

  return null
}

function findWalletId(input: unknown): string | null {
  const found = findNestedValue(input, (value) => {
    return (
      !!value &&
      typeof value === 'object' &&
      'walletId' in value &&
      typeof (value as { walletId?: unknown }).walletId === 'string'
    )
  }) as { walletId: string } | null

  return found?.walletId || null
}

function findEthereumAccount(
  input: unknown
): { turnkeyAccountId: string; address: string } | null {
  const found = findNestedValue(input, (value) => {
    if (!value || typeof value !== 'object') {
      return false
    }

    const candidate = value as Record<string, unknown>
    return (
      typeof candidate.address === 'string' &&
      /^0x[0-9a-fA-F]{40}$/.test(candidate.address) &&
      typeof candidate.addressFormat === 'string' &&
      candidate.addressFormat === 'ADDRESS_FORMAT_ETHEREUM'
    )
  }) as Record<string, unknown> | null

  if (!found || typeof found.address !== 'string') {
    return null
  }

  const turnkeyAccountId =
    typeof found.walletAccountId === 'string'
      ? found.walletAccountId
      : typeof found.accountId === 'string'
        ? found.accountId
        : typeof found.address === 'string'
          ? found.address
          : null

  if (!turnkeyAccountId) {
    return null
  }

  return {
    turnkeyAccountId,
    address: getAddress(found.address),
  }
}

export async function provisionWallet(
  walletName?: string
): Promise<{ turnkeyWalletId: string; turnkeyAccountId: string; address: string }> {
  const createWalletResponse = await turnkeyClient.createWallet({
    organizationId: config.turnkeyOrganizationId,
    walletName: walletName || `SpongeWallet ${Date.now()}`,
    accounts: [defaultEthereumAccountAtIndex(0)],
  })

  const turnkeyWalletId = findWalletId(createWalletResponse)
  if (!turnkeyWalletId) {
    throw new Error('Turnkey createWallet response did not include a walletId')
  }

  const walletAccountsResponse = await turnkeyClient.getWalletAccounts({
    organizationId: config.turnkeyOrganizationId,
    walletId: turnkeyWalletId,
  })

  const account = findEthereumAccount(walletAccountsResponse)
  if (!account) {
    throw new Error('Turnkey did not return an Ethereum wallet account')
  }

  return {
    turnkeyWalletId,
    turnkeyAccountId: account.turnkeyAccountId,
    address: account.address,
  }
}

export async function signUsdcAuthorization(
  signWith: string,
  typedData: TypedData | { [key: string]: unknown }
): Promise<Hex> {
  return turnkeySignTypedData(
    turnkeyClient,
    typedData,
    config.turnkeyOrganizationId,
    signWith
  )
}
