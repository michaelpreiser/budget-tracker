'use client'

import { useState, useEffect } from 'react'
import type { Budget, Category, Transaction } from '@/types'

interface Props {
  categories: Category[]
  budgets: Budget[]
  transactions: Transaction[]
  monthlyIncome: number
  onSave: (b: Budget) => Promise<void>
  onDelete: (category: string) => Promise<void>
}

interface RowState {
  value: string
  mode: 'amount' | 'percentage'
  isGoal: boolean
  dirty: boolean
  saving: boolean
}

function calcAmount(state: RowState, income: number): number | null {
  const v = parseFloat(state.value)
  if (!state.value || isNaN(v) || v <= 0) return null
  if (state.mode === 'amount') return v
  if (income > 0) return (v / 100) * income
  return null
}

function calcPct(state: RowState, income: number): number | null {
  const v = parseFloat(state.value)
  if (!state.value || isNaN(v) || v <= 0) return null
  if (state.mode === 'percentage') return v
  if (income > 0) return (v / income) * 100
  return null
}

const EMPTY_ROW: RowState = { value: '', mode: 'amount', isGoal: false, dirty: false, saving: false }

export default function BudgetTargets({
  categories,
  budgets,
  transactions,
  monthlyIncome,
  onSave,
  onDelete,
}: Props) {
  const [rows, setRows] = useState<Record<string, RowState>>({})

  // Add form state
  const [showAdd, setShowAdd] = useState(false)
  const [addCategory, setAddCategory] = useState('')
  const [addIsGoal, setAddIsGoal] = useState(false)
  const [addMode, setAddMode] = useState<'amount' | 'percentage'>('amount')
  const [addValue, setAddValue] = useState('')
  const [addSaving, setAddSaving] = useState(false)

  useEffect(() => {
    setRows((prev) => {
      const next = { ...prev }
      for (const b of budgets) {
        if (!next[b.category]?.dirty) {
          next[b.category] = {
            value:
              b.input_mode === 'amount'
                ? (b.amount?.toString() ?? '')
                : (b.percentage?.toString() ?? ''),
            mode: b.input_mode,
            isGoal: !!b.is_goal,
            dirty: false,
            saving: false,
          }
        }
      }
      return next
    })
  }, [budgets])

  // Spend maps
  const spendMap: Record<string, number> = {}
  const contributedMap: Record<string, number> = {}
  for (const t of transactions) {
    if (t.type === 'expense') spendMap[t.category] = (spendMap[t.category] ?? 0) + t.amount
    contributedMap[t.category] = (contributedMap[t.category] ?? 0) + t.amount
  }

  function getRow(cat: string): RowState {
    return rows[cat] ?? EMPTY_ROW
  }

  function update(cat: string, patch: Partial<RowState>) {
    setRows((prev) => {
      const current = prev[cat] ?? EMPTY_ROW
      return { ...prev, [cat]: { ...current, ...patch } }
    })
  }

  async function save(cat: string, overrides?: Partial<RowState>) {
    const state = { ...getRow(cat), ...overrides }
    const amount = calcAmount(state, monthlyIncome)
    const percentage = calcPct(state, monthlyIncome)
    update(cat, { saving: true, dirty: false, ...overrides })
    await onSave({ category: cat, amount: amount ?? null, percentage: percentage ?? null, input_mode: state.mode, is_goal: state.isGoal })
    update(cat, { saving: false })
  }

  function toggleMode(cat: string) {
    const state = getRow(cat)
    const newMode = state.mode === 'amount' ? 'percentage' : 'amount'
    const v = parseFloat(state.value)
    let newValue = ''
    if (!isNaN(v) && v > 0) {
      if (newMode === 'percentage' && monthlyIncome > 0) newValue = ((v / monthlyIncome) * 100).toFixed(1)
      else if (newMode === 'amount' && monthlyIncome > 0) newValue = ((v / 100) * monthlyIncome).toFixed(2)
    }
    update(cat, { mode: newMode, value: newValue, dirty: true })
  }

  async function toggleGoal(cat: string) {
    const newIsGoal = !getRow(cat).isGoal
    update(cat, { isGoal: newIsGoal, dirty: false })
    await save(cat, { isGoal: newIsGoal })
  }

  async function handleDelete(cat: string) {
    if (!confirm(`Remove the budget/goal for "${cat}"?`)) return
    await onDelete(cat)
    setRows((prev) => {
      const next = { ...prev }
      delete next[cat]
      return next
    })
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!addCategory || !addValue) return
    setAddSaving(true)
    const v = parseFloat(addValue)
    const amount = addMode === 'amount' ? v : (monthlyIncome > 0 ? (v / 100) * monthlyIncome : null)
    const percentage = addMode === 'percentage' ? v : (monthlyIncome > 0 ? (v / monthlyIncome) * 100 : null)
    await onSave({ category: addCategory, amount: amount ?? null, percentage: percentage ?? null, input_mode: addMode, is_goal: addIsGoal })
    setAddSaving(false)
    setShowAdd(false)
    setAddCategory('')
    setAddValue('')
    setAddIsGoal(false)
    setAddMode('amount')
  }

  // Categories that already have a saved budget/goal
  const budgetedNames = new Set(budgets.map((b) => b.category))

  // Only show rows with a saved budget
  const activeCategories = categories.filter(
    (c) => c.name !== 'Income' && budgetedNames.has(c.name)
  )

  // Available to add
  const availableToAdd = categories.filter(
    (c) => c.name !== 'Income' && !budgetedNames.has(c.name)
  )

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-slate-200 font-semibold text-base">Budget Targets & Goals</h2>
          {activeCategories.length > 0 && (
            <p className="text-slate-600 text-xs mt-0.5">
              Click <strong className="text-slate-500">$/%</strong> to toggle mode ·{' '}
              <strong className="text-slate-500">B/G</strong> to switch between Budget and Goal · auto-saves on blur
            </p>
          )}
        </div>
        {availableToAdd.length > 0 && (
          <button
            onClick={() => { setShowAdd((v) => !v); setAddCategory(availableToAdd[0]?.name ?? '') }}
            className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-xl transition-colors ${
              showAdd
                ? 'bg-slate-700 text-slate-300'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            <span className="text-base leading-none">{showAdd ? '×' : '+'}</span>
            {showAdd ? 'Cancel' : 'Add Budget / Goal'}
          </button>
        )}
      </div>

      {/* ── Add form ── */}
      {showAdd && availableToAdd.length > 0 && (
        <form
          onSubmit={handleAdd}
          className="mb-4 flex flex-wrap items-end gap-3 p-4 bg-slate-800/60 border border-slate-700 rounded-xl"
        >
          {/* Category */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium">Category</label>
            <select
              value={addCategory}
              onChange={(e) => setAddCategory(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-2 text-slate-100 text-sm focus:outline-none focus:border-blue-500"
            >
              {availableToAdd.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Budget / Goal toggle */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium">Type</label>
            <div className="flex rounded-lg overflow-hidden border border-slate-600">
              <button
                type="button"
                onClick={() => setAddIsGoal(false)}
                className={`px-3 py-2 text-sm font-semibold transition-colors ${
                  !addIsGoal ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                Budget
              </button>
              <button
                type="button"
                onClick={() => setAddIsGoal(true)}
                className={`px-3 py-2 text-sm font-semibold transition-colors ${
                  addIsGoal ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                Goal
              </button>
            </div>
          </div>

          {/* Amount */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium">
              {addIsGoal ? 'Target' : 'Limit'}
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAddMode((m) => m === 'amount' ? 'percentage' : 'amount')}
                className="text-blue-400 hover:text-blue-300 font-bold text-sm w-5 transition-colors"
              >
                {addMode === 'amount' ? '$' : '%'}
              </button>
              <input
                type="number"
                value={addValue}
                onChange={(e) => setAddValue(e.target.value)}
                placeholder={addMode === 'amount' ? '0.00' : '0'}
                min="0.01"
                step={addMode === 'amount' ? '0.01' : '0.1'}
                required
                autoFocus
                className="w-24 bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-2 text-slate-100 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Confirm */}
          <button
            type="submit"
            disabled={addSaving || !addValue}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            {addSaving ? 'Adding…' : `Add ${addIsGoal ? 'Goal' : 'Budget'}`}
          </button>
        </form>
      )}

      {/* ── Active rows table ── */}
      {activeCategories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <p className="text-slate-500 text-sm">No budgets or goals set yet.</p>
          <p className="text-slate-600 text-xs">Click &quot;Add Budget / Goal&quot; above to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[580px] text-sm">
            <thead>
              <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-800">
                <th className="text-left pb-2 pr-3 font-medium">Category</th>
                <th className="text-left pb-2 pr-3 font-medium">Target</th>
                <th className="text-right pb-2 pr-3 font-medium">Actual</th>
                <th className="text-right pb-2 pr-3 font-medium">Remaining</th>
                <th className="pb-2 font-medium min-w-[100px]">Progress</th>
                <th className="pb-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {activeCategories.map((cat) => {
                const state = getRow(cat.name)
                const { isGoal } = state
                const actual = isGoal ? (contributedMap[cat.name] ?? 0) : (spendMap[cat.name] ?? 0)
                const targetAmt = calcAmount(state, monthlyIncome)
                const targetPct = calcPct(state, monthlyIncome)
                const hasTarget = targetAmt !== null
                const remaining = hasTarget ? targetAmt! - actual : null
                const progress = hasTarget && targetAmt! > 0 ? Math.min((actual / targetAmt!) * 100, 100) : 0
                const isOver = !isGoal && remaining !== null && remaining < 0
                const isReached = isGoal && remaining !== null && remaining <= 0

                let barColor: string
                if (isGoal) barColor = isReached ? 'bg-emerald-500' : progress > 60 ? 'bg-blue-400' : 'bg-slate-500'
                else barColor = isOver ? 'bg-red-500' : progress > 80 ? 'bg-amber-500' : 'bg-emerald-500'

                let otherLabel = ''
                if (state.value) {
                  if (state.mode === 'amount' && targetPct !== null) otherLabel = `${targetPct.toFixed(1)}%`
                  else if (state.mode === 'percentage' && targetAmt !== null) otherLabel = `$${targetAmt.toFixed(0)}`
                }

                return (
                  <tr key={cat.name} className="group">
                    {/* Category + B/G badge */}
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-300">{cat.name}</span>
                        <button
                          onClick={() => toggleGoal(cat.name)}
                          title={isGoal ? 'Switch to Budget' : 'Switch to Goal'}
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                            isGoal
                              ? 'bg-emerald-900/60 text-emerald-300 hover:bg-emerald-900'
                              : 'bg-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {isGoal ? 'G' : 'B'}
                        </button>
                      </div>
                    </td>

                    {/* Target input */}
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleMode(cat.name)}
                          className="text-blue-400 hover:text-blue-300 font-bold text-xs w-5 flex-shrink-0 transition-colors"
                        >
                          {state.mode === 'amount' ? '$' : '%'}
                        </button>
                        <input
                          type="number"
                          value={state.value}
                          onChange={(e) => update(cat.name, { value: e.target.value, dirty: true })}
                          onBlur={() => save(cat.name)}
                          placeholder={state.mode === 'amount' ? '0.00' : '0'}
                          min="0"
                          step={state.mode === 'amount' ? '0.01' : '0.1'}
                          className="w-[72px] bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition"
                        />
                        {otherLabel && <span className="text-slate-600 text-xs">{otherLabel}</span>}
                        {state.saving && <span className="text-slate-600 text-xs italic">saving…</span>}
                      </div>
                    </td>

                    {/* Actual */}
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {actual > 0 ? (
                        <span className={isGoal ? 'text-emerald-400' : 'text-red-400'}>
                          {isGoal ? '+' : '−'}${actual.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Remaining */}
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {remaining !== null ? (
                        isGoal ? (
                          isReached
                            ? <span className="text-emerald-400 font-semibold">Goal reached!</span>
                            : <span className="text-slate-400">${Math.abs(remaining).toFixed(2)} to go</span>
                        ) : (
                          <span className={`font-semibold ${isOver ? 'text-red-400' : 'text-emerald-400'}`}>
                            {isOver ? `−$${Math.abs(remaining).toFixed(2)}` : `$${remaining.toFixed(2)}`}
                          </span>
                        )
                      ) : (
                        <span className="text-slate-700">—</span>
                      )}
                    </td>

                    {/* Progress bar */}
                    <td className="py-2.5 pr-3">
                      {hasTarget ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden min-w-[60px]">
                            <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-slate-600 text-xs tabular-nums w-8 text-right">{Math.round(progress)}%</span>
                        </div>
                      ) : (
                        <div className="h-2 bg-slate-800 rounded-full" />
                      )}
                    </td>

                    {/* Status + Delete */}
                    <td className="py-2.5 text-center">
                      <div className="flex items-center justify-end gap-2">
                        {hasTarget && (
                          isGoal
                            ? isReached
                              ? <span className="text-emerald-400 text-sm" title="Goal reached">★</span>
                              : <span className="text-slate-500 text-sm" title="In progress">◎</span>
                            : isOver
                              ? <span className="text-red-400 text-sm" title="Over budget">↑</span>
                              : <span className="text-emerald-400 text-sm" title="Under budget">✓</span>
                        )}
                        <button
                          onClick={() => handleDelete(cat.name)}
                          title="Remove"
                          className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all text-lg leading-none"
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
