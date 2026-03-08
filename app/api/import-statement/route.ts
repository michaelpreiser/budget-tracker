import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getAuthUser } from '@/lib/session'

export interface CheckTransaction {
  date: string
  amount: number
  type: 'income' | 'expense'
  description: string
}

export interface CheckedTransaction extends CheckTransaction {
  isDuplicate: boolean
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { transactions } = (await request.json()) as { transactions: CheckTransaction[] }

    const results: CheckedTransaction[] = await Promise.all(
      transactions.map(async (t) => {
        const result = await db.execute({
          sql: `SELECT COUNT(*) as c FROM transactions
                WHERE user_id = ? AND date = ? AND ABS(amount - ?) < 0.005 AND type = ?`,
          args: [user.userId, t.date, t.amount, t.type],
        })
        const count = Number(result.rows[0].c)
        return { ...t, isDuplicate: count > 0 }
      })
    )

    return NextResponse.json(results)
  } catch (err) {
    console.error('Duplicate check error:', err)
    return NextResponse.json({ error: 'Failed to check duplicates' }, { status: 500 })
  }
}
