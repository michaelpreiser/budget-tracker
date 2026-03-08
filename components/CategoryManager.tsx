'use client'

import { useState, useRef, useEffect } from 'react'
import type { Category } from '@/types'

interface Props {
  categories: Category[]
  onAdd: (name: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
  onEdit: (id: number, name: string) => Promise<void>
}

export default function CategoryManager({ categories, onAdd, onDelete, onEdit }: Props) {
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  // Per-chip editing state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId !== null) editInputRef.current?.focus()
  }, [editingId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setAdding(true)
    setAddError('')
    try {
      await onAdd(name)
      setNewName('')
    } catch {
      setAddError('Could not add category.')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Remove category "${name}"? Existing transactions will keep their category label.`)) return
    await onDelete(id)
  }

  function startEdit(cat: Category) {
    setEditingId(cat.id)
    setEditName(cat.name)
    setEditError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError('')
  }

  async function saveEdit(id: number) {
    const name = editName.trim()
    if (!name) return
    setEditSaving(true)
    setEditError('')
    try {
      await onEdit(id, name)
      setEditingId(null)
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : 'Could not rename.')
    } finally {
      setEditSaving(false)
    }
  }

  function handleEditKeyDown(e: React.KeyboardEvent, id: number) {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(id) }
    if (e.key === 'Escape') cancelEdit()
  }

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-slate-200 hover:bg-slate-800/50 transition-colors"
      >
        <span className="font-semibold text-sm">Manage Categories</span>
        <span className="text-slate-500 text-xs">{open ? '▲ collapse' : '▼ expand'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-slate-800">
          {/* Add form */}
          <form onSubmit={handleAdd} className="flex gap-2 mt-4 mb-4">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New category name…"
              maxLength={50}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition"
            />
            <button
              type="submit"
              disabled={adding || !newName.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
            >
              Add
            </button>
          </form>
          {addError && <p className="text-red-400 text-xs mb-3">{addError}</p>}

          {/* Category chips */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) =>
              editingId === cat.id ? (
                /* ── Rename mode ── */
                <div key={cat.id} className="flex items-center gap-1 bg-slate-800 border border-blue-500/50 rounded-full px-2 py-1">
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => handleEditKeyDown(e, cat.id)}
                    maxLength={50}
                    className="bg-transparent text-slate-100 text-sm focus:outline-none w-32"
                  />
                  <button
                    onClick={() => saveEdit(cat.id)}
                    disabled={editSaving || !editName.trim()}
                    title="Save"
                    className="text-emerald-400 hover:text-emerald-300 disabled:opacity-40 text-sm leading-none transition-colors px-0.5"
                  >
                    ✓
                  </button>
                  <button
                    onClick={cancelEdit}
                    title="Cancel"
                    className="text-slate-500 hover:text-slate-300 text-base leading-none transition-colors"
                  >
                    ×
                  </button>
                </div>
              ) : (
                /* ── Normal chip ── */
                <div
                  key={cat.id}
                  className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-full px-3 py-1.5 group"
                >
                  <span className="text-slate-300 text-sm">{cat.name}</span>
                  <button
                    onClick={() => startEdit(cat)}
                    title={`Rename ${cat.name}`}
                    className="text-slate-600 hover:text-blue-400 transition-colors text-xs leading-none opacity-0 group-hover:opacity-100"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id, cat.name)}
                    title={`Remove ${cat.name}`}
                    className="text-slate-600 hover:text-red-400 transition-colors text-base leading-none opacity-0 group-hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              )
            )}
          </div>
          {editError && <p className="text-red-400 text-xs mt-2">{editError}</p>}
        </div>
      )}
    </div>
  )
}
