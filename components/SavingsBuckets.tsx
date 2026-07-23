'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Transaction, SavingsBucket } from '@/types'

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface Props {
  transactions: Transaction[]
  lastMonthTransactions: Transaction[]
  monthlyIncome: number
}

export default function SavingsBuckets({ transactions, lastMonthTransactions, monthlyIncome }: Props) {
  const [buckets, setBuckets] = useState<SavingsBucket[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addGoal, setAddGoal] = useState('')
  const [addStart, setAddStart] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editGoal, setEditGoal] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const savTx = transactions.filter((t) => t.type === 'savings')
  const lastSavTx = lastMonthTransactions.filter((t) => t.type === 'savings')
  const totalThisMonth = savTx.reduce((s, t) => s + t.amount, 0)
  const totalLastMonth = lastSavTx.reduce((s, t) => s + t.amount, 0)
  const savingsRate = monthlyIncome > 0 ? (totalThisMonth / monthlyIncome) * 100 : 0

  const fetchBuckets = useCallback(async () => {
    const r = await fetch('/api/savings-buckets')
    if (r.ok) setBuckets(await r.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchBuckets() }, [fetchBuckets])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!addName.trim()) return
    setAddSaving(true)
    await fetch('/api/savings-buckets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: addName.trim(),
        goal_amount: addGoal ? parseFloat(addGoal) : null,
        starting_balance: addStart ? parseFloat(addStart) : 0,
      }),
    })
    await fetchBuckets()
    setAddSaving(false)
    setShowAdd(false)
    setAddName(''); setAddGoal(''); setAddStart('')
  }

  function startEdit(b: SavingsBucket) {
    setEditingId(b.id)
    setEditName(b.name)
    setEditGoal(b.goal_amount != null ? String(b.goal_amount) : '')
    setEditStart(b.starting_balance > 0 ? String(b.starting_balance) : '')
  }

  async function handleEdit(id: number) {
    setEditSaving(true)
    await fetch(`/api/savings-buckets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editName.trim(),
        goal_amount: editGoal ? parseFloat(editGoal) : null,
        starting_balance: editStart ? parseFloat(editStart) : 0,
      }),
    })
    await fetchBuckets()
    setEditSaving(false)
    setEditingId(null)
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this savings bucket? Transactions assigned to it will keep their data but lose the bucket link.')) return
    await fetch(`/api/savings-buckets/${id}`, { method: 'DELETE' })
    await fetchBuckets()
  }

  if (loading) return null

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-slate-200 font-semibold text-base">Savings Accounts</h2>
          <p className="text-slate-600 text-xs mt-0.5">HYSA, brokerage, and goal-based buckets</p>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors ${
            showAdd
              ? 'bg-slate-700 text-slate-300'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          {showAdd ? '× Cancel' : '+ Add Bucket'}
        </button>
      </div>

      {/* Savings rate summary bar */}
      {(totalThisMonth > 0 || totalLastMonth > 0) && (
        <div className="mt-3 mb-4 flex flex-wrap gap-5 p-3 bg-emerald-950/30 border border-emerald-800/30 rounded-xl">
          <div>
            <p className="text-slate-500 text-xs">Saved this month</p>
            <p className="text-emerald-400 font-bold tabular-nums text-lg">${fmt(totalThisMonth)}</p>
          </div>
          {totalLastMonth > 0 && (
            <div>
              <p className="text-slate-500 text-xs">Last month</p>
              <p className="text-slate-300 font-semibold tabular-nums">${fmt(totalLastMonth)}</p>
            </div>
          )}
          {monthlyIncome > 0 && (
            <div>
              <p className="text-slate-500 text-xs">Savings rate</p>
              <p className={`font-bold text-lg tabular-nums ${savingsRate >= 20 ? 'text-emerald-400' : savingsRate >= 10 ? 'text-amber-400' : 'text-slate-400'}`}>
                {savingsRate.toFixed(1)}%
              </p>
            </div>
          )}
        </div>
      )}

      {/* Add bucket form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="mb-4 p-4 bg-slate-800/60 border border-slate-700 rounded-xl space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Bucket name *</label>
              <input
                type="text" value={addName} onChange={(e) => setAddName(e.target.value)}
                placeholder="e.g. Emergency Fund"
                required autoFocus
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Starting balance (money already saved)</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input
                  type="number" value={addStart} onChange={(e) => setAddStart(e.target.value)}
                  placeholder="0.00" min="0" step="0.01"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-6 pr-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Goal amount (optional)</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input
                  type="number" value={addGoal} onChange={(e) => setAddGoal(e.target.value)}
                  placeholder="e.g. 10,000" min="0" step="0.01"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-6 pr-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
          <button
            type="submit" disabled={addSaving || !addName.trim()}
            className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
          >
            {addSaving ? 'Adding…' : 'Add Bucket'}
          </button>
        </form>
      )}

      {/* Bucket cards */}
      {buckets.length === 0 && !showAdd ? (
        <p className="text-slate-600 text-sm text-center py-6">
          No savings buckets yet. Add one to track specific goals like an Emergency Fund or Vacation Fund.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {buckets.map((b) => {
            const contributed = savTx.filter((t) => t.bucket_id === b.id).reduce((s, t) => s + t.amount, 0)
            const lastContributed = lastSavTx.filter((t) => t.bucket_id === b.id).reduce((s, t) => s + t.amount, 0)
            const total = b.starting_balance + contributed
            const goal = b.goal_amount
            const progress = goal && goal > 0 ? Math.min((total / goal) * 100, 100) : null
            const remaining = goal ? Math.max(goal - total, 0) : null

            if (editingId === b.id) {
              return (
                <div key={b.id} className="bg-slate-800/60 rounded-xl p-4 border border-blue-500/40 space-y-2">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Name</label>
                    <input
                      type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Starting balance</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                        <input type="number" value={editStart} onChange={(e) => setEditStart(e.target.value)}
                          placeholder="0" min="0" step="0.01"
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-5 pr-2 py-1.5 text-slate-100 text-xs focus:outline-none focus:border-blue-500" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Goal (optional)</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                        <input type="number" value={editGoal} onChange={(e) => setEditGoal(e.target.value)}
                          placeholder="none" min="0" step="0.01"
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-5 pr-2 py-1.5 text-slate-100 text-xs focus:outline-none focus:border-blue-500" />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingId(null)} className="flex-1 py-1.5 text-xs text-slate-400 border border-slate-600 hover:border-slate-500 rounded-lg transition-colors">Cancel</button>
                    <button onClick={() => handleEdit(b.id)} disabled={editSaving || !editName.trim()} className="flex-1 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors">
                      {editSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              )
            }

            return (
              <div key={b.id} className="group bg-slate-800/60 rounded-xl p-4 border border-slate-700/50 relative">
                <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(b)} className="text-slate-600 hover:text-blue-400 text-sm transition-colors" title="Edit">✎</button>
                  <button onClick={() => handleDelete(b.id)} className="text-slate-600 hover:text-red-400 text-xl leading-none transition-colors" title="Delete">×</button>
                </div>

                <p className="text-slate-200 font-semibold text-sm pr-12 truncate">{b.name}</p>

                <p className="text-2xl font-bold text-emerald-400 tabular-nums mt-1">${fmt(total)}</p>
                {b.starting_balance > 0 && (
                  <p className="text-slate-600 text-xs tabular-nums">
                    ${fmt(b.starting_balance)} starting + ${fmt(contributed)} added
                  </p>
                )}

                {/* Monthly contributions */}
                <div className="mt-2 flex gap-4 text-xs">
                  <div>
                    <p className="text-slate-500">This month</p>
                    <p className={`font-semibold tabular-nums ${contributed > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                      +${fmt(contributed)}
                    </p>
                  </div>
                  {lastContributed > 0 && (
                    <div>
                      <p className="text-slate-500">Last month</p>
                      <p className="text-slate-400 tabular-nums">+${fmt(lastContributed)}</p>
                    </div>
                  )}
                </div>

                {/* Goal progress */}
                {goal != null && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Goal ${fmt(goal)}</span>
                      {remaining !== null && remaining > 0 && (
                        <span className="text-slate-600">${fmt(remaining)} to go</span>
                      )}
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${progress ?? 0}%`,
                          backgroundColor: (progress ?? 0) >= 100 ? '#10b981' : (progress ?? 0) > 60 ? '#3b82f6' : '#64748b',
                        }}
                      />
                    </div>
                    <p className="text-right text-[10px] text-slate-600 mt-0.5 tabular-nums">{Math.round(progress ?? 0)}%</p>
                    {(progress ?? 0) >= 100 && (
                      <p className="text-emerald-400 text-xs font-semibold mt-0.5 text-center">Goal reached!</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Note about unassigned savings transactions */}
      {savTx.some((t) => !t.bucket_id) && buckets.length > 0 && (
        <p className="text-slate-600 text-xs mt-3">
          Some savings transactions this month are not assigned to a specific bucket — edit them in the Transaction Log to assign.
        </p>
      )}
    </div>
  )
}
