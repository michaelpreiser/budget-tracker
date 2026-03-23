'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import type { Transaction } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PIE_COLORS = [
  '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1',
  '#14b8a6', '#f43f5e',
]

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function currentYM() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmtMonthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

type TooltipPayload = { name: string; value: number; color: string }

function DollarTooltip({
  active, payload, label,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs shadow-xl">
      {label && <p className="text-slate-400 mb-1.5">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="tabular-nums">
          {p.name}: ${fmt(p.value)}
        </p>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const router = useRouter()
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(currentYM)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const cy = new Date().getFullYear()
    const [r1, r2] = await Promise.all([
      fetch(`/api/transactions?year=${cy}`),
      fetch(`/api/transactions?year=${cy - 1}`),
    ])
    if (r1.status === 401) { router.push('/login'); return }
    const [cur, prev] = await Promise.all([
      r1.ok ? r1.json() : [],
      r2.ok ? r2.json() : [],
    ])
    setAllTransactions([...cur, ...prev])
    setLoading(false)
  }, [router])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Derived: 12-month trend ───────────────────────────────────────────────

  const trendData = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - (11 - i))
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    const monthTx = allTransactions.filter((t) => t.date.startsWith(ym))
    return {
      month: label,
      Income: monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      Expenses: monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    }
  })

  // ── Derived: category breakdown for selected month ────────────────────────

  const monthExpenseTx = allTransactions.filter(
    (t) => t.date.startsWith(selectedMonth) && t.type === 'expense'
  )
  const totalMonthExp = monthExpenseTx.reduce((s, t) => s + t.amount, 0)

  const catData = Object.entries(
    monthExpenseTx.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] ?? 0) + t.amount
      return acc
    }, {} as Record<string, number>)
  )
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }))

  // ── Derived: daily spending for selected month ────────────────────────────

  const [ymYear, ymMonth] = selectedMonth.split('-').map(Number)
  const daysInMonth = new Date(ymYear, ymMonth, 0).getDate()

  const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
    const day = String(i + 1).padStart(2, '0')
    return {
      day: i + 1,
      Spent: monthExpenseTx
        .filter((t) => t.date === `${selectedMonth}-${day}`)
        .reduce((s, t) => s + t.amount, 0),
    }
  })

  // ── Derived: avg transaction size by category ─────────────────────────────

  const avgData = Object.entries(
    monthExpenseTx.reduce((acc, t) => {
      if (!acc[t.category]) acc[t.category] = { total: 0, count: 0 }
      acc[t.category].total += t.amount
      acc[t.category].count++
      return acc
    }, {} as Record<string, { total: number; count: number }>)
  )
    .map(([cat, { total, count }]) => ({
      cat: cat.length > 14 ? cat.slice(0, 13) + '…' : cat,
      fullCat: cat,
      Avg: total / count,
      count,
    }))
    .sort((a, b) => b.Avg - a.Avg)

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading insights…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <button
            onClick={() => router.push('/')}
            className="text-slate-400 hover:text-slate-200 transition-colors text-sm"
          >
            ← Dashboard
          </button>
          <h1 className="text-slate-100 font-bold text-base">Insights</h1>
          {/* Month navigator for per-month charts */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              ‹
            </button>
            <span className="text-slate-200 font-medium text-sm min-w-[160px] text-center">
              {fmtMonthLabel(selectedMonth)}
            </span>
            <button
              onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              ›
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* ── 1. Spending Trends ── */}
        <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 shadow-xl">
          <h2 className="text-slate-200 font-semibold text-base mb-0.5">Spending Trends</h2>
          <p className="text-slate-500 text-xs mb-5">Income vs expenses over the last 12 months</p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="month"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={55}
              />
              <Tooltip content={<DollarTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 8 }} />
              <Line
                type="monotone"
                dataKey="Income"
                stroke="#34d399"
                strokeWidth={2}
                dot={{ r: 3, fill: '#34d399', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="Expenses"
                stroke="#f87171"
                strokeWidth={2}
                dot={{ r: 3, fill: '#f87171', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ── 2. Category Breakdown ── */}
        <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 shadow-xl">
          <h2 className="text-slate-200 font-semibold text-base mb-0.5">Spending by Category</h2>
          <p className="text-slate-500 text-xs mb-5">{fmtMonthLabel(selectedMonth)}</p>

          {catData.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-10">
              No expense data for {fmtMonthLabel(selectedMonth)}.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Donut */}
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={catData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                  >
                    {catData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => [`$${fmt(Number(value))}`]}
                    contentStyle={{
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 12,
                      fontSize: 12,
                      color: '#e2e8f0',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Ranked list */}
              <div className="space-y-2.5">
                {catData.map(({ name, value }, i) => {
                  const pct = totalMonthExp > 0 ? (value / totalMonthExp) * 100 : 0
                  return (
                    <div key={name} className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="text-slate-300 text-sm flex-1 truncate">{name}</span>
                      <span className="text-slate-500 text-xs tabular-nums w-9 text-right">
                        {pct.toFixed(0)}%
                      </span>
                      <span className="text-red-400 text-sm font-medium tabular-nums w-24 text-right">
                        −${fmt(value)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── 3. Daily Spending ── */}
        <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 shadow-xl">
          <h2 className="text-slate-200 font-semibold text-base mb-0.5">Daily Spending</h2>
          <p className="text-slate-500 text-xs mb-5">{fmtMonthLabel(selectedMonth)}</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={55}
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [`$${fmt(Number(value))}`, 'Spent']}
                contentStyle={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 12,
                  fontSize: 12,
                  color: '#e2e8f0',
                }}
                labelFormatter={(d) => `Day ${d}`}
              />
              <Bar dataKey="Spent" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── 4. Avg Transaction Size ── */}
        {avgData.length > 0 && (
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 shadow-xl">
            <h2 className="text-slate-200 font-semibold text-base mb-0.5">
              Avg Transaction Size by Category
            </h2>
            <p className="text-slate-500 text-xs mb-5">
              {fmtMonthLabel(selectedMonth)} · hover to see transaction count
            </p>
            <ResponsiveContainer width="100%" height={Math.max(200, avgData.length * 40)}>
              <BarChart
                data={avgData}
                layout="vertical"
                margin={{ top: 5, right: 70, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}`}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="cat"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={110}
                />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, _name: any, props: any) => [
                    `$${fmt(Number(value))} avg · ${props.payload?.count ?? 0} transaction${(props.payload?.count ?? 0) !== 1 ? 's' : ''}`,
                    props.payload?.fullCat ?? '',
                  ]}
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 12,
                    fontSize: 12,
                    color: '#e2e8f0',
                  }}
                  labelFormatter={() => ''}
                />
                <Bar dataKey="Avg" fill="#8b5cf6" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

      </main>
    </div>
  )
}
