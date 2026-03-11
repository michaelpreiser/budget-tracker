'use client'

import { useState } from 'react'
import type { Transaction } from '@/types'

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface Props {
  transactions: Transaction[]
}

export default function Dashboard({ transactions }: Props) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  // Tally by category
  const expMap: Record<string, number> = {}
  const incMap: Record<string, number> = {}

  for (const t of transactions) {
    if (t.type === 'expense') {
      expMap[t.category] = (expMap[t.category] ?? 0) + t.amount
    } else {
      incMap[t.category] = (incMap[t.category] ?? 0) + t.amount
    }
  }

  const totalExpenses = Object.values(expMap).reduce((s, v) => s + v, 0)

  const expenseCategories = Object.entries(expMap).sort((a, b) => b[1] - a[1])
  const incomeCategories = Object.entries(incMap).sort((a, b) => b[1] - a[1])

  if (expenseCategories.length === 0 && incomeCategories.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 shadow-xl">
        <h2 className="text-slate-200 font-semibold text-base mb-4">Category Breakdown</h2>
        <p className="text-slate-600 text-sm text-center py-6">No transactions this month.</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 shadow-xl space-y-5">
      <h2 className="text-slate-200 font-semibold text-base">Category Breakdown</h2>

      {/* Expenses */}
      {expenseCategories.length > 0 && (
        <div>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-3">
            Expenses
          </p>
          <div className="space-y-3">
            {expenseCategories.map(([cat, amt]) => {
              const pct = totalExpenses > 0 ? (amt / totalExpenses) * 100 : 0
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
                    <span className="text-slate-300 text-sm truncate pr-2 group-hover:text-slate-100 transition-colors">
                      {isOpen ? '▾' : '▸'} {cat}
                    </span>
                    <div className="flex items-baseline gap-1.5 flex-shrink-0">
                      <span className="text-red-400 text-sm font-medium tabular-nums">
                        −${fmt(amt)}
                      </span>
                      <span className="text-slate-600 text-xs tabular-nums">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </button>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-700 to-blue-500 transition-all duration-500"
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

      {/* Income breakdown (if multiple sources) */}
      {incomeCategories.length > 1 && (
        <div>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-3">
            Income Sources
          </p>
          <div className="space-y-2">
            {incomeCategories.map(([cat, amt]) => {
              const key = `income-${cat}`
              const isOpen = expandedCategory === key
              const catTx = transactions
                .filter((t) => t.type === 'income' && t.category === cat)
                .sort((a, b) => b.date.localeCompare(a.date))
              return (
                <div key={cat}>
                  <button
                    onClick={() => setExpandedCategory(isOpen ? null : key)}
                    className="w-full flex justify-between items-center group"
                  >
                    <span className="text-slate-300 text-sm truncate pr-2 group-hover:text-slate-100 transition-colors">
                      {isOpen ? '▾' : '▸'} {cat}
                    </span>
                    <span className="text-emerald-400 text-sm font-medium tabular-nums flex-shrink-0">
                      +${fmt(amt)}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="mt-2 rounded-xl bg-slate-800/60 divide-y divide-slate-700/50 overflow-hidden">
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
    </div>
  )
}
