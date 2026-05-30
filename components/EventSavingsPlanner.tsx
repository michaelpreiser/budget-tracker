'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SavingsEvent {
  id: number
  name: string
  description: string | null
  target_date: string
  target_amount: number
}

interface Deposit {
  id: number
  event_id: number
  amount: number
  date: string
  note: string | null
}

interface Expense {
  id: number
  event_id: number
  amount: number
  date: string
  description: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().split('T')[0]
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / 86400000)
}

function monthsRemaining(dateStr: string): number {
  const days = daysUntil(dateStr)
  return Math.max(1, Math.ceil(days / 30))
}

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function totalDeposits(deposits: Deposit[], eventId: number): number {
  return deposits.filter((d) => d.event_id === eventId).reduce((s, d) => s + Number(d.amount), 0)
}

function totalExpenses(expenses: Expense[], eventId: number): number {
  return expenses.filter((e) => e.event_id === eventId).reduce((s, e) => s + Number(e.amount), 0)
}

function calcMonthlyTarget(ev: SavingsEvent, saved: number): number {
  const remaining = Math.max(0, ev.target_amount - saved)
  const months = monthsRemaining(ev.target_date)
  return remaining / months
}

function calcStatus(ev: SavingsEvent, saved: number): 'complete' | 'on-track' | 'slightly-behind' | 'behind' | 'passed' {
  const days = daysUntil(ev.target_date)
  if (days < 0) return 'passed'
  const pct = ev.target_amount > 0 ? saved / ev.target_amount : 0
  if (pct >= 1) return 'complete'
  const months = monthsRemaining(ev.target_date)
  const totalMonths = monthsRemaining(ev.target_date) + (new Date().getMonth() - new Date(ev.target_date).getMonth())
  const expectedPct = totalMonths > 0 ? (totalMonths - months) / totalMonths : 0
  if (pct >= expectedPct * 0.9) return 'on-track'
  if (pct >= expectedPct * 0.6) return 'slightly-behind'
  return 'behind'
}

const STATUS_STYLES: Record<string, { border: string; badge: string; badgeText: string; bar: string }> = {
  'complete':         { border: 'border-emerald-500/40', badge: 'bg-emerald-500/20 text-emerald-300', badgeText: 'Complete', bar: '#10b981' },
  'on-track':         { border: 'border-emerald-500/30', badge: 'bg-emerald-500/15 text-emerald-400', badgeText: 'On Track', bar: '#10b981' },
  'slightly-behind':  { border: 'border-amber-500/40',   badge: 'bg-amber-500/20 text-amber-300',   badgeText: 'Slightly Behind', bar: '#f59e0b' },
  'behind':           { border: 'border-red-500/40',     badge: 'bg-red-500/20 text-red-300',       badgeText: 'Behind', bar: '#ef4444' },
  'passed':           { border: 'border-slate-600/40',   badge: 'bg-slate-700 text-slate-400',      badgeText: 'Past Due', bar: '#64748b' },
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-slate-100 font-semibold text-base">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none transition-colors">&times;</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Event Form ───────────────────────────────────────────────────────────────

interface EventFormProps {
  initial?: Partial<SavingsEvent>
  onSave: (data: { name: string; description: string; target_date: string; target_amount: number }) => Promise<void>
  onClose: () => void
}

function EventForm({ initial, onSave, onClose }: EventFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [targetDate, setTargetDate] = useState(initial?.target_date ?? '')
  const [targetAmount, setTargetAmount] = useState(initial?.target_amount?.toString() ?? '')
  const [saving, setSaving] = useState(false)

  const months = targetDate ? monthsRemaining(targetDate) : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !targetDate || !targetAmount) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), description: description.trim(), target_date: targetDate, target_amount: Number(targetAmount) })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-slate-400 text-xs mb-1.5">Event Name</label>
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Summer Vacation, Birthday Party…"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500/70 transition-colors"
          required
        />
      </div>
      <div>
        <label className="block text-slate-400 text-xs mb-1.5">Description (optional)</label>
        <input
          value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Add details…"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500/70 transition-colors"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-slate-400 text-xs mb-1.5">Target Date</label>
          <input
            type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
            min={today()}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500/70 transition-colors"
            required
          />
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1.5">Total Amount Needed</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
            <input
              type="number" min="0.01" step="0.01" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-slate-200 text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500/70 transition-colors"
              required
            />
          </div>
        </div>
      </div>
      {months !== null && targetAmount && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-xs text-slate-400">
          Save <span className="text-blue-400 font-medium">${fmt(Number(targetAmount) / months)}/mo</span> for {months} month{months !== 1 ? 's' : ''} to reach your goal
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 text-sm transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
          {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Event'}
        </button>
      </div>
    </form>
  )
}

