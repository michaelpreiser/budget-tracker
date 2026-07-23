'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Category, Transaction, BucketAssignment, UserSettings } from '@/types'

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const BUCKET_META = {
  needs: { label: 'Needs', color: '#3b82f6', text: 'text-blue-400', desc: 'Housing, utilities, groceries, essentials' },
  wants: { label: 'Wants', color: '#a855f7', text: 'text-purple-400', desc: 'Dining, entertainment, subscriptions' },
  savings: { label: 'Savings', color: '#10b981', text: 'text-emerald-400', desc: 'Tagged savings transactions' },
} as const

type BucketKey = keyof typeof BUCKET_META

interface Props {
  transactions: Transaction[]
  lastMonthTransactions: Transaction[]
  monthlyIncome: number
  categories: Category[]
}

export default function BudgetBuckets({ transactions, lastMonthTransactions, monthlyIncome, categories }: Props) {
  const [settings, setSettings] = useState<UserSettings>({
    needs_pct: 50, wants_pct: 30, savings_pct: 20, include_savings_in_discretionary: true,
  })
  const [assignments, setAssignments] = useState<Record<string, BucketKey>>({})
  const [pctInputs, setPctInputs] = useState({ needs: '50', wants: '30', savings: '20' })
  const [pctError, setPctError] = useState<string | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const fetchData = useCallback(async () => {
    const [sRes, aRes] = await Promise.all([
      fetch('/api/user-settings'),
      fetch('/api/bucket-assignments'),
    ])
    if (sRes.ok) {
      const s: UserSettings = await sRes.json()
      setSettings(s)
      setPctInputs({
        needs: String(s.needs_pct),
        wants: String(s.wants_pct),
        savings: String(s.savings_pct),
      })
    }
    if (aRes.ok) {
      const a: BucketAssignment[] = await aRes.json()
      const map: Record<string, BucketKey> = {}
      a.forEach((row) => { map[row.category] = row.bucket })
      setAssignments(map)
    }
    setLoaded(true)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const totalPct = (parseFloat(pctInputs.needs) || 0) + (parseFloat(pctInputs.wants) || 0) + (parseFloat(pctInputs.savings) || 0)
  const pctValid = Math.abs(totalPct - 100) < 0.01

  async function savePcts() {
    if (!pctValid) {
      setPctError(`Percentages add to ${totalPct.toFixed(1)}% — they must equal 100%`)
      return
    }
    setPctError(null)
    setSaving(true)
    const n = parseFloat(pctInputs.needs)
    const w = parseFloat(pctInputs.wants)
    const s = parseFloat(pctInputs.savings)
    await fetch('/api/user-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        needs_pct: n, wants_pct: w, savings_pct: s,
        include_savings_in_discretionary: settings.include_savings_in_discretionary,
      }),
    })
    setSettings((prev) => ({ ...prev, needs_pct: n, wants_pct: w, savings_pct: s }))
    setSaving(false)
  }

  async function assignCategory(category: string, bucket: BucketKey | '') {
    if (bucket === '') {
      await fetch('/api/bucket-assignments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      })
      setAssignments((prev) => { const next = { ...prev }; delete next[category]; return next })
    } else {
      await fetch('/api/bucket-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, bucket }),
      })
      setAssignments((prev) => ({ ...prev, [category]: bucket }))
    }
  }

  // ── Derived numbers ──
  const expTx = transactions.filter((t) => t.type === 'expense')
  const savTx = transactions.filter((t) => t.type === 'savings')
  const lastExpTx = lastMonthTransactions.filter((t) => t.type === 'expense')
  const lastSavTx = lastMonthTransactions.filter((t) => t.type === 'savings')

  function sumBucket(txs: Transaction[], b: BucketKey) {
    if (b === 'savings') return txs.filter((t) => t.type === 'savings').reduce((s, t) => s + t.amount, 0)
    return txs.filter((t) => t.type === 'expense' && assignments[t.category] === b).reduce((s, t) => s + t.amount, 0)
  }

  const actuals: Record<BucketKey, number> = {
    needs: sumBucket(transactions, 'needs'),
    wants: sumBucket(transactions, 'wants'),
    savings: sumBucket(transactions, 'savings'),
  }
  const lastActuals: Record<BucketKey, number> = {
    needs: sumBucket(lastMonthTransactions, 'needs'),
    wants: sumBucket(lastMonthTransactions, 'wants'),
    savings: sumBucket(lastMonthTransactions, 'savings'),
  }
  const targets: Record<BucketKey, number> = {
    needs: (settings.needs_pct / 100) * monthlyIncome,
    wants: (settings.wants_pct / 100) * monthlyIncome,
    savings: (settings.savings_pct / 100) * monthlyIncome,
  }

  // Category breakdown per needs/wants bucket
  const catBreakdown: Record<'needs' | 'wants', Record<string, number>> = { needs: {}, wants: {} }
  expTx.forEach((t) => {
    const b = assignments[t.category]
    if (b === 'needs' || b === 'wants') catBreakdown[b][t.category] = (catBreakdown[b][t.category] ?? 0) + t.amount
  })
  const savBreakdown: Record<string, number> = {}
  savTx.forEach((t) => { savBreakdown[t.category] = (savBreakdown[t.category] ?? 0) + t.amount })

  // Unassigned expense categories
  const unassigned = Array.from(new Set(expTx.filter((t) => !assignments[t.category]).map((t) => t.category)))

  if (!loaded) return null

  const buckets: BucketKey[] = ['needs', 'wants', 'savings']

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-slate-200 font-semibold text-base">50/30/20 Budget Buckets</h2>
          <p className="text-slate-600 text-xs mt-0.5">Allocate income across Needs, Wants, and Savings</p>
        </div>
        <button
          onClick={() => setShowConfig((v) => !v)}
          className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-colors ${
            showConfig
              ? 'border-blue-500/50 text-blue-400 bg-blue-500/10'
              : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
          }`}
        >
          {showConfig ? 'Done' : 'Configure Categories'}
        </button>
      </div>

      {/* Category assignment panel */}
      {showConfig && (
        <div className="mb-5 p-4 bg-slate-800/60 border border-slate-700 rounded-xl">
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">
            Assign each category to a bucket
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
            {categories.filter((c) => c.name !== 'Income').map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <span className="text-slate-300 text-xs flex-1 truncate">{c.name}</span>
                <select
                  value={assignments[c.name] ?? ''}
                  onChange={(e) => assignCategory(c.name, e.target.value as BucketKey | '')}
                  className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-blue-500 shrink-0"
                >
                  <option value="">— Unassigned</option>
                  <option value="needs">Needs</option>
                  <option value="wants">Wants</option>
                  <option value="savings">Savings</option>
                </select>
              </div>
            ))}
          </div>
          <p className="text-slate-600 text-xs mt-3">
            Assignments save instantly. The Savings bucket always reflects tagged Savings transactions regardless of category assignment.
          </p>
        </div>
      )}

      {/* Percentage inputs */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        {buckets.map((b) => (
          <div key={b} className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">{BUCKET_META[b].label}</label>
            <div className="flex items-center gap-1">
              <input
                type="number" min="0" max="100" step="0.1"
                value={pctInputs[b]}
                onChange={(e) => { setPctInputs((p) => ({ ...p, [b]: e.target.value })); setPctError(null) }}
                onBlur={savePcts}
                className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 text-sm text-center focus:outline-none focus:border-blue-500 transition"
              />
              <span className="text-slate-500 text-sm">%</span>
            </div>
          </div>
        ))}
        <div className="flex items-end gap-2 pb-1.5">
          <span className={`text-xs font-bold ${pctValid ? 'text-emerald-400' : 'text-red-400'}`}>
            = {totalPct.toFixed(1)}%
          </span>
          {saving && <span className="text-slate-600 text-xs italic">saving…</span>}
        </div>
      </div>
      {pctError && <p className="text-red-400 text-xs mb-3 -mt-2">{pctError}</p>}

      {/* Three bucket cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {buckets.map((b) => {
          const meta = BUCKET_META[b]
          const actual = actuals[b]
          const target = targets[b]
          const lastActual = lastActuals[b]
          const progress = target > 0 ? Math.min((actual / target) * 100, 100) : 0
          const isOver = b !== 'savings' && actual > target && target > 0
          const breakdown = b === 'needs' ? catBreakdown.needs : b === 'wants' ? catBreakdown.wants : savBreakdown

          return (
            <div
              key={b}
              className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50"
              style={{ borderTop: `3px solid ${meta.color}` }}
            >
              <div className="flex items-baseline justify-between mb-1">
                <span className={`text-xs font-bold uppercase tracking-wider ${meta.text}`}>
                  {meta.label}
                </span>
                <span className="text-slate-500 text-xs">
                  {b === 'needs' ? settings.needs_pct : b === 'wants' ? settings.wants_pct : settings.savings_pct}%
                </span>
              </div>
              <p className="text-slate-600 text-[10px] mb-2">{meta.desc}</p>

              {/* Target */}
              {monthlyIncome > 0 && (
                <p className="text-slate-500 text-xs mb-1">
                  Target <span className="text-slate-300 font-medium tabular-nums">${fmt(target)}</span>
                </p>
              )}

              {/* Actual */}
              <p className={`text-2xl font-bold tabular-nums ${isOver ? 'text-red-400' : meta.text}`}>
                ${fmt(actual)}
              </p>

              {/* Progress bar */}
              {target > 0 && (
                <div className="mt-2 mb-2">
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${progress}%`, backgroundColor: isOver ? '#ef4444' : meta.color }}
                    />
                  </div>
                  <p className="text-slate-600 text-[10px] mt-0.5 text-right tabular-nums">
                    {Math.round(progress)}%{isOver && <span className="text-red-400 ml-1">over</span>}
                  </p>
                </div>
              )}

              {/* Last month comparison */}
              {lastActual > 0 && (
                <p className="text-slate-600 text-xs">
                  Last mo: <span className="text-slate-500 tabular-nums">${fmt(lastActual)}</span>
                  {actual !== lastActual && (
                    <span className={`ml-1 tabular-nums ${actual > lastActual ? 'text-red-400' : 'text-emerald-400'}`}>
                      {actual > lastActual ? '▲' : '▼'}${fmt(Math.abs(actual - lastActual))}
                    </span>
                  )}
                </p>
              )}

              {/* Category breakdown */}
              {Object.keys(breakdown).length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-700/50 space-y-1">
                  {Object.entries(breakdown)
                    .sort((a, c) => c[1] - a[1])
                    .map(([cat, amt]) => (
                      <div key={cat} className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 truncate">{cat}</span>
                        <span className="text-slate-400 tabular-nums ml-2 shrink-0">${fmt(amt)}</span>
                      </div>
                    ))}
                </div>
              )}

              {/* Empty state for buckets */}
              {Object.keys(breakdown).length === 0 && b !== 'savings' && (
                <p className="text-slate-700 text-xs mt-3">No assigned categories with spending this month.</p>
              )}
              {Object.keys(breakdown).length === 0 && b === 'savings' && (
                <p className="text-slate-700 text-xs mt-3">No savings-tagged transactions this month.</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Unassigned categories warning */}
      {unassigned.length > 0 && (
        <p className="text-amber-500/70 text-xs mt-3">
          <span className="font-semibold">{unassigned.length}</span> categor{unassigned.length === 1 ? 'y' : 'ies'} with expenses not yet assigned to a bucket ({unassigned.join(', ')}).{' '}
          <button onClick={() => setShowConfig(true)} className="underline hover:text-amber-400 transition-colors">Configure</button>
        </p>
      )}
    </div>
  )
}
