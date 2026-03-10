'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Transaction } from '@/types'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function TotalPage() {
  const router = useRouter()
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [excludedFromExpenses, setExcludedFromExpenses] = useState<string[]>(['Investing'])

  // Load excluded categories from localStorage (shared with main page)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('excludedFromExpenses')
      if (saved) setExcludedFromExpenses(JSON.parse(saved))
    } catch {}
  }, [])

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    const r = await fetch(`/api/transactions?year=${year}`)
    if (r.status === 401) { router.push('/login'); return }
    if (r.ok) setTransactions(await r.json())
    setLoading(false)
  }, [year, router])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])

  // ── derived data ──────────────────────────────────────────────────────────

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0)

  const totalExpenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0)

  const expenseByCategory = transactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] ?? 0) + t.amount
      return acc
    }, {} as Record<string, number>)

  const excludedTotal = excludedFromExpenses.reduce(
    (s, cat) => s + (expenseByCategory[cat] ?? 0), 0
  )
  const adjustedExpenses = totalExpenses - excludedTotal
  const activeExclusions = excludedFromExpenses.filter((cat) => expenseByCategory[cat] > 0)
  const net = totalIncome - adjustedExpenses
  const isProfit = net >= 0

  // Monthly breakdown
  const monthlyData = MONTHS.map((name, i) => {
    const mm = String(i + 1).padStart(2, '0')
    const key = `${year}-${mm}`
    const monthTx = transactions.filter((t) => t.date.startsWith(key))
    const income = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expenses = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const excl = excludedFromExpenses.reduce((s, cat) => {
      const catAmt = monthTx
        .filter((t) => t.type === 'expense' && t.category === cat)
        .reduce((a, t) => a + t.amount, 0)
      return s + catAmt
    }, 0)
    const adjExpenses = expenses - excl
    return { name, income, expenses: adjExpenses, net: income - adjExpenses, hasData: monthTx.length > 0 }
  })

  // Category breakdown sorted by amount
  const categoryRows = Object.entries(expenseByCategory)
    .sort((a, b) => b[1] - a[1])

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <button
            onClick={() => router.push('/')}
            className="text-slate-400 hover:text-slate-200 transition-colors text-sm flex items-center gap-1.5"
          >
            ← Dashboard
          </button>

          {/* Year navigator */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setYear((y) => y - 1)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              ‹
            </button>
            <span className="text-slate-200 font-semibold text-sm min-w-[60px] text-center">
              {year}
            </span>
            <button
              onClick={() => setYear((y) => y + 1)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              ›
            </button>
          </div>

          <h1 className="text-slate-100 font-bold text-base">Yearly Total</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4">
              {/* Income */}
              <div className="bg-slate-900 border border-slate-700/50 rounded-2xl px-5 py-4 shadow-xl">
                <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Income</p>
                <p className="text-2xl font-bold tabular-nums leading-none text-emerald-400">
                  ${fmt(totalIncome)}
                </p>
              </div>

              {/* Expenses */}
              <div className="bg-slate-900 border border-slate-700/50 rounded-2xl px-5 py-4 shadow-xl">
                <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Expenses</p>
                <p className="text-2xl font-bold tabular-nums leading-none text-red-400">
                  −${fmt(adjustedExpenses)}
                </p>
                {activeExclusions.length > 0 && (
                  <p className="text-slate-600 text-xs mt-1.5 tabular-nums">
                    excl. ${fmt(excludedTotal)} in {activeExclusions.join(', ')}
                  </p>
                )}
              </div>

              {/* Net */}
              <div className="bg-slate-900 border border-slate-700/50 rounded-2xl px-5 py-4 shadow-xl">
                <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">
                  Net {isProfit ? 'Profit' : 'Loss'}
                </p>
                <p className={`text-2xl font-bold tabular-nums leading-none ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isProfit ? '+' : '−'}${fmt(Math.abs(net))}
                </p>
              </div>
            </div>

            {/* Monthly breakdown */}
            <div className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800">
                <h2 className="text-slate-200 font-semibold text-base">Monthly Breakdown</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left text-slate-500 text-xs font-medium uppercase tracking-wider px-5 py-3">Month</th>
                      <th className="text-right text-slate-500 text-xs font-medium uppercase tracking-wider px-5 py-3">Income</th>
                      <th className="text-right text-slate-500 text-xs font-medium uppercase tracking-wider px-5 py-3">Expenses</th>
                      <th className="text-right text-slate-500 text-xs font-medium uppercase tracking-wider px-5 py-3">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map(({ name, income, expenses, net: mNet, hasData }) => (
                      <tr
                        key={name}
                        className={`border-b border-slate-800/50 last:border-0 ${hasData ? '' : 'opacity-30'}`}
                      >
                        <td className="px-5 py-3 text-slate-300">{name}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-emerald-400">
                          {income > 0 ? `$${fmt(income)}` : '—'}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-red-400">
                          {expenses > 0 ? `−$${fmt(expenses)}` : '—'}
                        </td>
                        <td className={`px-5 py-3 text-right tabular-nums font-medium ${
                          !hasData ? 'text-slate-500' : mNet >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {hasData ? `${mNet >= 0 ? '+' : '−'}$${fmt(Math.abs(mNet))}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-700 bg-slate-800/30">
                      <td className="px-5 py-3 text-slate-300 font-semibold">Total</td>
                      <td className="px-5 py-3 text-right tabular-nums text-emerald-400 font-semibold">${fmt(totalIncome)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-red-400 font-semibold">−${fmt(adjustedExpenses)}</td>
                      <td className={`px-5 py-3 text-right tabular-nums font-semibold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isProfit ? '+' : '−'}${fmt(Math.abs(net))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Category breakdown */}
            {categoryRows.length > 0 && (
              <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 shadow-xl">
                <h2 className="text-slate-200 font-semibold text-base mb-4">Spending by Category</h2>
                <div className="space-y-3">
                  {categoryRows.map(([cat, amt]) => {
                    const pct = totalExpenses > 0 ? (amt / totalExpenses) * 100 : 0
                    const isExcluded = excludedFromExpenses.includes(cat)
                    return (
                      <div key={cat}>
                        <div className="flex justify-between items-baseline mb-1">
                          <span className={`text-sm truncate pr-2 ${isExcluded ? 'text-slate-500' : 'text-slate-300'}`}>
                            {cat}{isExcluded && <span className="text-slate-600 text-xs ml-1">(excluded)</span>}
                          </span>
                          <div className="flex items-baseline gap-1.5 flex-shrink-0">
                            <span className={`text-sm font-medium tabular-nums ${isExcluded ? 'text-slate-500' : 'text-red-400'}`}>
                              −${fmt(amt)}
                            </span>
                            <span className="text-slate-600 text-xs tabular-nums">{pct.toFixed(0)}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${isExcluded ? 'bg-slate-700' : 'bg-gradient-to-r from-blue-700 to-blue-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {transactions.length === 0 && (
              <div className="text-center py-16 text-slate-600">No transactions found for {year}.</div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
