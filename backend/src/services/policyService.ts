import { createPublicClient, http, parseEther, formatEther } from 'viem'
import { baseSepolia } from 'viem/chains'
import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcryptjs'
import { db } from '../db/schema'
import { getWallet } from './walletService'

const publicClient = createPublicClient({ chain: baseSepolia, transport: http() })

interface PolicyRow {
  id: string
  walletId: string
  expiresAt: number
  maxTransactions: number
  remainingTransactions: number
  maxAmountPerTxEth: string
  createdAt: number
}

interface AllowlistEntry {
  id: string
  policyId: string
  address: string
}

interface ApiKeyRow {
  id: string
  walletId: string
  keyHash: string
  createdAt: number
}

interface WalletRow {
  id: string
  address: string
  encryptedPrivateKey: string
  createdAt: number
}

export function createPolicy(
  walletId: string,
  expiresAt: number,
  maxTransactions: number,
  maxAmountPerTxEth: string,
  allowedRecipients: string[]
): string {
  const policyId = uuidv4()
  const createdAt = Date.now()

  const insertPolicy = db.prepare(
    'INSERT INTO policies (id, walletId, expiresAt, maxTransactions, remainingTransactions, maxAmountPerTxEth, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
  insertPolicy.run(policyId, walletId, expiresAt, maxTransactions, maxTransactions, maxAmountPerTxEth, createdAt)

  const insertAllowlist = db.prepare(
    'INSERT INTO allowlist_entries (id, policyId, address) VALUES (?, ?, ?)'
  )
  for (const address of allowedRecipients) {
    insertAllowlist.run(uuidv4(), policyId, address.toLowerCase())
  }

  return policyId
}

export function getActivePolicy(walletId: string): (PolicyRow & { allowedRecipients: string[] }) | null {
  const stmt = db.prepare(
    'SELECT * FROM policies WHERE walletId = ? ORDER BY createdAt DESC LIMIT 1'
  )
  const policy = stmt.get(walletId) as PolicyRow | undefined

  if (!policy) return null

  const allowlistStmt = db.prepare('SELECT * FROM allowlist_entries WHERE policyId = ?')
  const entries = allowlistStmt.all(policy.id) as AllowlistEntry[]
  const allowedRecipients = entries.map((e) => e.address)

  return { ...policy, allowedRecipients }
}

export async function validatePaymentRequest(
  apiKey: string,
  walletId: string,
  to: string,
  amountEth: string
): Promise<
  | { valid: true; wallet: WalletRow; policy: PolicyRow & { allowedRecipients: string[] } }
  | { valid: false; error: string }
> {
  // Step 1: authenticate api key
  const apiKeyStmt = db.prepare('SELECT * FROM api_keys WHERE walletId = ?')
  const apiKeyRows = apiKeyStmt.all(walletId) as ApiKeyRow[]

  let matchedApiKey: ApiKeyRow | null = null
  for (const row of apiKeyRows) {
    const matches = await bcrypt.compare(apiKey, row.keyHash)
    if (matches) {
      matchedApiKey = row
      break
    }
  }

  if (!matchedApiKey) {
    return { valid: false, error: 'Invalid API key' }
  }

  // Step 2: load wallet + active policy
  const wallet = getWallet(walletId)
  if (!wallet) {
    return { valid: false, error: 'Wallet not found' }
  }

  const policy = getActivePolicy(walletId)
  if (!policy) {
    return { valid: false, error: 'No active policy found for this wallet' }
  }

  // Step 3: check expiresAt > Date.now()
  if (policy.expiresAt <= Date.now()) {
    return { valid: false, error: 'Policy has expired' }
  }

  // Step 4: check remainingTransactions > 0
  if (policy.remainingTransactions <= 0) {
    return { valid: false, error: 'No remaining transactions in policy' }
  }

  // Step 5: check toAddress in allowlist
  const toNormalized = to.toLowerCase()
  const isAllowed = policy.allowedRecipients.includes(toNormalized)
  if (!isAllowed) {
    return { valid: false, error: `Recipient address ${to} is not in the allowlist` }
  }

  // Step 6: check amountEth <= maxAmountPerTxEth
  const amountWei = parseEther(amountEth as `${number}`)
  const maxAmountWei = parseEther(policy.maxAmountPerTxEth as `${number}`)
  if (amountWei > maxAmountWei) {
    return {
      valid: false,
      error: `Amount ${amountEth} ETH exceeds maximum per transaction limit of ${policy.maxAmountPerTxEth} ETH`,
    }
  }

  // Step 7: check wallet ETH balance >= amountEth + estimated gas
  const balance = await publicClient.getBalance({ address: wallet.address as `0x${string}` })
  const estimatedGas = parseEther('0.0005') // ~0.0005 ETH for gas buffer
  if (balance < amountWei + estimatedGas) {
    return {
      valid: false,
      error: `Insufficient balance. Have ${formatEther(balance)} ETH, need ${amountEth} ETH + gas`,
    }
  }

  return { valid: true, wallet, policy }
}

export function decrementRemainingTransactions(policyId: string): number {
  const stmt = db.prepare(
    'UPDATE policies SET remainingTransactions = remainingTransactions - 1 WHERE id = ? RETURNING remainingTransactions'
  )
  const result = stmt.get(policyId) as { remainingTransactions: number } | undefined
  return result?.remainingTransactions ?? 0
}

export function recordTransaction(
  walletId: string,
  txHash: string,
  toAddress: string,
  amountEth: string
): string {
  const txId = uuidv4()
  const sentAt = Date.now()
  const stmt = db.prepare(
    'INSERT INTO transactions (id, walletId, txHash, toAddress, amountEth, sentAt) VALUES (?, ?, ?, ?, ?, ?)'
  )
  stmt.run(txId, walletId, txHash, toAddress, amountEth, sentAt)
  return txId
}

export function getTransactionHistory(
  walletId: string,
  limit: number = 10
): { txHash: string; toAddress: string; amountEth: string; sentAt: number; explorerUrl: string }[] {
  const stmt = db.prepare(
    'SELECT * FROM transactions WHERE walletId = ? ORDER BY sentAt DESC LIMIT ?'
  )
  const rows = stmt.all(walletId, limit) as {
    id: string
    walletId: string
    txHash: string
    toAddress: string
    amountEth: string
    sentAt: number
  }[]

  return rows.map((row) => ({
    txHash: row.txHash,
    toAddress: row.toAddress,
    amountEth: row.amountEth,
    sentAt: row.sentAt,
    explorerUrl: `https://sepolia.basescan.org/tx/${row.txHash}`,
  }))
}
