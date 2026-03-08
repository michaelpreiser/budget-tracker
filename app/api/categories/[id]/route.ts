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

    const { name } = await request.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const oldResult = await db.execute({
      sql: 'SELECT name FROM categories WHERE id = ? AND user_id = ?',
      args: [id, user.userId],
    })
    const oldRow = oldResult.rows[0]
    if (!oldRow) return NextResponse.json({ error: 'Category not found' }, { status: 404 })

    await db.batch(
      [
        { sql: 'UPDATE categories SET name = ? WHERE id = ? AND user_id = ?', args: [name.trim(), id, user.userId] },
        { sql: 'UPDATE transactions SET category = ? WHERE category = ? AND user_id = ?', args: [name.trim(), oldRow.name, user.userId] },
        { sql: 'UPDATE budgets SET category = ? WHERE category = ? AND user_id = ?', args: [name.trim(), oldRow.name, user.userId] },
      ],
      'write'
    )

    return NextResponse.json({ id, name: name.trim() })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update category'
    const isDupe = msg.includes('UNIQUE')
    return NextResponse.json(
      { error: isDupe ? 'A category with that name already exists.' : msg },
      { status: 400 }
    )
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
      sql: 'DELETE FROM categories WHERE id = ? AND user_id = ?',
      args: [id, user.userId],
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}
