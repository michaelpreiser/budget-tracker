import { createClient, Client } from '@libsql/client'
import bcrypt from 'bcryptjs'

export const DEFAULT_CATEGORIES = [
  'Income',
  'Rent/Mortgage',
  'Utilities',
  'Groceries',
  'Transportation',
  'Phone/Internet',
  'Gym',
  'Eating Out',
  'Supplements',
  'Clothing',
  'Entertainment',
  'Savings',
  'Health/Medical',
  'Education',
  'Other',
]

function getClient(): Client {
  if (!process.env.TURSO_DATABASE_URL) {
    throw new Error('TURSO_DATABASE_URL environment variable is not set')
  }
  return createClient({
    url: process.env.TURSO_DATABASE_URL.replace(/\s/g, ''),
    authToken: process.env.TURSO_AUTH_TOKEN?.replace(/\s/g, ''),
  })
}

/** Seed the default categories for a newly registered user. */
export async function seedCategories(db: Client, userId: number): Promise<void> {
  await db.batch(
    DEFAULT_CATEGORIES.map((name) => ({
      sql: 'INSERT OR IGNORE INTO categories (name, user_id) VALUES (?, ?)',
      args: [name, userId],
    })),
    'write'
  )
}

// ── Singleton ─────────────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __tursoDb: Client | undefined
}

const db: Client = global.__tursoDb ?? getClient()
if (process.env.NODE_ENV !== 'production') global.__tursoDb = db

export default db
