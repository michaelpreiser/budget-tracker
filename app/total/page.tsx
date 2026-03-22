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
  const [showExclusionPanel, setShowExclusionPanel] = useState(false)
  const [excludedFromIncome, setExcludedFromIncome] = useState<string[]>([])
  const [showIncomeExclusionPanel, setShowIncomeExclusionPanel] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  // Load excluded categories from localStorage (shared with main page)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('excludedFromExpenses')
      if (saved) setExcludedFromExpenses(JSON.parse(saved))
    } catch {}
  }, [])
  useEffect(() => {
    localStorage.setItem('excludedFromExpenses', JSON.stringify(excludedFromExpenses))
  }, [excludedFromExpenses])
  useEffect(() => {
    try {
      const saved = localStorage.getItem('excludedFromIncome')
      if (saved) setExcludedFromIncome(JSON.parse(saved))
    } catch {}
  }, [])
  useEffect(() => {
    localStorage.setItem('excludedFromIncome', JSON.stringify(excludedFromIncome))
  }, [excludedFromIncome])

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

  const incomeByCategory = transactions
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] ?? 0) + t.amount
      return acc
    }, {} as Record<string, number>)

  const allExpenseCategories = Object.keys(expenseByCategory).sort()
  const allIncomeCategories = Object.keys(incomeByCategory).sort()

  const excludedTotal = excludedFromExpenses.reduce(
    (s, cat) => s + (expenseByCategory[cat] ?? 0), 0
  )
  const adjustedExpenses = totalExpenses - excludedTotal
  const activeExclusions = excludedFromExpenses.filter((cat) => expenseByCategory[cat] > 0)

  const excludedIncomeTotal = excludedFromIncome.reduce(
    (s, cat) => s + (incomeByCategory[cat] ?? 0), 0
  )
  const adjustedIncome = totalIncome - excludedIncomeTotal
  const activeIncomeExclusions = excludedFromIncome.filter((cat) => incomeByCategory[cat] > 0)

  const net = adjustedIncome - adjustedExpenses
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
    const exclIncome = excludedFromIncome.reduce((s, cat) => {
      const catAmt = monthTx
        .filter((t) => t.type === 'income' && t.category === cat)
        .reduce((a, t) => a + t.amount, 0)
      return s + catAmt
    }, 0)
    const adjIncome = income - exclIncome
    const adjExpenses = expenses - excl
    return { name, income: adjIncome, expenses: adjExpenses, net: adjIncome - adjExpenses, hasData: monthTx.length > 0 }
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
                <div className="flex items-center justify-between mb-1">
                  <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Income</p>
                  <button
                    onClick={() => setShowIncomeExclusionPanel((v) => !v)}
                    title="Customize excluded income categories"
                    className={`text-xs px-2 py-0.5 rounded-lg border transition-colors ${
                      showIncomeExclusionPanel
                        ? 'border-blue-500/50 text-blue-400 bg-blue-500/10'
                        : 'border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {showIncomeExclusionPanel ? 'done' : 'edit'}
                  </button>
                </div>
                <p className="text-2xl font-bold tabular-nums leading-none text-emerald-400">
                  ${fmt(adjustedIncome)}
                </p>
                {!showIncomeExclusionPanel && activeIncomeExclusions.length > 0 && (
                  <p className="text-slate-600 text-xs mt-1.5 tabular-nums">
                    excl. ${fmt(excludedIncomeTotal)} in {activeIncomeExclusions.join(', ')}
                  </p>
                )}
                {showIncomeExclusionPanel && (
                  <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5">
                    <p className="text-slate-500 text-xs mb-2">Exclude from total:</p>
                    {allIncomeCategories.length === 0 ? (
                      <p className="text-slate-600 text-xs">No income this year.</p>
                    ) : (
                      allIncomeCategories.map((cat) => (
                        <label key={cat} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={excludedFromIncome.includes(cat)}
                            onChange={(e) =>
                              setExcludedFromIncome((prev) =>
                                e.target.checked ? [...prev, cat] : prev.filter((c) => c !== cat)
                              )
                            }
                            className="accent-blue-500"
                          />
                          <span className="text-slate-300 text-xs flex-1">{cat}</span>
                          <span className="text-slate-500 text-xs tabular-nums">
                            ${fmt(incomeByCategory[cat])}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Expenses */}
              <div className="bg-slate-900 border border-slate-700/50 rounded-2xl px-5 py-4 shadow-xl">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Expenses</p>
                  <button
                    onClick={() => setShowExclusionPanel((v) => !v)}
                    title="Customize excluded expense categories"
                    className={`text-xs px-2 py-0.5 rounded-lg border transition-colors ${
                      showExclusionPanel
                        ? 'border-blue-500/50 text-blue-400 bg-blue-500/10'
                        : 'border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {showExclusionPanel ? 'done' : 'edit'}
                  </button>
                </div>
                <p className="text-2xl font-bold tabular-nums leading-none text-red-400">
                  −${fmt(adjustedExpenses)}
                </p>
                {!showExclusionPanel && activeExclusions.length > 0 && (
                  <p className="text-slate-600 text-xs mt-1.5 tabular-nums">
                    excl. ${fmt(excludedTotal)} in {activeExclusions.join(', ')}
                  </p>
                )}
                {showExclusionPanel && (
                  <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5">
                    <p className="text-slate-500 text-xs mb-2">Exclude from total:</p>
                    {allExpenseCategories.length === 0 ? (
                      <p className="text-slate-600 text-xs">No expenses this year.</p>
                    ) : (
                      allExpenseCategories.map((cat) => (
                        <label key={cat} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={excludedFromExpenses.includes(cat)}
                            onChange={(e) =>
                              setExcludedFromExpenses((prev) =>
                                e.target.checked ? [...prev, cat] : prev.filter((c) => c !== cat)
                              )
                            }
                            className="accent-blue-500"
                          />
                          <span className="text-slate-300 text-xs flex-1">{cat}</span>
                          <span className="text-slate-500 text-xs tabular-nums">
                            ${fmt(expenseByCategory[cat])}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
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
                      <td className="px-5 py-3 text-right tabular-nums text-emerald-400 font-semibold">${fmt(adjustedIncome)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-red-400 font-semibold">−${fmt(adjustedExpenses)}</td>
                      <td className={`px-5 py-3 text-right tabular-nums font-semibold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isProfit ? '+' : '−'}${fmt(Math.abs(net))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Income by category */}
            {allIncomeCategories.length > 0 && (
              <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 shadow-xl">
                <h2 className="text-slate-200 font-semibold text-base mb-4">Income by Category</h2>
                <div className="space-y-3">
                  {Object.entries(incomeByCategory)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, amt]) => {
                      const pct = totalIncome > 0 ? (amt / totalIncome) * 100 : 0
                      const isExcluded = excludedFromIncome.includes(cat)
                      const key = `income-${cat}`
                      const isOpen = expandedCategory === key
                      const catTx = transactions
                        .filter((t) => t.type === 'income' && t.category === cat)
                        .sort((a, b) => b.date.localeCompare(a.date))
                      return (
                        <div key={cat}>
                          <button
                            onClick={() => setExpandedCategory(isOpen ? null : key)}
                            className="w-full flex justify-between items-baseline mb-1 group"
                          >
                            <span className={`text-sm truncate pr-2 group-hover:text-slate-100 transition-colors ${isExcluded ? 'text-slate-500' : 'text-slate-300'}`}>
                              {isOpen ? '▾' : '▸'} {cat}{isExcluded && <span className="text-slate-600 text-xs ml-1">(excluded)</span>}
                            </span>
                            <div className="flex items-baseline gap-1.5 flex-shrink-0">
                              <span className={`text-sm font-medium tabular-nums ${isExcluded ? 'text-slate-500' : 'text-emerald-400'}`}>
                                ${fmt(amt)}
                              </span>
                              <span className="text-slate-600 text-xs tabular-nums">{pct.toFixed(0)}%</span>
                            </div>
                          </button>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${isExcluded ? 'bg-slate-700' : 'bg-gradient-to-r from-emerald-700 to-emerald-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          {isOpen && (
                            <div className="mt-2 mb-1 rounded-xl bg-slate-800/60 divide-y divide-slate-700/50 overflow-hidden">
                              {catTx.map((t) => (
                                <div key={t.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                                  <span className="text-slate-500 w-[72px] flex-shrink-0 tabular-nums">{t.date}</span>
                                  <span className="flex-1 text-slate-400 truncate">{t.notes || '—'}</span>
                                  <span className="text-emerald-400 tabular-nums font-medium flex-shrink-0">${fmt(t.amount)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                </div>
              </div>
            )}

            {/* Category breakdown */}
            {categoryRows.length > 0 && (
              <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 shadow-xl">
                <h2 className="text-slate-200 font-semibold text-base mb-4">Spending by Category</h2>
                <div className="space-y-3">
                  {categoryRows.map(([cat, amt]) => {
                    const pct = totalExpenses > 0 ? (amt / totalExpenses) * 100 : 0
                    const isExcluded = excludedFromExpenses.includes(cat)
                    const key = `expense-${cat}`
                    const isOpen = expandedCategory === key
                    const catTx = transactions
                      .filter((t) => t.type === 'expense' && t.category === cat)
                      .sort((a, b) => b.date.localeCompare(a.date))
                    return (
                      <div key={cat}>
                        <button
                          onClick={() => setExpandedCategory(isOpen ? null : key)}
                          className="w-full flex justify-between items-baseline mb-1 group"
                        >
                          <span className={`text-sm truncate pr-2 group-hover:text-slate-100 transition-colors ${isExcluded ? 'text-slate-500' : 'text-slate-300'}`}>
                            {isOpen ? '▾' : '▸'} {cat}{isExcluded && <span className="text-slate-600 text-xs ml-1">(excluded)</span>}
                          </span>
                          <div className="flex items-baseline gap-1.5 flex-shrink-0">
                            <span className={`text-sm font-medium tabular-nums ${isExcluded ? 'text-slate-500' : 'text-red-400'}`}>
                              −${fmt(amt)}
                            </span>
                            <span className="text-slate-600 text-xs tabular-nums">{pct.toFixed(0)}%</span>
                          </div>
                        </button>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${isExcluded ? 'bg-slate-700' : 'bg-gradient-to-r from-blue-700 to-blue-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {isOpen && (
                          <div className="mt-2 mb-1 rounded-xl bg-slate-800/60 divide-y divide-slate-700/50 overflow-hidden">
                            {catTx.map((t) => (
                              <div key={t.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                                <span className="text-slate-500 w-[72px] flex-shrink-0 tabular-nums">{t.date}</span>
                                <span className="flex-1 text-slate-400 truncate">{t.notes || '—'}</span>
                                <span className="text-red-400 tabular-nums font-medium flex-shrink-0">${fmt(t.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
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
