'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import InputBar from '@/components/InputBar'
import TransactionLog from '@/components/TransactionLog'
import Dashboard from '@/components/Dashboard'
import BudgetTargets from '@/components/BudgetTargets'
import CategoryManager from '@/components/CategoryManager'
import StatementImport from '@/components/StatementImport'
import AccountModal from '@/components/AccountModal'
import type { Budget, Category, Transaction } from '@/types'

// ─── helpers ────────────────────────────────────────────────────────────────

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
  return new Date(y, m - 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── stat card ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  colour,
  prefix = '',
  large = false,
}: {
  label: string
  value: number
  colour: string
  prefix?: string
  large?: boolean
}) {
  return (
    <div
      className={`bg-slate-900 border border-slate-700/50 rounded-2xl px-5 py-4 shadow-xl ${
        large ? 'sm:col-span-1' : ''
      }`}
    >
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-bold tabular-nums leading-none ${large ? 'text-3xl' : 'text-2xl'} ${colour}`}>
        {prefix}${fmt(value)}
      </p>
    </div>
  )
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter()
  const [month, setMonth] = useState(currentMonth)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState('')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [excludedFromExpenses, setExcludedFromExpenses] = useState<string[]>(['Investing'])
  const [showExclusionPanel, setShowExclusionPanel] = useState(false)
  const [excludedFromIncome, setExcludedFromIncome] = useState<string[]>([])
  const [showIncomeExclusionPanel, setShowIncomeExclusionPanel] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Persist excluded categories to localStorage
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

  // ── fetch helpers ──────────────────────────────────────────────────────────

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

  // Initial load
  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => { if (d.username) setUsername(d.username) })
    Promise.all([fetchTransactions(), fetchCategories(), fetchBudgets()]).finally(() =>
      setLoading(false)
    )
  }, [fetchTransactions, fetchCategories, fetchBudgets])

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  // ── mutations ──────────────────────────────────────────────────────────────

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
    const r = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (r.ok) await fetchCategories()
    else {
      const err = await r.json()
      throw new Error(err.error)
    }
  }

  async function editCategory(id: number, name: string) {
    const r = await fetch(`/api/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!r.ok) {
      const err = await r.json()
      throw new Error(err.error)
    }
    await Promise.all([fetchCategories(), fetchTransactions()])
  }

  async function deleteCategory(id: number) {
    const r = await fetch(`/api/categories/${id}`, { method: 'DELETE' })
    if (r.ok) await fetchCategories()
  }

  async function saveBudget(b: Budget) {
    const r = await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(b),
    })
    if (r.ok) await fetchBudgets()
  }

  async function deleteBudget(category: string) {
    const r = await fetch('/api/budgets', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    })
    if (r.ok) await fetchBudgets()
  }

  // ── derived numbers ────────────────────────────────────────────────────────

  const monthlyIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0)

  const monthlyExpenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0)

  const expenseByCategory = transactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] ?? 0) + t.amount
      return acc
    }, {} as Record<string, number>)

  const allExpenseCategories = Object.keys(expenseByCategory).sort()

  const excludedTotal = excludedFromExpenses.reduce(
    (s, cat) => s + (expenseByCategory[cat] ?? 0), 0
  )
  const adjustedExpenses = monthlyExpenses - excludedTotal
  const activeExclusions = excludedFromExpenses.filter((cat) => expenseByCategory[cat] > 0)

  const incomeByCategory = transactions
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] ?? 0) + t.amount
      return acc
    }, {} as Record<string, number>)

  const allIncomeCategories = Object.keys(incomeByCategory).sort()

  const excludedIncomeTotal = excludedFromIncome.reduce(
    (s, cat) => s + (incomeByCategory[cat] ?? 0), 0
  )
  const adjustedIncome = monthlyIncome - excludedIncomeTotal
  const activeIncomeExclusions = excludedFromIncome.filter((cat) => incomeByCategory[cat] > 0)

  const net = adjustedIncome - adjustedExpenses
  const isProfit = net >= 0

  // ── render ─────────────────────────────────────────────────────────────────

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
      <header className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl select-none" aria-hidden>
              💰
            </span>
            <h1 className="text-lg font-bold tracking-tight text-slate-100">Budget Tracker</h1>
            <button
              onClick={() => router.push('/total')}
              className="ml-1 text-xs px-2.5 py-1 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
            >
              Yearly
            </button>
          </div>

          {/* Month navigator */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              aria-label="Previous month"
            >
              ‹
            </button>
            <span className="text-slate-200 font-medium text-sm min-w-[140px] text-center">
              {formatMonth(month)}
            </span>
            <button
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              aria-label="Next month"
            >
              ›
            </button>
            {month !== currentMonth() && (
              <button
                onClick={() => setMonth(currentMonth())}
                className="ml-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Today
              </button>
            )}
          </div>

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu((v) => !v)}
              className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
            >
              <span className="text-slate-300 text-sm font-medium">{username}</span>
              <span className="text-slate-500 text-xs">▾</span>
            </button>
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-40 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
                <div className="px-3 py-2 border-b border-slate-700">
                  <p className="text-slate-400 text-xs">Signed in as</p>
                  <p className="text-slate-200 text-sm font-semibold truncate">{username}</p>
                </div>
                <button
                  onClick={() => { setShowUserMenu(false); setShowAccountModal(true) }}
                  className="w-full text-left px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Account Settings
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2.5 text-sm text-red-400 hover:bg-slate-700 transition-colors border-t border-slate-700"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* ── Stats row ── */}
        <div className="grid grid-cols-3 gap-4">
          {/* Custom Income card with exclusion controls */}
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
                  <p className="text-slate-600 text-xs">No income this month.</p>
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

          {/* Custom Expenses card with exclusion controls */}
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl px-5 py-4 shadow-xl">
            <div className="flex items-center justify-between mb-1">
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Expenses</p>
              <button
                onClick={() => setShowExclusionPanel((v) => !v)}
                title="Customize excluded categories"
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
                  <p className="text-slate-600 text-xs">No expenses this month.</p>
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
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl px-5 py-4 shadow-xl">
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">
              Net {isProfit ? 'Profit' : 'Loss'}
            </p>
            <p
              className={`text-3xl font-bold tabular-nums leading-none ${
                isProfit ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {isProfit ? '+' : '−'}${fmt(Math.abs(net))}
            </p>
          </div>
        </div>

        {/* ── Main two-column layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="flex flex-col gap-6">
            <InputBar categories={categories} onAdd={addTransaction} />
            <StatementImport categories={categories} onImportDone={fetchTransactions} />
            <Dashboard transactions={transactions} />
          </div>

          {/* Right column */}
          <TransactionLog
            transactions={transactions}
            categories={categories}
            onDelete={deleteTransaction}
            onEdit={editTransaction}
          />
        </div>

        {/* ── Budget targets ── */}
        <BudgetTargets
          categories={categories}
          budgets={budgets}
          transactions={transactions}
          monthlyIncome={adjustedIncome}
          onSave={saveBudget}
          onDelete={deleteBudget}
        />

        {/* ── Category manager ── */}
        <CategoryManager
          categories={categories}
          onAdd={addCategory}
          onDelete={deleteCategory}
          onEdit={editCategory}
        />

        <p className="text-center text-slate-700 text-xs pb-4">
          Data stored locally in SQLite · Budget Tracker
        </p>
      </main>

      {showAccountModal && (
        <AccountModal
          username={username}
          onClose={() => setShowAccountModal(false)}
          onUsernameChange={(name) => setUsername(name)}
        />
      )}
    </div>
  )
}
