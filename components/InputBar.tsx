'use client'

import { useState } from 'react'
import type { Category, Transaction } from '@/types'

interface Props {
  categories: Category[]
  onAdd: (t: Omit<Transaction, 'id'>) => Promise<void>
}

export default function InputBar({ categories, onAdd }: Props) {
  const today = () => new Date().toISOString().split('T')[0]

  const [amount, setAmount] = useState('')
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(today)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || !category) return
    setSubmitting(true)
    await onAdd({ amount: parseFloat(amount), type, category, notes, date })
    setSubmitting(false)
    setAmount('')
    setCategory('')
    setNotes('')
    setDate(today())
  }

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 shadow-xl">
      <h2 className="text-slate-200 font-semibold text-base mb-4">Add Transaction</h2>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Income / Expense toggle */}
        <div className="relative flex rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
          {/* Sliding pill */}
          <div
            aria-hidden
            className="absolute inset-y-0 w-1/2 rounded-xl"
            style={{
              transform: type === 'income' ? 'translateX(100%)' : 'translateX(0)',
              backgroundColor: type === 'expense' ? '#ef4444' : '#10b981',
              transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`relative z-10 flex-1 py-2.5 text-sm font-semibold transition-colors duration-200 ${
              type === 'expense' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            − Expense
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`relative z-10 flex-1 py-2.5 text-sm font-semibold transition-colors duration-200 ${
              type === 'income' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            + Income
          </button>
        </div>

        {/* Amount */}
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm pointer-events-none">
            $
          </span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0.01"
            required
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-7 pr-3 py-2.5 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition"
          />
        </div>

        {/* Category */}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition"
        >
          <option value="" disabled className="text-slate-500">
            Select category…
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Date */}
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition"
        />

        {/* Notes */}
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          maxLength={200}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition"
        />

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !amount || !category}
          className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-all duration-150 text-sm"
        >
          {submitting ? 'Adding…' : 'Add Entry'}
        </button>
      </form>
    </div>
  )
}
