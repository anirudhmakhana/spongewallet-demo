import { createWalletClient, createPublicClient, http, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

const publicClient = createPublicClient({ chain: baseSepolia, transport: http() })

export async function sendPayment(
  decryptedPrivateKey: string,
  to: string,
  amountEth: string
): Promise<{ txHash: string; explorerUrl: string }> {
  const account = privateKeyToAccount(decryptedPrivateKey as `0x${string}`)

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  })

  const txHash = await walletClient.sendTransaction({
    to: to as `0x${string}`,
    value: parseEther(amountEth as `${number}`),
  })

  // Wait for transaction receipt to confirm it was included
  await publicClient.waitForTransactionReceipt({ hash: txHash })

  const explorerUrl = `https://sepolia.basescan.org/tx/${txHash}`

  return { txHash, explorerUrl }
}
