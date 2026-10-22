import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { getAuthUser } from '@/lib/session'

export interface DuplicateTx {
  id: number
  date: string
  notes: string
  amount: number
  type: string
  category: string
  bucket_id: number | null
}

export interface DuplicateGroup {
  transactions: DuplicateTx[]
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ')
}

export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await db.execute({
      sql: 'SELECT id, date, notes, amount, type, category, bucket_id FROM transactions WHERE user_id = ? ORDER BY date ASC, id ASC',
      args: [user.userId],
    })

    const txs: DuplicateTx[] = result.rows.map((r) => ({
      id: Number(r.id),
      date: String(r.date),
      notes: String(r.notes ?? ''),
      amount: Number(r.amount),
      type: String(r.type),
      category: String(r.category),
      bucket_id: r.bucket_id != null ? Number(r.bucket_id) : null,
    }))

    // Union-find parent map
    const parent = new Map<number, number>()
    const find = (id: number): number => {
      if (!parent.has(id)) return id
      const root = find(parent.get(id)!)
      parent.set(id, root)
      return root
    }
    const union = (a: number, b: number) => {
      const ra = find(a), rb = find(b)
      if (ra !== rb) parent.set(ra, rb)
    }

    for (let i = 0; i < txs.length; i++) {
      for (let j = i + 1; j < txs.length; j++) {
        const a = txs[i], b = txs[j]

        // Same absolute amount
        if (Math.abs(Math.abs(a.amount) - Math.abs(b.amount)) >= 0.005) continue

        // Both must have a non-empty description
        const na = normalize(a.notes), nb = normalize(b.notes)
        if (!na || !nb) continue

        // Same description (normalized)
        if (na !== nb) continue

        // Date within 2 days
        const dayDiff = Math.abs(
          (new Date(a.date).getTime() - new Date(b.date).getTime()) / 86_400_000
        )
        if (dayDiff > 2) continue

        union(a.id, b.id)
      }
    }

    // Collect groups from union-find
    const groupMap = new Map<number, DuplicateTx[]>()
    for (const tx of txs) {
      const root = find(tx.id)
      if (!groupMap.has(root)) groupMap.set(root, [])
      groupMap.get(root)!.push(tx)
    }

    const groups: DuplicateGroup[] = []
    for (const members of Array.from(groupMap.values())) {
      if (members.length >= 2) {
        // Sort newest first within group
        members.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
        groups.push({ transactions: members })
      }
    }

    return NextResponse.json({ groups })
  } catch (err) {
    console.error('Duplicate scan error:', err)
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 })
  }
}
