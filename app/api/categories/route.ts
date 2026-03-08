import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getAuthUser } from '@/lib/session'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await db.execute({
      sql: 'SELECT * FROM categories WHERE user_id = ? ORDER BY name ASC',
      args: [user.userId],
    })
    return NextResponse.json(result.rows)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { name } = await request.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Category name required' }, { status: 400 })
    }

    const result = await db.execute({
      sql: 'INSERT INTO categories (name, user_id) VALUES (?, ?)',
      args: [name.trim(), user.userId],
    })

    const categoryResult = await db.execute({
      sql: 'SELECT * FROM categories WHERE id = ?',
      args: [Number(result.lastInsertRowid)],
    })

    return NextResponse.json(categoryResult.rows[0], { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error && err.message?.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Category already exists' }, { status: 409 })
    }
    console.error(err)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}
