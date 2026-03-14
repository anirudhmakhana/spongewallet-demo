import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(__dirname, '../../spongewallet.db')

export const db = new Database(DB_PATH)

export function initDb(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wallets (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      encryptedPrivateKey TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      walletId TEXT NOT NULL,
      keyHash TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY(walletId) REFERENCES wallets(id)
    );

    CREATE TABLE IF NOT EXISTS policies (
      id TEXT PRIMARY KEY,
      walletId TEXT NOT NULL,
      expiresAt INTEGER NOT NULL,
      maxTransactions INTEGER NOT NULL,
      remainingTransactions INTEGER NOT NULL,
      maxAmountPerTxEth TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY(walletId) REFERENCES wallets(id)
    );

    CREATE TABLE IF NOT EXISTS allowlist_entries (
      id TEXT PRIMARY KEY,
      policyId TEXT NOT NULL,
      address TEXT NOT NULL,
      FOREIGN KEY(policyId) REFERENCES policies(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      walletId TEXT NOT NULL,
      txHash TEXT NOT NULL,
      toAddress TEXT NOT NULL,
      amountEth TEXT NOT NULL,
      sentAt INTEGER NOT NULL,
      FOREIGN KEY(walletId) REFERENCES wallets(id)
    );
  `)

  console.log('Database initialized')
}