// ─── Deposit Form ─────────────────────────────────────────────────────────────

function DepositForm({ onSave, onClose }: { onSave: (amount: number, date: string, note: string) => Promise<void>; onClose: () => void }) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || !date) return
    setSaving(true)
    try {
      await onSave(Number(amount), date, note)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-slate-400 text-xs mb-1.5">Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
            <input
              type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-slate-200 text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500/70 transition-colors"
              required autoFocus
            />
          </div>
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1.5">Date</label>
          <input
            type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500/70 transition-colors"
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-slate-400 text-xs mb-1.5">Note (optional)</label>
        <input
          value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Transfer from savings, paycheck deposit…"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500/70 transition-colors"
        />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 text-sm transition-colors">Cancel</button>
        <button type="submit" disabled={saving} className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
          {saving ? 'Logging…' : 'Log Savings'}
        </button>
      </div>
    </form>
  )
}

// ─── Expense Form ─────────────────────────────────────────────────────────────

function ExpenseForm({ onSave, onClose }: { onSave: (amount: number, date: string, description: string) => Promise<void>; onClose: () => void }) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || !date) return
    setSaving(true)
    try {
      await onSave(Number(amount), date, description)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-slate-400 text-xs mb-1.5">Amount Spent</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
            <input
              type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-slate-200 text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500/70 transition-colors"
              required autoFocus
            />
          </div>
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1.5">Date</label>
          <input
            type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500/70 transition-colors"
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-slate-400 text-xs mb-1.5">Description (optional)</label>
        <input
          value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="What was this for?"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500/70 transition-colors"
        />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 text-sm transition-colors">Cancel</button>
        <button type="submit" disabled={saving} className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
          {saving ? 'Logging…' : 'Log Expense'}
        </button>
      </div>
    </form>
  )
}

// ─── Event Card ───────────────────────────────────────────────────────────────

interface EventCardProps {
  ev: SavingsEvent
  deposits: Deposit[]
  expenses: Expense[]
  onRefresh: () => void
}

