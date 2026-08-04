import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getAuthUser } from '@/lib/session'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const result = await db.execute({
      sql: 'SELECT id, name, pct FROM savings_suballocations WHERE user_id = ? ORDER BY sort_order, id',
      args: [user.userId],
    })
    return NextResponse.json(result.rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      pct: Number(r.pct),
    })))
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { name, pct } = await request.json()
    const result = await db.execute({
      sql: 'INSERT INTO savings_suballocations (user_id, name, pct) VALUES (?, ?, ?)',
      args: [user.userId, name, pct],
    })
    return NextResponse.json({ id: Number(result.lastInsertRowid), name, pct }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id, name, pct } = await request.json()
    await db.execute({
      sql: 'UPDATE savings_suballocations SET name = ?, pct = ? WHERE id = ? AND user_id = ?',
      args: [name, pct, id, user.userId],
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await request.json()
    await db.execute({
      sql: 'DELETE FROM savings_suballocations WHERE id = ? AND user_id = ?',
      args: [id, user.userId],
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
