import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { getAuthUser } from '@/lib/session'

export async function POST() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const steps: string[] = []

  // 1. Add bucket_id column to transactions (idempotent via try/catch)
  try {
    await db.execute({ sql: 'ALTER TABLE transactions ADD COLUMN bucket_id INTEGER', args: [] })
    steps.push('Added bucket_id column to transactions')
  } catch {
    steps.push('bucket_id column already exists — skipped')
  }

  // 1b. Widen the type CHECK constraint to include 'savings' (requires table reconstruction)
  try {
    const schemaResult = await db.execute({
      sql: "SELECT sql FROM sqlite_master WHERE type='table' AND name='transactions'",
      args: [],
    })
    const schemaSql = String(schemaResult.rows[0]?.sql ?? '')
    if (!schemaSql.includes("'savings'") && !schemaSql.includes('"savings"')) {
      await db.batch([
        {
          sql: `CREATE TABLE transactions_new (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            amount    REAL    NOT NULL,
            type      TEXT    NOT NULL CHECK(type IN ('income','expense','savings')),
            category  TEXT    NOT NULL,
            notes     TEXT    NOT NULL DEFAULT '',
            date      TEXT    NOT NULL,
            user_id   INTEGER NOT NULL REFERENCES users(id),
            bucket_id INTEGER
          )`,
          args: [],
        },
        {
          sql: 'INSERT INTO transactions_new SELECT id, amount, type, category, notes, date, user_id, bucket_id FROM transactions',
          args: [],
        },
        { sql: 'DROP TABLE transactions', args: [] },
        { sql: 'ALTER TABLE transactions_new RENAME TO transactions', args: [] },
      ], 'write')
      steps.push('Widened transactions type constraint to include savings')
    } else {
      steps.push('transactions type constraint already supports savings — skipped')
    }
  } catch (e) {
    steps.push(`type constraint update failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  // 2. savings_buckets table
  await db.execute({
    sql: `CREATE TABLE IF NOT EXISTS savings_buckets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      goal_amount REAL,
      starting_balance REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    args: [],
  })
  steps.push('savings_buckets table ready')

  // 3. bucket_assignments table (category → needs/wants/savings)
  await db.execute({
    sql: `CREATE TABLE IF NOT EXISTS bucket_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      bucket TEXT NOT NULL,
      UNIQUE(user_id, category)
    )`,
    args: [],
  })
  steps.push('bucket_assignments table ready')

  // 4. user_settings table (adjustable 50/30/20 percentages)
  await db.execute({
    sql: `CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      needs_pct REAL NOT NULL DEFAULT 50,
      wants_pct REAL NOT NULL DEFAULT 30,
      savings_pct REAL NOT NULL DEFAULT 20,
      include_savings_in_discretionary INTEGER NOT NULL DEFAULT 1
    )`,
    args: [],
  })
  steps.push('user_settings table ready')

  // 5. Seed user_settings for this user if missing
  await db.execute({
    sql: `INSERT OR IGNORE INTO user_settings
            (user_id, needs_pct, wants_pct, savings_pct, include_savings_in_discretionary)
          VALUES (?, 50, 30, 20, 1)`,
    args: [user.userId],
  })
  steps.push('user_settings seeded')

  // 6. Savings sub-allocations table
  await db.execute({
    sql: `CREATE TABLE IF NOT EXISTS savings_suballocations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      name       TEXT    NOT NULL,
      pct        REAL    NOT NULL DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    )`,
    args: [],
  })
  steps.push('savings_suballocations table ready')

  return NextResponse.json({ ok: true, steps })
}
