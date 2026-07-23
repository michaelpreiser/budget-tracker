import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getAuthUser } from '@/lib/session'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await db.execute({
      sql: 'SELECT * FROM savings_buckets WHERE user_id = ? ORDER BY created_at ASC',
      args: [user.userId],
    })
    return NextResponse.json(result.rows)
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { name, goal_amount, starting_balance } = await request.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    const result = await db.execute({
      sql: 'INSERT INTO savings_buckets (user_id, name, goal_amount, starting_balance) VALUES (?, ?, ?, ?)',
      args: [user.userId, name.trim(), goal_amount ?? null, starting_balance ?? 0],
    })

    const row = await db.execute({
      sql: 'SELECT * FROM savings_buckets WHERE id = ?',
      args: [Number(result.lastInsertRowid)],
    })

    return NextResponse.json(row.rows[0], { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create bucket' }, { status: 500 })
  }
}
