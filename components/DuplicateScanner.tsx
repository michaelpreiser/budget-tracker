'use client'

import { useState, useEffect, useCallback } from 'react'
import type { DuplicateGroup, DuplicateTx } from '@/app/api/transactions/duplicates/route'

interface Props {
  onClose: () => void
  onDeleted: () => void
}

function fmt(n: number) {
  return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const TYPE_COLORS: Record<string, string> = {
  income: 'text-emerald-400',
  expense: 'text-red-400',
  savings: 'text-blue-400',
}
const TYPE_LABELS: Record<string, string> = {
  income: '+ Income',
  expense: '− Expense',
  savings: '⇑ Savings',
}

export default function DuplicateScanner({ onClose, onDeleted }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())
  const [deleting, setDeleting] = useState<Set<number>>(new Set())
  const [deletedCount, setDeletedCount] = useState(0)
  const [keptCount, setKeptCount] = useState(0)
  const [anyDeleted, setAnyDeleted] = useState(false)

  const scan = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/transactions/duplicates')
      if (!res.ok) throw new Error('Scan failed')
      const data: { groups: DuplicateGroup[] } = await res.json()
      setGroups(data.groups)
      setDismissed(new Set())
      setDeletedCount(0)
      setKeptCount(0)
      setAnyDeleted(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { scan() }, [scan])

  async function deleteTx(id: number, groupIdx: number) {
    setDeleting((prev) => new Set(prev).add(id))
    try {
      await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
      setDeletedCount((c) => c + 1)
      setAnyDeleted(true)
      // Remove the deleted tx from its group; if only 1 remains, auto-dismiss the group
      setGroups((prev) =>
        prev.map((g, i) => {
          if (i !== groupIdx) return g
          return { transactions: g.transactions.filter((t) => t.id !== id) }
        })
      )
      // Auto-dismiss group if 1 or 0 remain
      setGroups((prev) => {
        const updated = [...prev]
        if ((updated[groupIdx]?.transactions.length ?? 0) <= 1) {
          setDismissed((d) => new Set(d).add(groupIdx))
        }
        return updated
      })
      onDeleted()
    } finally {
      setDeleting((prev) => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  function keepGroup(groupIdx: number) {
    setKeptCount((c) => c + 1)
    setDismissed((prev) => new Set(prev).add(groupIdx))
  }

  const activeGroups = groups.filter((_, i) => !dismissed.has(i))
  const totalGroups = groups.length
  const resolvedCount = dismissed.size

  // Done state: all groups resolved
  const allDone = totalGroups > 0 && resolvedCount >= totalGroups

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-slate-100 font-semibold text-base">Duplicate Transaction Scanner</h2>
            {!loading && !error && (
              <p className="text-slate-500 text-xs mt-0.5">
                {totalGroups === 0
                  ? 'No duplicates found'
                  : allDone
                  ? `All ${totalGroups} group${totalGroups !== 1 ? 's' : ''} reviewed`
                  : `${totalGroups} potential duplicate group${totalGroups !== 1 ? 's' : ''} · ${resolvedCount} of ${totalGroups} reviewed`}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 text-xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4 min-h-[200px]">

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-sm">Scanning all transactions…</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-red-950/40 border border-red-700/40 px-4 py-3 text-red-400 text-sm">
              {error}
              <button onClick={scan} className="ml-3 underline hover:no-underline">Retry</button>
            </div>
          )}

          {/* No duplicates */}
          {!loading && !error && totalGroups === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <span className="text-4xl">✅</span>
              <p className="text-slate-300 font-semibold">No duplicates found</p>
              <p className="text-slate-500 text-sm text-center">
                All transactions look unique based on date, amount, and description.
              </p>
            </div>
          )}

          {/* All done */}
          {!loading && allDone && (
            <div className="rounded-xl bg-emerald-950/40 border border-emerald-700/40 px-5 py-4 text-sm">
              <p className="text-emerald-400 font-semibold mb-1">Review complete</p>
              <p className="text-slate-400">
                {deletedCount > 0 && <><span className="text-red-400 font-semibold">{deletedCount}</span> deleted · </>}
                <span className="text-slate-300 font-semibold">{keptCount}</span> kept
                {anyDeleted && ' · Totals and budgets have been updated'}
              </p>
              <button
                onClick={scan}
                className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors underline"
              >
                Scan again
              </button>
            </div>
          )}

          {/* Duplicate groups */}
          {!loading && !error && groups.map((group, groupIdx) => {
            if (dismissed.has(groupIdx)) return null
            return (
              <DuplicateGroupCard
                key={groupIdx}
                group={group}
                onDelete={(id) => deleteTx(id, groupIdx)}
                onKeep={() => keepGroup(groupIdx)}
                deleting={deleting}
              />
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex justify-between items-center">
          <button
            onClick={scan}
            disabled={loading}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-40"
          >
            Rescan
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function DuplicateGroupCard({
  group,
  onDelete,
  onKeep,
  deleting,
}: {
  group: DuplicateGroup
  onDelete: (id: number) => Promise<void>
  onKeep: () => void
  deleting: Set<number>
}) {
  return (
    <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 overflow-hidden">
      {/* Group header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-amber-950/40 border-b border-amber-800/30">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-xs font-semibold">⚠ Possible duplicate</span>
          <span className="text-slate-500 text-xs">{group.transactions.length} transactions</span>
        </div>
        <button
          onClick={onKeep}
          className="text-xs px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors font-semibold"
        >
          Keep all
        </button>
      </div>

      {/* Transactions */}
      <div className="divide-y divide-amber-900/30">
        {group.transactions.map((tx) => (
          <TxRow key={tx.id} tx={tx} onDelete={() => onDelete(tx.id)} isDeleting={deleting.has(tx.id)} />
        ))}
      </div>
    </div>
  )
}

function TxRow({
  tx,
  onDelete,
  isDeleting,
}: {
  tx: DuplicateTx
  onDelete: () => void
  isDeleting: boolean
}) {
  const [confirming, setConfirming] = useState(false)

  function handleDelete() {
    if (!confirming) { setConfirming(true); return }
    onDelete()
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 text-xs">
      <div className="shrink-0 w-[90px] text-slate-400">{fmtDate(tx.date)}</div>
      <div className="shrink-0 w-20">
        <span className={`font-semibold ${TYPE_COLORS[tx.type] ?? 'text-slate-400'}`}>
          {TYPE_LABELS[tx.type] ?? tx.type}
        </span>
      </div>
      <div className="flex-1 min-w-0 text-slate-300 truncate" title={tx.notes}>
        {tx.notes || <span className="text-slate-600 italic">no description</span>}
      </div>
      <div className="shrink-0 w-20 text-right tabular-nums font-semibold text-slate-200">
        {tx.amount < 0 ? '−' : ''}${fmt(tx.amount)}
      </div>
      <div className="shrink-0 w-24 text-slate-500 truncate text-right">{tx.category}</div>
      <div className="shrink-0 ml-1">
        {confirming ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setConfirming(false)}
              className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-2 py-0.5 rounded bg-red-700 hover:bg-red-600 text-white font-semibold transition-colors disabled:opacity-50"
            >
              {isDeleting ? '…' : 'Confirm'}
            </button>
          </div>
        ) : (
          <button
            onClick={handleDelete}
            className="px-2 py-0.5 rounded bg-red-900/50 text-red-400 hover:bg-red-800/60 hover:text-red-300 transition-colors font-semibold"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
}