function EventCard({ ev, deposits, expenses, onRefresh }: EventCardProps) {
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const saved = totalDeposits(deposits, ev.id)
  const spent = totalExpenses(expenses, ev.id)
  const pct = ev.target_amount > 0 ? Math.min(100, (saved / ev.target_amount) * 100) : 0
  const status = calcStatus(ev, saved)
  const style = STATUS_STYLES[status]
  const days = daysUntil(ev.target_date)
  const monthlyTarget = calcMonthlyTarget(ev, saved)
  const evDeposits = deposits.filter((d) => d.event_id === ev.id).sort((a, b) => b.date.localeCompare(a.date))
  const evExpenses = expenses.filter((e) => e.event_id === ev.id).sort((a, b) => b.date.localeCompare(a.date))

  async function handleDeposit(amount: number, date: string, note: string) {
    await fetch(`/api/events/${ev.id}/deposits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, date, note }),
    })
    onRefresh()
  }

  async function handleExpense(amount: number, date: string, description: string) {
    await fetch(`/api/events/${ev.id}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, date, description }),
    })
    onRefresh()
  }

  async function handleDeleteDeposit(depositId: number) {
    await fetch(`/api/events/${ev.id}/deposits/${depositId}`, { method: 'DELETE' })
    onRefresh()
  }

  async function handleDeleteExpense(expenseId: number) {
    await fetch(`/api/events/${ev.id}/expenses`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expenseId }),
    })
    onRefresh()
  }

  async function handleEdit(data: { name: string; description: string; target_date: string; target_amount: number }) {
    await fetch(`/api/events/${ev.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    onRefresh()
  }

  async function handleDelete() {
    if (!confirm(`Delete "${ev.name}"? This cannot be undone.`)) return
    setDeleting(true)
    await fetch(`/api/events/${ev.id}`, { method: 'DELETE' })
    onRefresh()
  }

  const isUrgent = days >= 0 && days <= 30 && status !== 'complete'

  return (
    <>
      <div className={`bg-slate-900 border rounded-2xl p-5 shadow-lg transition-all ${style.border} ${isUrgent ? 'ring-1 ring-amber-500/30' : ''}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-slate-100 font-semibold text-sm">{ev.name}</h3>
              {isUrgent && (
                <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full px-2 py-0.5">Urgent</span>
              )}
              <span className={`text-xs rounded-full px-2 py-0.5 ${style.badge}`}>{style.badgeText}</span>
            </div>
            {ev.description && <p className="text-slate-500 text-xs mt-0.5 truncate">{ev.description}</p>}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => setShowEditModal(true)} className="text-slate-600 hover:text-slate-300 text-xs transition-colors p-1">Edit</button>
            <button onClick={handleDelete} disabled={deleting} className="text-slate-600 hover:text-red-400 text-xs transition-colors p-1">Delete</button>
          </div>
        </div>

        {/* Target date & days */}
        <div className="flex items-center gap-3 mb-4 text-xs text-slate-500">
          <span>Target: {fmtDate(ev.target_date)}</span>
          {days >= 0 ? (
            <span className={days <= 14 ? 'text-red-400' : days <= 30 ? 'text-amber-400' : 'text-slate-500'}>
              {days === 0 ? 'Today!' : `${days} day${days !== 1 ? 's' : ''} away`}
            </span>
          ) : (
            <span className="text-slate-600">{Math.abs(days)} days ago</span>
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-400">Saved: <span className="text-slate-200 font-medium">${fmt(saved)}</span></span>
            <span className="text-slate-400">Goal: <span className="text-slate-200 font-medium">${fmt(ev.target_amount)}</span></span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: style.bar }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-slate-600">{pct.toFixed(0)}% saved</span>
            <span className="text-slate-600">${fmt(Math.max(0, ev.target_amount - saved))} remaining</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-slate-800/60 rounded-xl px-3 py-2 text-center">
            <p className="text-slate-500 text-xs">Monthly Target</p>
            <p className="text-slate-200 text-sm font-medium">${fmt(monthlyTarget)}</p>
          </div>
          <div className="bg-slate-800/60 rounded-xl px-3 py-2 text-center">
            <p className="text-slate-500 text-xs">Months Left</p>
            <p className="text-slate-200 text-sm font-medium">{days >= 0 ? monthsRemaining(ev.target_date) : 0}</p>
          </div>
          <div className="bg-slate-800/60 rounded-xl px-3 py-2 text-center">
            <p className="text-slate-500 text-xs">Spent</p>
            <p className={`text-sm font-medium ${spent > 0 ? 'text-red-400' : 'text-slate-200'}`}>${fmt(spent)}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowDepositModal(true)}
            className="flex-1 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 text-xs font-medium transition-colors"
          >
            + Log Savings
          </button>
          <button
            onClick={() => setShowExpenseModal(true)}
            className="flex-1 py-2 rounded-xl bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 text-red-400 text-xs font-medium transition-colors"
          >
            + Log Expense
          </button>
          {(evDeposits.length > 0 || evExpenses.length > 0) && (
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs transition-colors"
            >
              {showHistory ? 'Hide' : 'History'}
            </button>
          )}
        </div>

        {/* History */}
        {showHistory && (
          <div className="mt-4 space-y-2">
            {evDeposits.length > 0 && (
              <div>
                <p className="text-slate-500 text-xs mb-1.5">Savings Logged</p>
                <div className="space-y-1">
                  {evDeposits.map((d) => (
                    <div key={d.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                        <span className="text-slate-400 text-xs">{fmtDate(d.date)}</span>
                        {d.note && <span className="text-slate-600 text-xs truncate max-w-[120px]">{d.note}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 text-xs font-medium">+${fmt(Number(d.amount))}</span>
                        <button onClick={() => handleDeleteDeposit(d.id)} className="text-slate-700 hover:text-red-400 text-xs transition-colors">×</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {evExpenses.length > 0 && (
              <div>
                <p className="text-slate-500 text-xs mb-1.5">Expenses Logged</p>
                <div className="space-y-1">
                  {evExpenses.map((e) => (
                    <div key={e.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                        <span className="text-slate-400 text-xs">{fmtDate(e.date)}</span>
                        {e.description && <span className="text-slate-600 text-xs truncate max-w-[120px]">{e.description}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-red-400 text-xs font-medium">−${fmt(Number(e.amount))}</span>
                        <button onClick={() => handleDeleteExpense(e.id)} className="text-slate-700 hover:text-red-400 text-xs transition-colors">×</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showDepositModal && (
        <Modal title={`Log Savings — ${ev.name}`} onClose={() => setShowDepositModal(false)}>
          <DepositForm onSave={handleDeposit} onClose={() => setShowDepositModal(false)} />
        </Modal>
      )}
      {showExpenseModal && (
        <Modal title={`Log Expense — ${ev.name}`} onClose={() => setShowExpenseModal(false)}>
          <ExpenseForm onSave={handleExpense} onClose={() => setShowExpenseModal(false)} />
        </Modal>
      )}
      {showEditModal && (
        <Modal title="Edit Event" onClose={() => setShowEditModal(false)}>
          <EventForm initial={ev} onSave={handleEdit} onClose={() => setShowEditModal(false)} />
        </Modal>
      )}
    </>
  )
}

// ─── Past Event Card ──────────────────────────────────────────────────────────

function PastEventCard({ ev, deposits, expenses }: { ev: SavingsEvent; deposits: Deposit[]; expenses: Expense[] }) {
  const saved = totalDeposits(deposits, ev.id)
  const spent = totalExpenses(expenses, ev.id)
  const metGoal = saved >= ev.target_amount
  return (
    <div className="bg-slate-900/50 border border-slate-700/30 rounded-2xl p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-slate-400 text-sm font-medium truncate">{ev.name}</p>
        <p className="text-slate-600 text-xs">{fmtDate(ev.target_date)}</p>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0 text-xs">
        <div className="text-right">
          <p className="text-slate-500">Saved</p>
          <p className="text-slate-300 font-medium">${fmt(saved)}</p>
        </div>
        <div className="text-right">
          <p className="text-slate-500">Spent</p>
          <p className="text-red-400 font-medium">${fmt(spent)}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs ${metGoal ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
          {metGoal ? 'Goal Met' : 'Missed'}
        </span>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EventSavingsPlanner() {
  const [events, setEvents] = useState<SavingsEvent[]>([])
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showPast, setShowPast] = useState(false)

  const fetchAll = useCallback(async () => {
    const res = await fetch('/api/events')
    if (!res.ok) return
    const data = await res.json()
    setEvents(data.events ?? [])
    setDeposits(data.deposits ?? [])
    setExpenses(data.expenses ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleCreate(data: { name: string; description: string; target_date: string; target_amount: number }) {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    fetchAll()
  }

  const activeEvents = events.filter((ev) => daysUntil(ev.target_date) >= 0)
  const pastEvents = events.filter((ev) => daysUntil(ev.target_date) < 0)

  // Summary: total monthly savings needed across all active events
  const totalMonthlyNeeded = activeEvents.reduce((sum, ev) => {
    const saved = totalDeposits(deposits, ev.id)
    return sum + calcMonthlyTarget(ev, saved)
  }, 0)

  const urgentCount = activeEvents.filter((ev) => {
    const days = daysUntil(ev.target_date)
    return days >= 0 && days <= 30 && calcStatus(ev, totalDeposits(deposits, ev.id)) !== 'complete'
  }).length

  if (loading) return null

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-slate-200 font-semibold text-base">Event Savings Planner</h2>
          <p className="text-slate-500 text-xs mt-0.5">One-time savings goals for events &amp; big purchases</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-xl transition-colors"
        >
          <span className="text-base leading-none">+</span> New Event
        </button>
      </div>

      {/* Summary Banner (only when there are active events) */}
      {activeEvents.length > 0 && (
        <div className="bg-slate-900 border border-slate-700/50 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <p className="text-slate-500 text-xs">Active Events</p>
              <p className="text-slate-100 text-xl font-bold">{activeEvents.length}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Monthly Savings Needed</p>
              <p className="text-blue-400 text-xl font-bold">${fmt(totalMonthlyNeeded)}</p>
            </div>
            {urgentCount > 0 && (
              <div>
                <p className="text-slate-500 text-xs">Urgent</p>
                <p className="text-amber-400 text-xl font-bold">{urgentCount}</p>
              </div>
            )}
          </div>
          <p className="text-slate-600 text-xs">Set aside <span className="text-blue-400">${fmt(totalMonthlyNeeded)}/mo</span> total to stay on track</p>
        </div>
      )}

      {/* Active Event Cards */}
      {activeEvents.length === 0 ? (
        <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-10 text-center">
          <p className="text-slate-600 text-sm">No active savings events.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-3 text-blue-400 hover:text-blue-300 text-sm underline underline-offset-2 transition-colors"
          >
            Create your first event
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeEvents.map((ev) => (
            <EventCard key={ev.id} ev={ev} deposits={deposits} expenses={expenses} onRefresh={fetchAll} />
          ))}
        </div>
      )}

      {/* Past Events */}
      {pastEvents.length > 0 && (
        <div>
          <button
            onClick={() => setShowPast((v) => !v)}
            className="text-slate-500 hover:text-slate-300 text-xs flex items-center gap-1.5 transition-colors"
          >
            <span>{showPast ? '▾' : '▸'}</span>
            Past Events ({pastEvents.length})
          </button>
          {showPast && (
            <div className="mt-3 space-y-2">
              {pastEvents.map((ev) => (
                <PastEventCard key={ev.id} ev={ev} deposits={deposits} expenses={expenses} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <Modal title="New Savings Event" onClose={() => setShowCreateModal(false)}>
          <EventForm onSave={handleCreate} onClose={() => setShowCreateModal(false)} />
        </Modal>
      )}
    </div>
  )
}
