import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getAuthUser } from '@/lib/session'

const DEFAULTS = { needs_pct: 50, wants_pct: 30, savings_pct: 20, include_savings_in_discretionary: true }

export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await db.execute({
      sql: `INSERT OR IGNORE INTO user_settings
              (user_id, needs_pct, wants_pct, savings_pct, include_savings_in_discretionary)
            VALUES (?, 50, 30, 20, 1)`,
      args: [user.userId],
    })

    const result = await db.execute({
      sql: 'SELECT * FROM user_settings WHERE user_id = ?',
      args: [user.userId],
    })

    const row = result.rows[0]
    return NextResponse.json({
      needs_pct: Number(row.needs_pct),
      wants_pct: Number(row.wants_pct),
      savings_pct: Number(row.savings_pct),
      include_savings_in_discretionary: Number(row.include_savings_in_discretionary) === 1,
    })
  } catch {
    return NextResponse.json(DEFAULTS)
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()

    // Fetch existing to merge (supports partial updates)
    await db.execute({
      sql: `INSERT OR IGNORE INTO user_settings (user_id, needs_pct, wants_pct, savings_pct, include_savings_in_discretionary) VALUES (?, 50, 30, 20, 1)`,
      args: [user.userId],
    })
    const existing = (await db.execute({ sql: 'SELECT * FROM user_settings WHERE user_id = ?', args: [user.userId] })).rows[0]

    const needs_pct = body.needs_pct ?? Number(existing.needs_pct)
    const wants_pct = body.wants_pct ?? Number(existing.wants_pct)
    const savings_pct = body.savings_pct ?? Number(existing.savings_pct)
    const include = body.include_savings_in_discretionary !== undefined
      ? body.include_savings_in_discretionary
      : Number(existing.include_savings_in_discretionary) === 1

    await db.execute({
      sql: `UPDATE user_settings SET needs_pct=?, wants_pct=?, savings_pct=?, include_savings_in_discretionary=? WHERE user_id=?`,
      args: [needs_pct, wants_pct, savings_pct, include ? 1 : 0, user.userId],
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
