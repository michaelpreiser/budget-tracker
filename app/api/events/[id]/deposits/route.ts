import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getAuthUser } from '@/lib/session'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const eventId = Number(params.id)
  const { amount, date, note } = await request.json()
  if (!amount || !date) {
    return NextResponse.json({ error: 'amount and date are required' }, { status: 400 })
  }

  const result = await db.execute({
    sql: 'INSERT INTO event_deposits (event_id, user_id, amount, date, note) VALUES (?, ?, ?, ?, ?)',
    args: [eventId, user.userId, amount, date, note ?? null],
  })

  const row = await db.execute({
    sql: 'SELECT * FROM event_deposits WHERE id = ?',
    args: [Number(result.lastInsertRowid)],
  })

  return NextResponse.json(row.rows[0])
}
