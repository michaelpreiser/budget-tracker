'use client'

import type { Transaction } from '@/types'

interface Props {
  transactions: Transaction[]
}

export default function Dashboard({ transactions }: Props) {
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
              return (
                <div key={cat}>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-slate-300 text-sm truncate pr-2">{cat}</span>
                    <div className="flex items-baseline gap-1.5 flex-shrink-0">
                      <span className="text-red-400 text-sm font-medium tabular-nums">
                        −${amt.toFixed(2)}
                      </span>
                      <span className="text-slate-600 text-xs tabular-nums">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-700 to-blue-500 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
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
            {incomeCategories.map(([cat, amt]) => (
              <div key={cat} className="flex justify-between items-center">
                <span className="text-slate-300 text-sm truncate pr-2">{cat}</span>
                <span className="text-emerald-400 text-sm font-medium tabular-nums flex-shrink-0">
                  +${amt.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
