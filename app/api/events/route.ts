import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getAuthUser } from '@/lib/session'

async function ensureTables() {
  await db.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        target_date TEXT NOT NULL,
        target_amount REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS event_deposits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS event_expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      args: [],
    },
  ], 'write')
}

export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureTables()

  const [events, deposits, expenses] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM events WHERE user_id = ? ORDER BY target_date ASC', args: [user.userId] }),
    db.execute({ sql: 'SELECT * FROM event_deposits WHERE user_id = ? ORDER BY date DESC', args: [user.userId] }),
    db.execute({ sql: 'SELECT * FROM event_expenses WHERE user_id = ? ORDER BY date DESC', args: [user.userId] }),
  ])

  return NextResponse.json({
    events: events.rows,
    deposits: deposits.rows,
    expenses: expenses.rows,
  })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureTables()

  const { name, description, target_date, target_amount } = await request.json()
  if (!name || !target_date || !target_amount) {
    return NextResponse.json({ error: 'name, target_date, and target_amount are required' }, { status: 400 })
  }

  const result = await db.execute({
    sql: 'INSERT INTO events (user_id, name, description, target_date, target_amount) VALUES (?, ?, ?, ?, ?)',
    args: [user.userId, name, description ?? null, target_date, target_amount],
  })

  const row = await db.execute({
    sql: 'SELECT * FROM events WHERE id = ?',
    args: [Number(result.lastInsertRowid)],
  })

  return NextResponse.json(row.rows[0])
}
