import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getAuthUser } from '@/lib/session'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await db.execute({
      sql: 'SELECT category, bucket FROM bucket_assignments WHERE user_id = ?',
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
    const { category, bucket } = await request.json()
    if (!category || !['needs', 'wants', 'savings'].includes(bucket)) {
      return NextResponse.json({ error: 'Invalid category or bucket' }, { status: 400 })
    }

    await db.execute({
      sql: `INSERT INTO bucket_assignments (user_id, category, bucket) VALUES (?, ?, ?)
            ON CONFLICT(user_id, category) DO UPDATE SET bucket = excluded.bucket`,
      args: [user.userId, category, bucket],
    })

    return NextResponse.json({ category, bucket })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to save assignment' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { category } = await request.json()
    await db.execute({
      sql: 'DELETE FROM bucket_assignments WHERE user_id = ? AND category = ?',
      args: [user.userId, category],
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 })
  }
}
