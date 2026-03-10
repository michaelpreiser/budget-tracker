import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getAuthUser } from '@/lib/session'

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    const result = month
      ? await db.execute({
          sql: `SELECT * FROM transactions
                WHERE user_id = ? AND strftime('%Y-%m', date) = ?
                ORDER BY date DESC, id DESC`,
          args: [user.userId, month],
        })
      : year
      ? await db.execute({
          sql: `SELECT * FROM transactions
                WHERE user_id = ? AND strftime('%Y', date) = ?
                ORDER BY date ASC, id ASC`,
          args: [user.userId, year],
        })
      : await db.execute({
          sql: 'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC',
          args: [user.userId],
        })

    return NextResponse.json(result.rows)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { amount, type, category, notes, date } = await request.json()
    if (!amount || !type || !category || !date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const insertResult = await db.execute({
      sql: 'INSERT INTO transactions (amount, type, category, notes, date, user_id) VALUES (?, ?, ?, ?, ?, ?)',
      args: [Number(amount), type, category, notes ?? '', date, user.userId],
    })

    const txResult = await db.execute({
      sql: 'SELECT * FROM transactions WHERE id = ?',
      args: [Number(insertResult.lastInsertRowid)],
    })

    return NextResponse.json(txResult.rows[0], { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
  }
}
