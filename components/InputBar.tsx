'use client'

import { useState } from 'react'
import type { Category, Transaction, SavingsBucket } from '@/types'

interface Props {
  categories: Category[]
  savingsBuckets: SavingsBucket[]
  onAdd: (t: Omit<Transaction, 'id'>) => Promise<void>
}

const TYPE_OPTIONS = [
  { value: 'expense', label: '− Expense', active: 'bg-red-600', color: 'text-white' },
  { value: 'savings', label: '⇑ Savings', active: 'bg-blue-600', color: 'text-white' },
  { value: 'income', label: '+ Income', active: 'bg-emerald-600', color: 'text-white' },
] as const

type TxType = 'income' | 'expense' | 'savings'

export default function InputBar({ categories, savingsBuckets, onAdd }: Props) {
  const today = () => new Date().toISOString().split('T')[0]

  const [amount, setAmount] = useState('')
  const [type, setType] = useState<TxType>('expense')
  const [category, setCategory] = useState('')
  const [bucketId, setBucketId] = useState<number | ''>('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(today)
  const [submitting, setSubmitting] = useState(false)

  function handleCategoryChange(cat: string) {
    setCategory(cat)
    // Suggest savings type when Savings category is selected (only if currently expense)
    if (cat === 'Savings' && type === 'expense') setType('savings')
  }

  function handleTypeChange(t: TxType) {
    setType(t)
    if (t !== 'savings') setBucketId('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || !category) return
    setSubmitting(true)
    await onAdd({
      amount: parseFloat(amount),
      type,
      category,
      notes,
      date,
      bucket_id: type === 'savings' && bucketId !== '' ? bucketId : null,
    })
    setSubmitting(false)
    setAmount('')
    setCategory('')
    setBucketId('')
    setNotes('')
    setDate(today())
  }

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 shadow-xl">
      <h2 className="text-slate-200 font-semibold text-base mb-4">Add Transaction</h2>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* 3-way type toggle */}
        <div className="flex rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleTypeChange(opt.value)}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors duration-150 ${
                type === opt.value
                  ? `${opt.active} ${opt.color}`
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
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
          onChange={(e) => handleCategoryChange(e.target.value)}
          required
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition"
        >
          <option value="" disabled className="text-slate-500">Select category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>

        {/* Savings bucket selector (only when type=savings) */}
        {type === 'savings' && savingsBuckets.length > 0 && (
          <select
            value={bucketId}
            onChange={(e) => setBucketId(e.target.value ? Number(e.target.value) : '')}
            className="w-full bg-slate-800 border border-blue-700/50 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition"
          >
            <option value="">Assign to bucket (optional)…</option>
            {savingsBuckets.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}

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
