'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Category } from '@/types'
import type { CategoryRule } from '@/lib/categorization'

interface Props {
  categories: Category[]
}

export default function CategoryRules({ categories }: Props) {
  const [open, setOpen] = useState(false)
  const [rules, setRules] = useState<CategoryRule[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editCategory, setEditCategory] = useState('')

  const fetchRules = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/category-rules')
    if (r.ok) setRules(await r.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    if (open && rules.length === 0 && !loading) fetchRules()
  }, [open, rules.length, loading, fetchRules])

  async function handleCategoryChange(rule: CategoryRule, category: string) {
    setEditingId(null)
    setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, category } : r))
    await fetch(`/api/category-rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    })
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this rule?')) return
    setRules((prev) => prev.filter((r) => r.id !== id))
    await fetch(`/api/category-rules/${id}`, { method: 'DELETE' })
  }

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 shadow-xl">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between group"
      >
        <div className="text-left">
          <h2 className="text-slate-200 font-semibold text-base">Category Rules</h2>
          {!open && (
            <p className="text-slate-500 text-xs mt-0.5">
              Keywords auto-assigned when importing transactions.
            </p>
          )}
        </div>
        <span className="text-slate-500 text-sm group-hover:text-slate-300 transition-colors">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {!open ? null : loading ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rules.length === 0 ? (
        <p className="text-slate-600 text-sm text-center py-6">
          No rules yet. Change a transaction&apos;s category to create one automatically.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-700/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left text-slate-500 text-xs font-medium uppercase tracking-wider px-4 py-2.5">Keyword</th>
                <th className="text-left text-slate-500 text-xs font-medium uppercase tracking-wider px-4 py-2.5">Category</th>
                <th className="text-right text-slate-500 text-xs font-medium uppercase tracking-wider px-4 py-2.5">Used</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-slate-300 text-xs bg-slate-800 px-2 py-0.5 rounded">
                      {rule.keyword}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {editingId === rule.id ? (
                      <select
                        autoFocus
                        value={editCategory}
                        onChange={(e) => handleCategoryChange(rule, e.target.value)}
                        onBlur={() => setEditingId(null)}
                        className="bg-slate-700 border border-blue-500/50 rounded-lg px-2 py-1 text-slate-100 text-xs focus:outline-none"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => { setEditingId(rule.id); setEditCategory(rule.category) }}
                        className="text-slate-300 hover:text-blue-400 transition-colors text-left"
                      >
                        {rule.category}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 text-xs">
                    {rule.match_count}×
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleDelete(rule.id)}
                      title="Delete rule"
                      className="text-slate-600 hover:text-red-400 transition-colors text-lg leading-none"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
