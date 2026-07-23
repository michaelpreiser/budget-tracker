import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getAuthUser } from '@/lib/session'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const id = parseInt(params.id)
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const { name, goal_amount, starting_balance } = await request.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    const r = await db.execute({
      sql: 'UPDATE savings_buckets SET name=?, goal_amount=?, starting_balance=? WHERE id=? AND user_id=?',
      args: [name.trim(), goal_amount ?? null, starting_balance ?? 0, id, user.userId],
    })
    if (r.rowsAffected === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const row = await db.execute({
      sql: 'SELECT * FROM savings_buckets WHERE id = ?',
      args: [id],
    })
    return NextResponse.json(row.rows[0])
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update bucket' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const id = parseInt(params.id)
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    await db.execute({
      sql: 'DELETE FROM savings_buckets WHERE id = ? AND user_id = ?',
      args: [id, user.userId],
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete bucket' }, { status: 500 })
  }
}
