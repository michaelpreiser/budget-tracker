import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getAuthUser } from '@/lib/session'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await db.execute({
      sql: 'SELECT * FROM budgets WHERE user_id = ?',
      args: [user.userId],
    })
    return NextResponse.json(result.rows)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { category, amount, percentage, input_mode, is_goal } = await request.json()
    if (!category) return NextResponse.json({ error: 'Category required' }, { status: 400 })

    await db.execute({
      sql: `INSERT INTO budgets (category, amount, percentage, input_mode, is_goal, user_id)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(category, user_id) DO UPDATE SET
              amount     = excluded.amount,
              percentage = excluded.percentage,
              input_mode = excluded.input_mode,
              is_goal    = excluded.is_goal`,
      args: [category, amount ?? null, percentage ?? null, input_mode ?? 'amount', is_goal ? 1 : 0, user.userId],
    })

    const budgetResult = await db.execute({
      sql: 'SELECT * FROM budgets WHERE category = ? AND user_id = ?',
      args: [category, user.userId],
    })
    return NextResponse.json(budgetResult.rows[0])
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to save budget' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { category } = await request.json()
    await db.execute({
      sql: 'DELETE FROM budgets WHERE category = ? AND user_id = ?',
      args: [category, user.userId],
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete budget' }, { status: 500 })
  }
}
