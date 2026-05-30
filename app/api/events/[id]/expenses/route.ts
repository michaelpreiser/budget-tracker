import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getAuthUser } from '@/lib/session'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const eventId = Number(params.id)
  const { amount, date, description } = await request.json()
  if (!amount || !date) {
    return NextResponse.json({ error: 'amount and date are required' }, { status: 400 })
  }

  const result = await db.execute({
    sql: 'INSERT INTO event_expenses (event_id, user_id, amount, date, description) VALUES (?, ?, ?, ?, ?)',
    args: [eventId, user.userId, amount, date, description ?? null],
  })

  const row = await db.execute({
    sql: 'SELECT * FROM event_expenses WHERE id = ?',
    args: [Number(result.lastInsertRowid)],
  })

  return NextResponse.json(row.rows[0])
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { expenseId } = await request.json()

  await db.execute({
    sql: 'DELETE FROM event_expenses WHERE id = ? AND event_id = ? AND user_id = ?',
    args: [expenseId, Number(params.id), user.userId],
  })

  return NextResponse.json({ ok: true })
}
