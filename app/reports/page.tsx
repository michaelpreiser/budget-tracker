'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Transaction, Budget } from '@/types'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function currentYearMonth() {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function ym(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function shiftYM(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

function csvEscape(val: string | number) {
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

// ─── types ────────────────────────────────────────────────────────────────────

type Tab = 'monthly' | 'yearend' | 'csv'

// ─── main component ───────────────────────────────────────────────────────────

export default function ReportsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('monthly')

  // Month/year selectors
  const { year: cy, month: cm } = currentYearMonth()
  const [reportYear, setReportYear] = useState(cy)
  const [reportMonth, setReportMonth] = useState(cm)
  const [yearEndYear, setYearEndYear] = useState(cy)

  // Data
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [prevTransactions, setPrevTransactions] = useState<Transaction[]>([])
  const [yearTransactions, setYearTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(false)

  // CSV export state
  const [csvStart, setCsvStart] = useState(`${ym(cy, cm)}-01`)
  const [csvEnd, setCsvEnd] = useState(() => {
    const d = new Date(cy, cm, 0)
    return `${ym(cy, cm)}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [csvCategories, setCsvCategories] = useState<string[]>([])
  const [csvAllCategories, setCsvAllCategories] = useState<string[]>([])
  const [csvType, setCsvType] = useState<'all' | 'income' | 'expense'>('all')

  // Print refs
  const monthlyRef = useRef<HTMLDivElement>(null)
  const yearEndRef = useRef<HTMLDivElement>(null)

  // ─── fetch monthly data ──────────────────────────────────────────────────────

  const fetchMonthly = useCallback(async () => {
    setLoading(true)
    try {
      const month = ym(reportYear, reportMonth)
      const prev = shiftYM(reportYear, reportMonth, -1)
      const prevMonth = ym(prev.year, prev.month)

      const [txRes, prevRes, budRes] = await Promise.all([
        fetch(`/api/transactions?month=${month}`),
        fetch(`/api/transactions?month=${prevMonth}`),
        fetch('/api/budgets'),
      ])

      if (txRes.ok) setTransactions(await txRes.json())
      if (prevRes.ok) setPrevTransactions(await prevRes.json())
      if (budRes.ok) setBudgets(await budRes.json())
    } finally {
      setLoading(false)
    }
  }, [reportYear, reportMonth])

  // ─── fetch year-end data ─────────────────────────────────────────────────────

  const fetchYearEnd = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/transactions?year=${yearEndYear}`)
      if (res.ok) setYearTransactions(await res.json())
    } finally {
      setLoading(false)
    }
  }, [yearEndYear])

  // ─── fetch CSV data ───────────────────────────────────────────────────────────

  const fetchCsvData = useCallback(async () => {
    const res = await fetch(`/api/transactions?start=${csvStart}&end=${csvEnd}`)
    if (res.ok) {
      const data: Transaction[] = await res.json()
      const catSet: Record<string, true> = {}
      data.forEach((t) => { catSet[t.category] = true })
      const cats = Object.keys(catSet).sort()
      setCsvAllCategories(cats)
      setCsvCategories(cats)
    }
  }, [csvStart, csvEnd])

  useEffect(() => { if (tab === 'monthly') fetchMonthly() }, [tab, fetchMonthly])
  useEffect(() => { if (tab === 'yearend') fetchYearEnd() }, [tab, fetchYearEnd])
  useEffect(() => { if (tab === 'csv') fetchCsvData() }, [tab, fetchCsvData])

  // ─── derived monthly stats ────────────────────────────────────────────────────

  const expenses = transactions.filter((t) => t.type === 'expense')
  const incomes = transactions.filter((t) => t.type === 'income')
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0)
  const totalIncome = incomes.reduce((s, t) => s + t.amount, 0)
  const net = totalIncome - totalExpenses

  const expByCategory: Record<string, number> = {}
  for (const t of expenses) expByCategory[t.category] = (expByCategory[t.category] ?? 0) + t.amount
  const expCategories = Object.entries(expByCategory).sort((a, b) => b[1] - a[1])

  const prevExpenses = prevTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const prevIncome = prevTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expChangePct = prevExpenses > 0 ? ((totalExpenses - prevExpenses) / prevExpenses) * 100 : null

  const top10 = [...transactions].sort((a, b) => b.amount - a.amount).slice(0, 10)

  // ─── PDF export ───────────────────────────────────────────────────────────────

  async function exportPDF(ref: React.RefObject<HTMLDivElement | null>, filename: string) {
    if (!ref.current) return
    const html2canvas = (await import('html2canvas')).default
    const jsPDF = (await import('jspdf')).default

    const canvas = await html2canvas(ref.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const imgW = pageW
    const imgH = (canvas.height * imgW) / canvas.width

    let yPos = 0
    let remaining = imgH
    while (remaining > 0) {
      pdf.addImage(imgData, 'PNG', 0, -yPos, imgW, imgH)
      remaining -= pageH
      yPos += pageH
      if (remaining > 0) pdf.addPage()
    }

    pdf.save(filename)
  }

  // ─── CSV export ───────────────────────────────────────────────────────────────

  async function downloadCSV() {
    const res = await fetch(`/api/transactions?start=${csvStart}&end=${csvEnd}`)
    if (!res.ok) return
    const data: Transaction[] = await res.json()

    const filtered = data.filter((t) => {
      if (csvType !== 'all' && t.type !== csvType) return false
      if (csvCategories.length > 0 && !csvCategories.includes(t.category)) return false
      return true
    })

    const header = ['Date', 'Description', 'Category', 'Amount', 'Type']
    const rows = filtered.map((t) => [
      csvEscape(t.date),
      csvEscape(t.notes || ''),
      csvEscape(t.category),
      csvEscape(t.amount),
      csvEscape(t.type),
    ])

    const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transactions_${csvStart}_to_${csvEnd}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── year-end derived ─────────────────────────────────────────────────────────

  const monthlyTotals = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const monthTx = yearTransactions.filter((t) => {
      const tm = parseInt(t.date.split('-')[1])
      return tm === m
    })
    const exp = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const inc = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    return { month: m, expenses: exp, income: inc, net: inc - exp }
  })

  const yearTotalExp = monthlyTotals.reduce((s, r) => s + r.expenses, 0)
  const yearTotalInc = monthlyTotals.reduce((s, r) => s + r.income, 0)
  const activeMonths = monthlyTotals.filter((r) => r.expenses > 0 || r.income > 0).length || 1

  const maxExpMonth = monthlyTotals.reduce((max, r) => (r.expenses > max.expenses ? r : max), monthlyTotals[0])
  const minExpMonth = monthlyTotals
    .filter((r) => r.expenses > 0)
    .reduce((min, r) => (r.expenses < min.expenses ? r : min), monthlyTotals.find((r) => r.expenses > 0) ?? monthlyTotals[0])

  const yearCatMap: Record<string, number> = {}
  for (const t of yearTransactions.filter((t) => t.type === 'expense')) {
    yearCatMap[t.category] = (yearCatMap[t.category] ?? 0) + t.amount
  }
  const yearCats = Object.entries(yearCatMap).sort((a, b) => b[1] - a[1])

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  // ─── render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      {/* Header */}
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/')}
            className="text-slate-400 hover:text-slate-200 text-sm transition-colors"
          >
            ← Dashboard
          </button>
          <h1 className="text-xl font-bold text-slate-100">Reports & Export</h1>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 bg-slate-900 border border-slate-700/50 rounded-xl p-1 w-fit">
          {([
            { id: 'monthly', label: 'Monthly Report' },
            { id: 'yearend', label: 'Year-End Summary' },
            { id: 'csv', label: 'Export CSV' },
          ] as { id: Tab; label: string }[]).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── MONTHLY REPORT ── */}
        {tab === 'monthly' && (
          <div>
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <div className="flex items-center gap-2">
                <select
                  value={reportMonth}
                  onChange={(e) => setReportMonth(Number(e.target.value))}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  {MONTH_NAMES.map((name, i) => (
                    <option key={i + 1} value={i + 1}>{name}</option>
                  ))}
                </select>
                <select
                  value={reportYear}
                  onChange={(e) => setReportYear(Number(e.target.value))}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  {[cy - 2, cy - 1, cy, cy + 1].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <button
                  onClick={fetchMonthly}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors"
                >
                  Load
                </button>
              </div>
              <button
                onClick={() => exportPDF(monthlyRef, `report_${ym(reportYear, reportMonth)}.pdf`)}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Export PDF
              </button>
            </div>

            {loading ? (
              <p className="text-slate-500 text-sm">Loading…</p>
            ) : (
              /* Printable card */
              <div
                ref={monthlyRef}
                className="bg-white text-gray-900 rounded-2xl p-8 shadow-xl space-y-8"
              >
                {/* Title */}
                <div className="border-b border-gray-200 pb-4">
                  <h2 className="text-2xl font-bold text-gray-800">Monthly Summary Report</h2>
                  <p className="text-gray-500 text-sm mt-1">{monthLabel(reportYear, reportMonth)}</p>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Income</p>
                    <p className="text-2xl font-bold text-green-600">${fmt(totalIncome)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Expenses</p>
                    <p className="text-2xl font-bold text-red-500">${fmt(totalExpenses)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Net</p>
                    <p className={`text-2xl font-bold ${net >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {net >= 0 ? '+' : '−'}${fmt(Math.abs(net))}
                    </p>
                  </div>
                </div>

                {/* vs Previous Month */}
                {(prevExpenses > 0 || prevIncome > 0) && (
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">vs Previous Month</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="border border-gray-100 rounded-xl p-3">
                        <p className="text-xs text-gray-500 mb-0.5">Expenses</p>
                        <p className="font-semibold text-gray-800">${fmt(totalExpenses)}</p>
                        {expChangePct !== null && (
                          <p className={`text-xs mt-0.5 ${expChangePct > 0 ? 'text-red-500' : 'text-green-600'}`}>
                            {expChangePct > 0 ? '▲' : '▼'} {Math.abs(expChangePct).toFixed(1)}% vs ${fmt(prevExpenses)} last month
                          </p>
                        )}
                      </div>
                      <div className="border border-gray-100 rounded-xl p-3">
                        <p className="text-xs text-gray-500 mb-0.5">Income</p>
                        <p className="font-semibold text-gray-800">${fmt(totalIncome)}</p>
                        {prevIncome > 0 && (
                          <p className={`text-xs mt-0.5 ${totalIncome >= prevIncome ? 'text-green-600' : 'text-red-500'}`}>
                            {totalIncome >= prevIncome ? '▲' : '▼'} {Math.abs(((totalIncome - prevIncome) / prevIncome) * 100).toFixed(1)}% vs ${fmt(prevIncome)} last month
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Category breakdown */}
                {expCategories.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">Expense Categories</h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b border-gray-200">
                          <th className="text-left pb-2 font-semibold">Category</th>
                          <th className="text-right pb-2 font-semibold">Amount</th>
                          <th className="text-right pb-2 font-semibold">% of Total</th>
                          <th className="text-right pb-2 font-semibold w-32">Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expCategories.map(([cat, amt]) => {
                          const pct = totalExpenses > 0 ? (amt / totalExpenses) * 100 : 0
                          return (
                            <tr key={cat} className="border-b border-gray-100">
                              <td className="py-2 text-gray-800">{cat}</td>
                              <td className="py-2 text-right tabular-nums text-gray-800">${fmt(amt)}</td>
                              <td className="py-2 text-right tabular-nums text-gray-500">{pct.toFixed(1)}%</td>
                              <td className="py-2 pl-3">
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-blue-500"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                        <tr className="bg-gray-50">
                          <td className="py-2 font-semibold text-gray-800">Total</td>
                          <td className="py-2 text-right font-semibold tabular-nums text-gray-800">${fmt(totalExpenses)}</td>
                          <td className="py-2 text-right text-gray-500">100%</td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Budget vs Actual */}
                {budgets.filter((b) => expByCategory[b.category] !== undefined).length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">Budget vs Actual</h3>
                    <div className="space-y-3">
                      {budgets
                        .filter((b) => b.amount && expByCategory[b.category] !== undefined)
                        .map((b) => {
                          const actual = expByCategory[b.category] ?? 0
                          const budgeted = b.amount ?? 0
                          const pct = budgeted > 0 ? Math.min((actual / budgeted) * 100, 100) : 0
                          const over = actual > budgeted
                          return (
                            <div key={b.category}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-700">{b.category}</span>
                                <span className={over ? 'text-red-500 font-medium' : 'text-gray-600'}>
                                  ${fmt(actual)} / ${fmt(budgeted)}
                                  {over && <span className="ml-1 text-xs">(over by ${fmt(actual - budgeted)})</span>}
                                </span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${over ? 'bg-red-400' : 'bg-green-500'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}

                {/* Top 10 transactions */}
                {top10.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">Top 10 Transactions</h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b border-gray-200">
                          <th className="text-left pb-2 font-semibold">Date</th>
                          <th className="text-left pb-2 font-semibold">Description</th>
                          <th className="text-left pb-2 font-semibold">Category</th>
                          <th className="text-right pb-2 font-semibold">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {top10.map((t) => (
                          <tr key={t.id} className="border-b border-gray-100">
                            <td className="py-1.5 text-gray-500 tabular-nums">{t.date}</td>
                            <td className="py-1.5 text-gray-800 truncate max-w-[200px]">{t.notes || '—'}</td>
                            <td className="py-1.5 text-gray-600">{t.category}</td>
                            <td className={`py-1.5 text-right tabular-nums font-medium ${t.type === 'expense' ? 'text-red-500' : 'text-green-600'}`}>
                              {t.type === 'expense' ? '−' : '+'}${fmt(t.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {transactions.length === 0 && (
                  <p className="text-center text-gray-400 py-8">No transactions for this month.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── YEAR-END SUMMARY ── */}
        {tab === 'yearend' && (
          <div>
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <div className="flex items-center gap-2">
                <select
                  value={yearEndYear}
                  onChange={(e) => setYearEndYear(Number(e.target.value))}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  {[cy - 2, cy - 1, cy, cy + 1].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <button
                  onClick={fetchYearEnd}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors"
                >
                  Load
                </button>
              </div>
              <button
                onClick={() => exportPDF(yearEndRef, `year_end_${yearEndYear}.pdf`)}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Export PDF
              </button>
            </div>

            {loading ? (
              <p className="text-slate-500 text-sm">Loading…</p>
            ) : (
              <div
                ref={yearEndRef}
                className="bg-white text-gray-900 rounded-2xl p-8 shadow-xl space-y-8"
              >
                {/* Title */}
                <div className="border-b border-gray-200 pb-4">
                  <h2 className="text-2xl font-bold text-gray-800">Year-End Summary</h2>
                  <p className="text-gray-500 text-sm mt-1">{yearEndYear}</p>
                </div>

                {/* Yearly totals */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Total Income</p>
                    <p className="text-2xl font-bold text-green-600">${fmt(yearTotalInc)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Total Expenses</p>
                    <p className="text-2xl font-bold text-red-500">${fmt(yearTotalExp)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Avg Monthly Spend</p>
                    <p className="text-xl font-bold text-gray-700">${fmt(yearTotalExp / activeMonths)}</p>
                  </div>
                </div>

                {/* Monthly totals table */}
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">Monthly Breakdown</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b border-gray-200">
                        <th className="text-left pb-2 font-semibold">Month</th>
                        <th className="text-right pb-2 font-semibold">Income</th>
                        <th className="text-right pb-2 font-semibold">Expenses</th>
                        <th className="text-right pb-2 font-semibold">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyTotals.map((row) => {
                        const isMax = row.expenses === maxExpMonth.expenses && row.expenses > 0
                        const isMin = minExpMonth && row.expenses === minExpMonth.expenses && row.expenses > 0 && row.expenses !== maxExpMonth.expenses
                        return (
                          <tr
                            key={row.month}
                            className={`border-b border-gray-100 ${
                              isMax ? 'bg-red-50' : isMin ? 'bg-green-50' : ''
                            }`}
                          >
                            <td className="py-2 text-gray-700 flex items-center gap-2">
                              {MONTH_NAMES[row.month - 1]}
                              {isMax && <span className="text-xs text-red-500 font-medium">↑ highest</span>}
                              {isMin && <span className="text-xs text-green-600 font-medium">↓ lowest</span>}
                            </td>
                            <td className="py-2 text-right tabular-nums text-green-700">
                              {row.income > 0 ? `$${fmt(row.income)}` : '—'}
                            </td>
                            <td className="py-2 text-right tabular-nums text-red-500">
                              {row.expenses > 0 ? `$${fmt(row.expenses)}` : '—'}
                            </td>
                            <td className={`py-2 text-right tabular-nums font-medium ${row.net >= 0 ? 'text-green-700' : 'text-red-500'}`}>
                              {row.income > 0 || row.expenses > 0
                                ? `${row.net >= 0 ? '+' : '−'}$${fmt(Math.abs(row.net))}`
                                : '—'}
                            </td>
                          </tr>
                        )
                      })}
                      <tr className="bg-gray-50 font-semibold">
                        <td className="py-2 text-gray-800">Total</td>
                        <td className="py-2 text-right tabular-nums text-green-700">${fmt(yearTotalInc)}</td>
                        <td className="py-2 text-right tabular-nums text-red-500">${fmt(yearTotalExp)}</td>
                        <td className={`py-2 text-right tabular-nums ${yearTotalInc - yearTotalExp >= 0 ? 'text-green-700' : 'text-red-500'}`}>
                          {yearTotalInc - yearTotalExp >= 0 ? '+' : '−'}${fmt(Math.abs(yearTotalInc - yearTotalExp))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Category ranking */}
                {yearCats.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">Expense Categories (Ranked)</h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b border-gray-200">
                          <th className="text-left pb-2 font-semibold">#</th>
                          <th className="text-left pb-2 font-semibold">Category</th>
                          <th className="text-right pb-2 font-semibold">Total</th>
                          <th className="text-right pb-2 font-semibold">Avg/Month</th>
                          <th className="text-right pb-2 font-semibold">% of Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {yearCats.map(([cat, amt], i) => {
                          const pct = yearTotalExp > 0 ? (amt / yearTotalExp) * 100 : 0
                          return (
                            <tr key={cat} className="border-b border-gray-100">
                              <td className="py-2 text-gray-400 tabular-nums">{i + 1}</td>
                              <td className="py-2 text-gray-800">{cat}</td>
                              <td className="py-2 text-right tabular-nums text-gray-800">${fmt(amt)}</td>
                              <td className="py-2 text-right tabular-nums text-gray-500">${fmt(amt / activeMonths)}</td>
                              <td className="py-2 text-right tabular-nums text-gray-500">{pct.toFixed(1)}%</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {yearTransactions.length === 0 && (
                  <p className="text-center text-gray-400 py-8">No transactions for {yearEndYear}.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── CSV EXPORT ── */}
        {tab === 'csv' && (
          <div className="space-y-5">
            <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 space-y-5">
              <h3 className="text-slate-200 font-semibold">Export Transactions as CSV</h3>

              {/* Date range */}
              <div>
                <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">Date Range</p>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-slate-400 text-sm">From</label>
                    <input
                      type="date"
                      value={csvStart}
                      onChange={(e) => setCsvStart(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-slate-400 text-sm">To</label>
                    <input
                      type="date"
                      value={csvEnd}
                      onChange={(e) => setCsvEnd(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    onClick={fetchCsvData}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {/* Type filter */}
              <div>
                <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">Transaction Type</p>
                <div className="flex gap-2">
                  {(['all', 'expense', 'income'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setCsvType(t)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                        csvType === t
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1) + 's'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category filter */}
              {csvAllCategories.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Categories</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCsvCategories(csvAllCategories)}
                        className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        All
                      </button>
                      <span className="text-slate-700">·</span>
                      <button
                        onClick={() => setCsvCategories([])}
                        className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        None
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {csvAllCategories.map((cat) => {
                      const checked = csvCategories.includes(cat)
                      return (
                        <button
                          key={cat}
                          onClick={() =>
                            setCsvCategories((prev) =>
                              checked ? prev.filter((c) => c !== cat) : [...prev, cat]
                            )
                          }
                          className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                            checked
                              ? 'bg-blue-600/30 border border-blue-500/50 text-blue-300'
                              : 'bg-slate-800 border border-slate-700 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {cat}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Download */}
              <div className="pt-1">
                <button
                  onClick={downloadCSV}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Download CSV
                </button>
                {csvAllCategories.length > 0 && (
                  <p className="text-slate-500 text-xs mt-2">
                    {csvCategories.length} of {csvAllCategories.length} categories selected
                  </p>
                )}
              </div>
            </div>

            {/* Preview note */}
            <p className="text-slate-600 text-xs">
              CSV includes columns: Date, Description, Category, Amount, Type
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
