import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(__dirname, '../../spongewallet.db')
const SCHEMA_VERSION = 3

export const db = new Database(DB_PATH)

function recreateSchema(): void {
  db.exec(`
    PRAGMA foreign_keys = OFF;

    DROP TABLE IF EXISTS authorizations;
    DROP TABLE IF EXISTS transactions;
    DROP TABLE IF EXISTS allowlist_entries;
    DROP TABLE IF EXISTS policies;
    DROP TABLE IF EXISTS api_keys;
    DROP TABLE IF EXISTS wallets;

    CREATE TABLE wallets (
      id TEXT PRIMARY KEY,
      ownerAddress TEXT NOT NULL,
      smartAccountAddress TEXT NOT NULL,
      turnkeyWalletId TEXT NOT NULL,
      turnkeyAccountId TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE api_keys (
      id TEXT PRIMARY KEY,
      walletId TEXT NOT NULL,
      keyHash TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY(walletId) REFERENCES wallets(id)
    );

    CREATE TABLE policies (
      id TEXT PRIMARY KEY,
      walletId TEXT NOT NULL,
      expiresAt INTEGER NOT NULL,
      maxTransactions INTEGER NOT NULL,
      remainingTransactions INTEGER NOT NULL,
      maxAmountPerTxUsdc TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY(walletId) REFERENCES wallets(id)
    );

    CREATE TABLE allowlist_entries (
      id TEXT PRIMARY KEY,
      policyId TEXT NOT NULL,
      address TEXT NOT NULL,
      FOREIGN KEY(policyId) REFERENCES policies(id)
    );

    CREATE TABLE transactions (
      id TEXT PRIMARY KEY,
      walletId TEXT NOT NULL,
      userOpHash TEXT NOT NULL,
      txHash TEXT,
      toAddress TEXT NOT NULL,
      amountUsdc TEXT NOT NULL,
      status TEXT NOT NULL,
      sentAt INTEGER NOT NULL,
      FOREIGN KEY(walletId) REFERENCES wallets(id)
    );

    PRAGMA user_version = 3;
    PRAGMA foreign_keys = ON;
  `)
}

export function initDb(): void {
  const version = db.pragma('user_version', { simple: true }) as number

  if (version !== SCHEMA_VERSION) {
    recreateSchema()
  } else {
    db.pragma('foreign_keys = ON')
  }

  console.log('Database initialized')
}
