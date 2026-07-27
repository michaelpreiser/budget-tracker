'use client'

import { useState, useEffect, useCallback } from 'react'
import InputBar from '@/components/InputBar'
import TransactionLog from '@/components/TransactionLog'
import Dashboard from '@/components/Dashboard'
import BudgetTargets from '@/components/BudgetTargets'
import BudgetBuckets from '@/components/BudgetBuckets'
import SavingsBuckets from '@/components/SavingsBuckets'
import CategoryManager from '@/components/CategoryManager'
import StatementImport from '@/components/StatementImport'
import CategoryRules from '@/components/CategoryRules'
import AppHeader from '@/components/AppHeader'
import type { Budget, Category, Transaction, SavingsBucket } from '@/types'

// ─── helpers ─────────────────────────────────────────────────────────────────

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── useCountUp hook ─────────────────────────────────────────────────────────

function useCountUp(target: number, deps: unknown[], duration = 800) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const start = performance.now()
    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(0 + (target - 0) * eased)
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return display
}

// ─── health score ─────────────────────────────────────────────────────────────

function HealthScore({ income, expenses, savings, budgets, transactions, lastMonthNet }: {
  income: number, expenses: number, savings: number,
  budgets: Budget[], transactions: Transaction[], lastMonthNet: number
}) {
  const net = income - expenses
  let savingsScore: number | null = null
  if (income > 0) {
    // Use explicit savings transactions if present, otherwise fall back to net/income
    const rate = savings > 0 ? (savings / income) * 100 : (net / income) * 100
    savingsScore = Math.min(Math.max((rate / 20) * 100, 0), 100)
  }

  const budgetScores: number[] = []
  for (const b of budgets) {
    if (!b.amount || b.is_goal) continue
    const spent = transactions
      .filter((t) => t.type === 'expense' && t.category === b.category)
      .reduce((s, t) => s + t.amount, 0)
    budgetScores.push(spent <= b.amount ? 100 : 0)
  }
  const budgetScore = budgetScores.length > 0
    ? budgetScores.reduce((a, b) => a + b, 0) / budgetScores.length
    : null

  let trendScore: number | null = null
  if (lastMonthNet !== 0) {
    const improvement = net - lastMonthNet
    if (improvement >= 0) trendScore = 100
    else if (improvement > -Math.abs(lastMonthNet) * 0.1) trendScore = 50
    else trendScore = 0
  }

  const goalScores: number[] = []
  for (const b of budgets) {
    if (!b.amount || !b.is_goal) continue
    const contributed = transactions
      .filter((t) => t.category === b.category)
      .reduce((s, t) => s + t.amount, 0)
    goalScores.push(Math.min((contributed / b.amount) * 100, 100))
  }
  const goalScore = goalScores.length > 0
    ? goalScores.reduce((a, b) => a + b, 0) / goalScores.length
    : null

  const factors = [savingsScore, budgetScore, trendScore, goalScore].filter((f) => f !== null) as number[]
  const score = factors.length > 0
    ? Math.round(factors.reduce((a, b) => a + b, 0) / factors.length)
    : 50

  const ringColor = score >= 71 ? '#10b981' : score >= 41 ? '#f59e0b' : '#ef4444'
  const radius = 36
  const circ = 2 * Math.PI * radius
  const [animScore, setAnimScore] = useState(0)

  useEffect(() => {
    const start = performance.now()
    const duration = 1000
    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setAnimScore(score * eased)
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [score])

  const dashoffset = circ * (1 - animScore / 100)

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl px-5 py-4 shadow-xl">
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-3">Financial Health</p>
      <div className="flex items-center gap-6">
        <svg width="88" height="88" viewBox="0 0 88 88" className="flex-shrink-0">
          <circle cx="44" cy="44" r={radius} fill="none" stroke="#1e293b" strokeWidth="8" />
          <circle
            cx="44" cy="44" r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={dashoffset}
            transform="rotate(-90 44 44)"
            style={{ transition: 'stroke 0.4s ease' }}
          />
          <text x="44" y="40" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="18" fontWeight="bold" dy="4">
            {Math.round(animScore)}
          </text>
        </svg>
        <div>
          <p className="text-slate-200 font-semibold text-sm mb-1">Score: {score}/100</p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {savingsScore !== null && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">Savings: {Math.round(savingsScore)}</span>
            )}
            {budgetScore !== null && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">Budget: {Math.round(budgetScore)}</span>
            )}
            {trendScore !== null && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">Trend: {trendScore}</span>
            )}
            {goalScore !== null && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">Goals: {Math.round(goalScore)}</span>
            )}
          </div>
          {factors.length === 0 && (
            <p className="text-slate-600 text-xs">Add transactions to calculate score</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [month, setMonth] = useState(currentMonth)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [savingsBuckets, setSavingsBuckets] = useState<SavingsBucket[]>([])
  const [loading, setLoading] = useState(true)
  const [migrationRun, setMigrationRun] = useState(false)

  // Expense/income exclusion toggles
  const [excludedFromExpenses, setExcludedFromExpenses] = useState<string[]>(['Investing'])
  const [showExclusionPanel, setShowExclusionPanel] = useState(false)
  const [excludedFromIncome, setExcludedFromIncome] = useState<string[]>([])
  const [showIncomeExclusionPanel, setShowIncomeExclusionPanel] = useState(false)

  // Toggle for including savings in discretionary cash calculation
  const [includeSavingsInDiscretionary, setIncludeSavingsInDiscretionary] = useState(true)

  const [lastMonthTransactions, setLastMonthTransactions] = useState<Transaction[]>([])

  // ── Persist exclusions ─────────────────────────────────────────────────────

  useEffect(() => {
    try { const s = localStorage.getItem('excludedFromExpenses'); if (s) setExcludedFromExpenses(JSON.parse(s)) } catch {}
  }, [])
  useEffect(() => { localStorage.setItem('excludedFromExpenses', JSON.stringify(excludedFromExpenses)) }, [excludedFromExpenses])

  useEffect(() => {
    try { const s = localStorage.getItem('excludedFromIncome'); if (s) setExcludedFromIncome(JSON.parse(s)) } catch {}
  }, [])
  useEffect(() => { localStorage.setItem('excludedFromIncome', JSON.stringify(excludedFromIncome)) }, [excludedFromIncome])

  // ── Persist savings toggle & sync with user-settings ─────────────────────

  useEffect(() => {
    try { const s = localStorage.getItem('includeSavingsInDiscretionary'); if (s !== null) setIncludeSavingsInDiscretionary(JSON.parse(s)) } catch {}
  }, [])

  async function toggleSavingsInDiscretionary() {
    const next = !includeSavingsInDiscretionary
    setIncludeSavingsInDiscretionary(next)
    localStorage.setItem('includeSavingsInDiscretionary', JSON.stringify(next))
    // Persist to user_settings in background
    fetch('/api/user-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ include_savings_in_discretionary: next }),
    }).catch(() => {})
  }

  // ── Run schema migration once per session ─────────────────────────────────

  useEffect(() => {
    if (migrationRun) return
    setMigrationRun(true)
    fetch('/api/migrate', { method: 'POST' }).catch(() => {})
  }, [migrationRun])

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  const fetchTransactions = useCallback(async () => {
    const r = await fetch(`/api/transactions?month=${month}`)
    if (r.ok) setTransactions(await r.json())
  }, [month])

  const fetchCategories = useCallback(async () => {
    const r = await fetch('/api/categories')
    if (r.ok) setCategories(await r.json())
  }, [])

  const fetchBudgets = useCallback(async () => {
    const r = await fetch('/api/budgets')
    if (r.ok) setBudgets(await r.json())
  }, [])

  const fetchSavingsBuckets = useCallback(async () => {
    const r = await fetch('/api/savings-buckets')
    if (r.ok) setSavingsBuckets(await r.json())
  }, [])

  useEffect(() => {
    Promise.all([fetchTransactions(), fetchCategories(), fetchBudgets(), fetchSavingsBuckets()]).finally(() => setLoading(false))
  }, [fetchTransactions, fetchCategories, fetchBudgets, fetchSavingsBuckets])

  useEffect(() => {
    const prevMonth = shiftMonth(month, -1)
    fetch(`/api/transactions?month=${prevMonth}`).then((r) => r.ok ? r.json() : []).then(setLastMonthTransactions).catch(() => {})
  }, [month])

  // ── Mutations ──────────────────────────────────────────────────────────────

  async function addTransaction(t: Omit<Transaction, 'id'>) {
    const r = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(t),
    })
    if (r.ok) await fetchTransactions()
  }

  async function editTransaction(id: number, t: Omit<Transaction, 'id'>) {
    const r = await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(t),
    })
    if (r.ok) await fetchTransactions()
  }

  async function deleteTransaction(id: number) {
    const r = await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
    if (r.ok) await fetchTransactions()
  }

  async function addCategory(name: string) {
    const r = await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    if (r.ok) await fetchCategories()
    else { const err = await r.json(); throw new Error(err.error) }
  }

  async function editCategory(id: number, name: string) {
    const r = await fetch(`/api/categories/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    if (!r.ok) { const err = await r.json(); throw new Error(err.error) }
    await Promise.all([fetchCategories(), fetchTransactions()])
  }

  async function deleteCategory(id: number) {
    const r = await fetch(`/api/categories/${id}`, { method: 'DELETE' })
    if (r.ok) await fetchCategories()
  }

  async function saveBudget(b: Budget) {
    const r = await fetch('/api/budgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
    if (r.ok) await fetchBudgets()
  }

  async function clearTransactions() {
    const r = await fetch(`/api/transactions?month=${month}`, { method: 'DELETE' })
    if (r.ok) setTransactions([])
  }

  async function deleteBudget(category: string) {
    const r = await fetch('/api/budgets', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category }) })
    if (r.ok) await fetchBudgets()
  }

  // ── Derived numbers ────────────────────────────────────────────────────────

  const monthlyIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const monthlyExpenses = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const monthlySavings = transactions.filter((t) => t.type === 'savings').reduce((s, t) => s + t.amount, 0)

  const expenseByCategory = transactions.filter((t) => t.type === 'expense').reduce((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + t.amount; return acc
  }, {} as Record<string, number>)

  const allExpenseCategories = Object.keys(expenseByCategory).sort()
  const excludedTotal = excludedFromExpenses.reduce((s, cat) => s + (expenseByCategory[cat] ?? 0), 0)
  const adjustedExpenses = monthlyExpenses - excludedTotal
  const activeExclusions = excludedFromExpenses.filter((cat) => expenseByCategory[cat] > 0)

  const incomeByCategory = transactions.filter((t) => t.type === 'income').reduce((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + t.amount; return acc
  }, {} as Record<string, number>)

  const allIncomeCategories = Object.keys(incomeByCategory).sort()
  const excludedIncomeTotal = excludedFromIncome.reduce((s, cat) => s + (incomeByCategory[cat] ?? 0), 0)
  const adjustedIncome = monthlyIncome - excludedIncomeTotal
  const activeIncomeExclusions = excludedFromIncome.filter((cat) => incomeByCategory[cat] > 0)

  const discretionary = adjustedIncome - adjustedExpenses - (includeSavingsInDiscretionary ? monthlySavings : 0)
  const isPositive = discretionary >= 0

  // Last month comparisons
  const lastMonthExpenses = lastMonthTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const lastMonthByCat = lastMonthTransactions.filter((t) => t.type === 'expense').reduce((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + t.amount; return acc
  }, {} as Record<string, number>)

  const spendingChangePct = lastMonthExpenses > 0
    ? ((monthlyExpenses - lastMonthExpenses) / lastMonthExpenses) * 100
    : null

  const catChanges = Object.entries({ ...expenseByCategory, ...lastMonthByCat })
    .map(([cat]) => ({ cat, change: (expenseByCategory[cat] ?? 0) - (lastMonthByCat[cat] ?? 0) }))
    .filter((c) => c.change !== 0)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))

  const topIncreases = catChanges.filter((c) => c.change > 0).slice(0, 3)
  const topDecreases = catChanges.filter((c) => c.change < 0).slice(0, 3)

  const lastMonthNet = lastMonthTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    - lastMonthTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  // ── Animated counters ──────────────────────────────────────────────────────

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const incomeDisplay = useCountUp(adjustedIncome, [adjustedIncome, month])
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const expDisplay = useCountUp(adjustedExpenses, [adjustedExpenses, month])
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const savingsDisplay = useCountUp(monthlySavings, [monthlySavings, month])
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const discretionaryDisplay = useCountUp(Math.abs(discretionary), [discretionary, month])

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ── Header ── */}
      <AppHeader
        navigator={
          <div className="flex items-center gap-0.5 bg-slate-900 border border-slate-800 rounded-xl px-1 py-0.5">
            <button
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors text-sm leading-none"
              aria-label="Previous month"
            >
              ‹
            </button>
            <span className="text-slate-200 font-medium text-xs min-w-[130px] text-center tabular-nums">
              {formatMonth(month)}
            </span>
            <button
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors text-sm leading-none"
              aria-label="Next month"
            >
              ›
            </button>
            {month !== currentMonth() && (
              <button
                onClick={() => setMonth(currentMonth())}
                className="ml-1 mr-0.5 text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
              >
                Now
              </button>
            )}
          </div>
        }
      />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ── 1. Top-line summary: 4 cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Income */}
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl px-5 py-4 shadow-xl" style={{ borderTop: '3px solid #10b981' }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Income</p>
              <button
                onClick={() => setShowIncomeExclusionPanel((v) => !v)}
                className={`text-xs px-2 py-0.5 rounded-lg border transition-colors ${showIncomeExclusionPanel ? 'border-blue-500/50 text-blue-400 bg-blue-500/10' : 'border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600'}`}
              >
                {showIncomeExclusionPanel ? 'done' : 'edit'}
              </button>
            </div>
            <p className="text-2xl font-bold tabular-nums leading-none text-emerald-400">${fmt(incomeDisplay)}</p>
            {!showIncomeExclusionPanel && activeIncomeExclusions.length > 0 && (
              <p className="text-slate-600 text-xs mt-1.5 tabular-nums">excl. ${fmt(excludedIncomeTotal)} in {activeIncomeExclusions.join(', ')}</p>
            )}
            {showIncomeExclusionPanel && (
              <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5">
                <p className="text-slate-500 text-xs mb-2">Exclude from total:</p>
                {allIncomeCategories.length === 0 ? (
                  <p className="text-slate-600 text-xs">No income this month.</p>
                ) : allIncomeCategories.map((cat) => (
                  <label key={cat} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={excludedFromIncome.includes(cat)}
                      onChange={(e) => setExcludedFromIncome((prev) => e.target.checked ? [...prev, cat] : prev.filter((c) => c !== cat))}
                      className="accent-blue-500" />
                    <span className="text-slate-300 text-xs flex-1">{cat}</span>
                    <span className="text-slate-500 text-xs tabular-nums">${fmt(incomeByCategory[cat])}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Expenses */}
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl px-5 py-4 shadow-xl" style={{ borderTop: '3px solid #ef4444' }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Expenses</p>
              <button
                onClick={() => setShowExclusionPanel((v) => !v)}
                className={`text-xs px-2 py-0.5 rounded-lg border transition-colors ${showExclusionPanel ? 'border-blue-500/50 text-blue-400 bg-blue-500/10' : 'border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600'}`}
              >
                {showExclusionPanel ? 'done' : 'edit'}
              </button>
            </div>
            <p className="text-2xl font-bold tabular-nums leading-none text-red-400">−${fmt(expDisplay)}</p>
            {!showExclusionPanel && activeExclusions.length > 0 && (
              <p className="text-slate-600 text-xs mt-1.5 tabular-nums">excl. ${fmt(excludedTotal)} in {activeExclusions.join(', ')}</p>
            )}
            {showExclusionPanel && (
              <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5">
                <p className="text-slate-500 text-xs mb-2">Exclude from total:</p>
                {allExpenseCategories.length === 0 ? (
                  <p className="text-slate-600 text-xs">No expenses this month.</p>
                ) : allExpenseCategories.map((cat) => (
                  <label key={cat} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={excludedFromExpenses.includes(cat)}
                      onChange={(e) => setExcludedFromExpenses((prev) => e.target.checked ? [...prev, cat] : prev.filter((c) => c !== cat))}
                      className="accent-blue-500" />
                    <span className="text-slate-300 text-xs flex-1">{cat}</span>
                    <span className="text-slate-500 text-xs tabular-nums">${fmt(expenseByCategory[cat])}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Savings — with toggle that affects Discretionary */}
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl px-5 py-4 shadow-xl" style={{ borderTop: '3px solid #3b82f6' }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Savings</p>
              {/* Toggle: include savings in discretionary calculation */}
              <button
                onClick={toggleSavingsInDiscretionary}
                title={includeSavingsInDiscretionary ? 'Savings included in Discretionary — click to exclude' : 'Savings excluded from Discretionary — click to include'}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${includeSavingsInDiscretionary ? 'bg-blue-600' : 'bg-slate-700'}`}
              >
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${includeSavingsInDiscretionary ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </div>
            <p className="text-2xl font-bold tabular-nums leading-none text-blue-400">⇑${fmt(savingsDisplay)}</p>
            <p className="text-slate-600 text-xs mt-1.5">
              {includeSavingsInDiscretionary ? 'Deducted from discretionary' : 'Not deducted from discretionary'}
            </p>
          </div>

          {/* Discretionary */}
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl px-5 py-4 shadow-xl" style={{ borderTop: '3px solid #06b6d4' }}>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Discretionary</p>
            <p className={`text-2xl font-bold tabular-nums leading-none ${isPositive ? 'text-cyan-400' : 'text-red-400'}`}>
              {isPositive ? '' : '−'}${fmt(discretionaryDisplay)}
            </p>
            <p className="text-slate-600 text-xs mt-1.5">
              Income − Expenses{includeSavingsInDiscretionary ? ' − Savings' : ''}
            </p>
          </div>
        </div>

        {/* ── 2. 50/30/20 Budget Buckets ── */}
        <BudgetBuckets
          transactions={transactions}
          lastMonthTransactions={lastMonthTransactions}
          monthlyIncome={adjustedIncome}
          categories={categories}
        />

        {/* ── vs Last Month ── */}
        {transactions.length > 0 && lastMonthTransactions.length > 0 && (
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl px-5 py-4 shadow-xl">
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-3">
              vs {formatMonth(shiftMonth(month, -1))}
            </p>
            <div className="flex flex-wrap gap-6">
              <div className="flex-shrink-0">
                <p className="text-slate-600 text-xs mb-1">Total Spending</p>
                {spendingChangePct !== null ? (
                  <>
                    <p className={`text-xl font-bold tabular-nums ${spendingChangePct > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {spendingChangePct > 0 ? '▲' : '▼'} {Math.abs(spendingChangePct).toFixed(1)}%
                    </p>
                    <p className="text-slate-600 text-xs tabular-nums mt-0.5">
                      ${fmt(Math.abs(monthlyExpenses - lastMonthExpenses))} {monthlyExpenses > lastMonthExpenses ? 'more' : 'less'}
                    </p>
                  </>
                ) : <p className="text-slate-500 text-sm">No data last month</p>}
              </div>
              {topIncreases.length > 0 && (
                <div className="flex-shrink-0">
                  <p className="text-slate-600 text-xs mb-1.5">Biggest increases</p>
                  <div className="space-y-1">
                    {topIncreases.map(({ cat, change }) => (
                      <div key={cat} className="flex items-center gap-2 text-xs">
                        <span className="text-red-400">▲</span>
                        <span className="text-slate-400">{cat}</span>
                        <span className="text-red-400 tabular-nums font-medium">+${fmt(change)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {topDecreases.length > 0 && (
                <div className="flex-shrink-0">
                  <p className="text-slate-600 text-xs mb-1.5">Biggest decreases</p>
                  <div className="space-y-1">
                    {topDecreases.map(({ cat, change }) => (
                      <div key={cat} className="flex items-center gap-2 text-xs">
                        <span className="text-emerald-400">▼</span>
                        <span className="text-slate-400">{cat}</span>
                        <span className="text-emerald-400 tabular-nums font-medium">${fmt(Math.abs(change))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex-shrink-0 ml-auto text-right">
                <p className="text-slate-600 text-xs mb-1">Discretionary</p>
                <p className={`text-xl font-bold tabular-nums ${isPositive ? 'text-cyan-400' : 'text-red-400'}`}>
                  {isPositive ? '' : '−'}${fmt(Math.abs(discretionary))}
                </p>
                <p className="text-slate-600 text-xs mt-0.5 tabular-nums">
                  ${fmt(adjustedIncome)} in · ${fmt(adjustedExpenses)} out{monthlySavings > 0 ? ` · ${fmt(monthlySavings)} saved` : ''}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Financial Health ── */}
        {transactions.length > 0 && (
          <HealthScore
            income={adjustedIncome}
            expenses={adjustedExpenses}
            savings={monthlySavings}
            budgets={budgets}
            transactions={transactions}
            lastMonthNet={lastMonthNet}
          />
        )}

        {/* ── 3. HYSA / Savings Buckets ── */}
        <SavingsBuckets
          transactions={transactions}
          lastMonthTransactions={lastMonthTransactions}
          monthlyIncome={adjustedIncome}
        />

        {/* ── 5. Budget Targets ── */}
        <BudgetTargets
          categories={categories}
          budgets={budgets}
          transactions={transactions}
          monthlyIncome={adjustedIncome}
          onSave={saveBudget}
          onDelete={deleteBudget}
        />

        {/* ── 6. Transaction Log + entry tools ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="flex flex-col gap-6">
            <Dashboard transactions={transactions} />
            <StatementImport
              categories={categories}
              savingsBuckets={savingsBuckets}
              onImportDone={async () => { await fetchTransactions(); await fetchSavingsBuckets() }}
            />
            <InputBar
              categories={categories}
              savingsBuckets={savingsBuckets}
              onAdd={async (t) => { await addTransaction(t); if (t.type === 'savings') await fetchSavingsBuckets() }}
            />
          </div>
          <TransactionLog
            transactions={transactions}
            categories={categories}
            savingsBuckets={savingsBuckets}
            onDelete={deleteTransaction}
            onEdit={async (id, t) => { await editTransaction(id, t); if (t.type === 'savings') await fetchSavingsBuckets() }}
            onClearAll={clearTransactions}
          />
        </div>

        {/* ── Category manager ── */}
        <CategoryManager
          categories={categories}
          onAdd={addCategory}
          onDelete={deleteCategory}
          onEdit={editCategory}
        />

        {/* ── Category rules ── */}
        <CategoryRules categories={categories} />

        <p className="text-center text-slate-700 text-xs pb-4">
          Budget Tracker · Data stored in Turso
        </p>
      </main>
    </div>
  )
}
