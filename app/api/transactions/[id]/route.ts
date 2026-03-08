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

    const { amount, type, category, notes, date } = await request.json()
    if (!amount || !type || !category || !date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const updateResult = await db.execute({
      sql: 'UPDATE transactions SET amount=?, type=?, category=?, notes=?, date=? WHERE id=? AND user_id=?',
      args: [Number(amount), type, category, notes ?? '', date, id, user.userId],
    })

    if (updateResult.rowsAffected === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const txResult = await db.execute({
      sql: 'SELECT * FROM transactions WHERE id = ?',
      args: [id],
    })

    return NextResponse.json(txResult.rows[0])
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 })
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
      sql: 'DELETE FROM transactions WHERE id = ? AND user_id = ?',
      args: [id, user.userId],
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 })
  }
}
