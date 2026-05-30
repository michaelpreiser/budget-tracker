import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getAuthUser } from '@/lib/session'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number(params.id)
  const { name, description, target_date, target_amount } = await request.json()

  await db.execute({
    sql: `UPDATE events SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      target_date = COALESCE(?, target_date),
      target_amount = COALESCE(?, target_amount)
    WHERE id = ? AND user_id = ?`,
    args: [name ?? null, description ?? null, target_date ?? null, target_amount ?? null, id, user.userId],
  })

  const result = await db.execute({
    sql: 'SELECT * FROM events WHERE id = ? AND user_id = ?',
    args: [id, user.userId],
  })

  return NextResponse.json(result.rows[0])
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number(params.id)

  await db.batch([
    { sql: 'DELETE FROM event_expenses WHERE event_id = ? AND user_id = ?', args: [id, user.userId] },
    { sql: 'DELETE FROM event_deposits WHERE event_id = ? AND user_id = ?', args: [id, user.userId] },
    { sql: 'DELETE FROM events WHERE id = ? AND user_id = ?', args: [id, user.userId] },
  ], 'write')

  return NextResponse.json({ ok: true })
}
