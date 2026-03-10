import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getAuthUser } from '@/lib/session'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  const { category } = await request.json()
  if (!category?.trim()) return NextResponse.json({ error: 'category required' }, { status: 400 })

  await db.execute({
    sql: 'UPDATE category_rules SET category = ? WHERE id = ? AND user_id = ?',
    args: [category.trim(), id, user.userId],
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  await db.execute({
    sql: 'DELETE FROM category_rules WHERE id = ? AND user_id = ?',
    args: [id, user.userId],
  })
  return NextResponse.json({ ok: true })
}
