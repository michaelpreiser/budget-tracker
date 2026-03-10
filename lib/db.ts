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

const DEFAULT_RULES: Array<[string, string]> = [
  ['WALMART', 'Groceries'],
  ['KROGER', 'Groceries'],
  ['COSTCO', 'Groceries'],
  ['TRADER JOE', 'Groceries'],
  ['WHOLE FOODS', 'Groceries'],
  ['ALDI', 'Groceries'],
  ['PUBLIX', 'Groceries'],
  ['SAFEWAY', 'Groceries'],
  ['TARGET', 'Groceries'],
  ['AMAZON', 'Other'],
  ['NETFLIX', 'Entertainment'],
  ['SPOTIFY', 'Entertainment'],
  ['HULU', 'Entertainment'],
  ['DISNEY', 'Entertainment'],
  ['APPLE', 'Entertainment'],
  ['YOUTUBE', 'Entertainment'],
  ['SHELL', 'Transportation'],
  ['CHEVRON', 'Transportation'],
  ['EXXON', 'Transportation'],
  ['BP', 'Transportation'],
  ['SPEEDWAY', 'Transportation'],
  ['UBER', 'Transportation'],
  ['LYFT', 'Transportation'],
  ['DOORDASH', 'Eating Out'],
  ['GRUBHUB', 'Eating Out'],
  ['CHIPOTLE', 'Eating Out'],
  ['MCDONALD', 'Eating Out'],
  ['STARBUCKS', 'Eating Out'],
  ['SUBWAY', 'Eating Out'],
  ['CHICK', 'Eating Out'],
  ['AT&T', 'Phone/Internet'],
  ['VERIZON', 'Phone/Internet'],
  ['T-MOBILE', 'Phone/Internet'],
  ['COMCAST', 'Utilities'],
  ['SPECTRUM', 'Utilities'],
  ['XFINITY', 'Utilities'],
  ['CVS', 'Health/Medical'],
  ['WALGREENS', 'Health/Medical'],
  ['PLANET FITNESS', 'Gym'],
  ['LA FITNESS', 'Gym'],
]

/** Seed default category rules for a newly registered user. */
export async function seedCategoryRules(db: Client, userId: number): Promise<void> {
  await db.batch(
    DEFAULT_RULES.map(([keyword, category]) => ({
      sql: 'INSERT OR IGNORE INTO category_rules (user_id, keyword, category) VALUES (?, ?, ?)',
      args: [userId, keyword, category],
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
