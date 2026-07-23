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

  return NextResponse.json({ ok: true, steps })
}
