import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getAuthUser } from '@/lib/session'
import { extractKeyword } from '@/lib/categorization'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await db.execute({
    sql: 'SELECT * FROM category_rules WHERE user_id = ? ORDER BY match_count DESC, keyword ASC',
    args: [user.userId],
  })
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { description, category, keyword: providedKeyword } = await request.json()
  if (!category) return NextResponse.json({ error: 'category required' }, { status: 400 })

  const keyword = (providedKeyword ?? (description ? extractKeyword(description) : null))
  if (!keyword?.trim()) return NextResponse.json({ error: 'keyword or description required' }, { status: 400 })

  const kw = keyword.trim().toUpperCase()

  // Upsert: update category + bump match_count if keyword already exists
  await db.execute({
    sql: `INSERT INTO category_rules (user_id, keyword, category, match_count)
          VALUES (?, ?, ?, 1)
          ON CONFLICT(user_id, keyword) DO UPDATE SET
            category = excluded.category,
            match_count = match_count + 1`,
    args: [user.userId, kw, category],
  })

  const result = await db.execute({
    sql: 'SELECT * FROM category_rules WHERE user_id = ? AND keyword = ?',
    args: [user.userId, kw],
  })
  return NextResponse.json(result.rows[0])
}
