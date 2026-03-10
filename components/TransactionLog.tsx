'use client'

import { useState } from 'react'
import type { Category, Transaction } from '@/types'
import { extractKeyword } from '@/lib/categorization'

interface Props {
  transactions: Transaction[]
  categories: Category[]
  onDelete: (id: number) => Promise<void>
  onEdit: (id: number, t: Omit<Transaction, 'id'>) => Promise<void>
  onClearAll: () => Promise<void>
}

function fmtDate(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function TransactionLog({ transactions, categories, onDelete, onEdit, onClearAll }: Props) {
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  // Edit form state
  const [editAmount, setEditAmount] = useState('')
  const [editType, setEditType] = useState<'income' | 'expense'>('expense')
  const [editCategory, setEditCategory] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editDate, setEditDate] = useState('')
  const [saving, setSaving] = useState(false)

  // Inline note editing
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  function startNoteEdit(t: Transaction) {
    setEditingNoteId(t.id)
    setNoteText(t.notes)
  }

  async function saveNote(t: Transaction) {
    setSavingNote(true)
    await onEdit(t.id, { amount: t.amount, type: t.type, category: t.category, notes: noteText, date: t.date })
    setSavingNote(false)
    setEditingNoteId(null)
  }

  function startEdit(t: Transaction) {
    setEditingId(t.id)
    setEditAmount(String(t.amount))
    setEditType(t.type)
    setEditCategory(t.category)
    setEditNotes(t.notes)
    setEditDate(t.date)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleSave(id: number) {
    if (!editAmount || !editCategory || !editDate) return
    setSaving(true)
    await onEdit(id, {
      amount: parseFloat(editAmount),
      type: editType,
      category: editCategory,
      notes: editNotes,
      date: editDate,
    })
    setSaving(false)
    setEditingId(null)
  }

  function saveRule(description: string, category: string) {
    const keyword = extractKeyword(description)
    if (!keyword) return
    fetch('/api/category-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword, category }),
    }).catch(() => {})
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this transaction?')) return
    setDeletingId(id)
    await onDelete(id)
    setDeletingId(null)
  }

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 shadow-xl flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-slate-200 font-semibold text-base">Transaction Log</h2>
        {transactions.length > 0 && (
          <button
            onClick={async () => {
              if (!confirm('Clear all transactions for this month? This cannot be undone.')) return
              await onClearAll()
            }}
            className="text-xs px-2.5 py-1 rounded-lg border border-red-800/60 text-red-500 hover:text-red-300 hover:border-red-600 hover:bg-red-950/40 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {transactions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center min-h-[200px]">
          <p className="text-slate-600 text-sm">No transactions for this month.</p>
        </div>
      ) : (
        <div className="overflow-y-auto max-h-[520px] space-y-1.5 pr-1">
          {transactions.map((t) =>
            editingId === t.id ? (
              /* ── Edit row ── */
              <div
                key={t.id}
                className="rounded-xl bg-slate-800 border border-blue-500/40 p-3 space-y-2"
              >
                {/* Row 1: type toggle + amount + date */}
                <div className="flex gap-2">
                  <div className="flex rounded-lg overflow-hidden border border-slate-700 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditType('expense')}
                      className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                        editType === 'expense'
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      − Exp
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditType('income')}
                      className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                        editType === 'income'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      + Inc
                    </button>
                  </div>
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">$</span>
                    <input
                      type="number"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      step="0.01"
                      min="0.01"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-5 pr-2 py-1.5 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-slate-100 text-xs focus:outline-none focus:border-blue-500 shrink-0"
                  />
                </div>

                {/* Row 2: category + notes */}
                <div className="flex gap-2">
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-slate-100 text-xs focus:outline-none focus:border-blue-500 shrink-0 w-36"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Notes"
                    maxLength={200}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Row 3: save / cancel */}
                <div className="flex gap-2 pt-0.5">
                  <button
                    onClick={cancelEdit}
                    className="flex-1 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-600 hover:border-slate-500 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSave(t.id)}
                    disabled={saving || !editAmount || !editCategory || !editDate}
                    className="flex-1 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              /* ── Normal row ── */
              <div
                key={t.id}
                className="group flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 transition-colors"
              >
                <span className={`h-2 w-2 rounded-full flex-shrink-0 ${t.type === 'income' ? 'bg-emerald-400' : 'bg-red-400'}`} />

                <span className="text-slate-500 text-xs w-[52px] flex-shrink-0 tabular-nums">
                  {fmtDate(t.date)}
                </span>

                {/* Category — inline dropdown, saves on change */}
                <select
                  value={t.category}
                  onChange={(e) => {
                    onEdit(t.id, {
                      amount: t.amount,
                      type: t.type,
                      category: e.target.value,
                      notes: t.notes,
                      date: t.date,
                    })
                    if (t.notes) saveRule(t.notes, e.target.value)
                  }}
                  className="flex-1 min-w-0 bg-transparent text-slate-300 text-sm focus:outline-none cursor-pointer hover:text-slate-100 transition-colors appearance-none truncate"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name} className="bg-slate-800">
                      {c.name}
                    </option>
                  ))}
                </select>

                {editingNoteId === t.id ? (
                  <div className="hidden sm:flex items-center gap-1 flex-1 min-w-0">
                    <input
                      autoFocus
                      type="text"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveNote(t)
                        if (e.key === 'Escape') setEditingNoteId(null)
                      }}
                      placeholder="Add a note…"
                      maxLength={200}
                      className="flex-1 min-w-0 bg-slate-700 border border-blue-500/50 rounded-lg px-2 py-1 text-slate-100 placeholder-slate-500 text-xs focus:outline-none"
                    />
                    <button
                      onClick={() => saveNote(t)}
                      disabled={savingNote}
                      className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 flex-shrink-0"
                    >
                      {savingNote ? '…' : '✓'}
                    </button>
                    <button
                      onClick={() => setEditingNoteId(null)}
                      className="text-xs text-slate-500 hover:text-slate-300 flex-shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startNoteEdit(t)}
                    title={t.notes || 'Add note'}
                    className="hidden sm:block text-xs truncate max-w-[120px] flex-shrink-0 transition-colors text-left"
                  >
                    {t.notes
                      ? <span className="text-slate-500 hover:text-slate-300">{t.notes}</span>
                      : <span className="text-slate-700 hover:text-slate-500 opacity-0 group-hover:opacity-100">+ note</span>
                    }
                  </button>
                )}

                <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${t.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {t.type === 'income' ? '+' : '−'}${t.amount.toFixed(2)}
                </span>

                {/* Edit */}
                <button
                  onClick={() => startEdit(t)}
                  title="Edit"
                  className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-blue-400 transition-all text-sm leading-none flex-shrink-0"
                >
                  ✎
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(t.id)}
                  disabled={deletingId === t.id}
                  title="Delete"
                  className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all text-xl leading-none flex-shrink-0 disabled:opacity-30"
                >
                  ×
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
