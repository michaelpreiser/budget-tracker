import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { getAuthUser } from '@/lib/session'

interface BulkTransaction {
  amount: number
  type: 'income' | 'expense' | 'savings'
  category: string
  notes: string
  date: string
  bucket_id?: number | null
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { transactions } = (await request.json()) as { transactions: BulkTransaction[] }

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: 'No transactions provided' }, { status: 400 })
    }

    await db.batch(
      transactions.map((t) => ({
        sql: 'INSERT INTO transactions (amount, type, category, notes, date, user_id, bucket_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [t.amount, t.type, t.category, t.notes ?? '', t.date, user.userId, t.bucket_id ?? null],
      })),
      'write'
    )

    return NextResponse.json({ inserted: transactions.length }, { status: 201 })
  } catch (err) {
    console.error('Bulk insert error:', err)
    return NextResponse.json({ error: 'Failed to insert transactions' }, { status: 500 })
  }
}
