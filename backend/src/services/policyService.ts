import { formatUnits } from 'viem'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db/schema'
import { config } from '../config'
import { getUsdcBalance, parseUsdcAmount } from './usdcService'
import { getWallet, WalletRow } from './walletService'

interface PolicyRow {
  id: string
  walletId: string
  expiresAt: number
  maxTransactions: number
  remainingTransactions: number
  maxAmountPerTxUsdc: string
  createdAt: number
}

interface AllowlistEntry {
  id: string
  policyId: string
  address: string
}

export interface AuthorizationRow {
  id: string
  walletId: string
  nonce: string
  toAddress: string
  amountUsdc: string
  validAfter: number
  validBefore: number
  gelatoTaskId: string | null
  status: string
  txHash: string | null
  createdAt: number
  updatedAt: number
}

export function createPolicy(
  walletId: string,
  expiresAt: number,
  maxTransactions: number,
  maxAmountPerTxUsdc: string,
  allowedRecipients: string[]
): string {
  const policyId = uuidv4()
  const createdAt = Date.now()

  const insertPolicy = db.prepare(
    'INSERT INTO policies (id, walletId, expiresAt, maxTransactions, remainingTransactions, maxAmountPerTxUsdc, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
  insertPolicy.run(
    policyId,
    walletId,
    expiresAt,
    maxTransactions,
    maxTransactions,
    maxAmountPerTxUsdc,
    createdAt
  )

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

  if (!policy) {
    return null
  }

  const allowlistStmt = db.prepare('SELECT * FROM allowlist_entries WHERE policyId = ?')
  const entries = allowlistStmt.all(policy.id) as AllowlistEntry[]

  return {
    ...policy,
    allowedRecipients: entries.map((entry) => entry.address),
  }
}

export async function validatePaymentRequest(
  walletId: string,
  to: string,
  amountUsdc: string
): Promise<
  | { valid: true; wallet: WalletRow; policy: PolicyRow & { allowedRecipients: string[] } }
  | { valid: false; error: string }
> {
  const wallet = getWallet(walletId)
  if (!wallet) {
    return { valid: false, error: 'Wallet not found' }
  }

  const policy = getActivePolicy(walletId)
  if (!policy) {
    return { valid: false, error: 'No active policy found for this wallet' }
  }

  if (policy.expiresAt <= Date.now()) {
    return { valid: false, error: 'Policy has expired' }
  }

  if (policy.remainingTransactions <= 0) {
    return { valid: false, error: 'No remaining transactions in policy' }
  }

  if (!policy.allowedRecipients.includes(to.toLowerCase())) {
    return { valid: false, error: `Recipient address ${to} is not in the allowlist` }
  }

  const requestedAmount = parseUsdcAmount(amountUsdc)
  const maxAllowed = parseUsdcAmount(policy.maxAmountPerTxUsdc)
  if (requestedAmount > maxAllowed) {
    return {
      valid: false,
      error: `Amount ${amountUsdc} USDC exceeds maximum per transaction limit of ${policy.maxAmountPerTxUsdc} USDC`,
    }
  }

  const balance = await getUsdcBalance(wallet.address as `0x${string}`)
  if (balance < requestedAmount) {
    return {
      valid: false,
      error: `Insufficient USDC balance. Have ${formatUnits(balance, config.usdcDecimals)} USDC, need ${amountUsdc} USDC`,
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

export function createAuthorizationRecord(input: {
  walletId: string
  nonce: string
  toAddress: string
  amountUsdc: string
  validAfter: number
  validBefore: number
  status: string
}): string {
  const id = uuidv4()
  const timestamp = Date.now()
  const stmt = db.prepare(
    'INSERT INTO authorizations (id, walletId, nonce, toAddress, amountUsdc, validAfter, validBefore, gelatoTaskId, status, txHash, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )

  stmt.run(
    id,
    input.walletId,
    input.nonce,
    input.toAddress,
    input.amountUsdc,
    input.validAfter,
    input.validBefore,
    null,
    input.status,
    null,
    timestamp,
    timestamp
  )

  return id
}

export function updateAuthorizationAfterSubmission(
  authorizationId: string,
  gelatoTaskId: string,
  status: string
): void {
  const stmt = db.prepare(
    'UPDATE authorizations SET gelatoTaskId = ?, status = ?, updatedAt = ? WHERE id = ?'
  )
  stmt.run(gelatoTaskId, status, Date.now(), authorizationId)
}

export function updateAuthorizationFinalState(
  authorizationId: string,
  status: string,
  txHash?: string
): void {
  const stmt = db.prepare(
    'UPDATE authorizations SET status = ?, txHash = ?, updatedAt = ? WHERE id = ?'
  )
  stmt.run(status, txHash || null, Date.now(), authorizationId)
}

export function recordTransaction(
  walletId: string,
  txHash: string,
  toAddress: string,
  amountUsdc: string
): string {
  const txId = uuidv4()
  const sentAt = Date.now()
  const stmt = db.prepare(
    'INSERT INTO transactions (id, walletId, txHash, toAddress, amountUsdc, sentAt) VALUES (?, ?, ?, ?, ?, ?)'
  )
  stmt.run(txId, walletId, txHash, toAddress, amountUsdc, sentAt)
  return txId
}

export function getTransactionHistory(
  walletId: string,
  limit: number = 10
): { txHash: string; toAddress: string; amountUsdc: string; sentAt: number; explorerUrl: string }[] {
  const stmt = db.prepare(
    'SELECT * FROM transactions WHERE walletId = ? ORDER BY sentAt DESC LIMIT ?'
  )
  const rows = stmt.all(walletId, limit) as {
    txHash: string
    toAddress: string
    amountUsdc: string
    sentAt: number
  }[]

  return rows.map((row) => ({
    txHash: row.txHash,
    toAddress: row.toAddress,
    amountUsdc: row.amountUsdc,
    sentAt: row.sentAt,
    explorerUrl: `https://sepolia.basescan.org/tx/${row.txHash}`,
  }))
}
