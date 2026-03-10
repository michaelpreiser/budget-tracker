import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { getAuthUser } from '@/lib/session'

const ADMIN_USERNAME = 'Michael Preiser'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.username !== ADMIN_USERNAME) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const result = await db.execute({ sql: 'SELECT COUNT(*) as count FROM users', args: [] })
  const userCount = Number(result.rows[0].count)

  return NextResponse.json({ userCount })
}
