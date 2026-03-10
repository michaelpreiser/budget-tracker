'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { Category } from '@/types'
import { applyRules, extractKeyword, type CategoryRule } from '@/lib/categorization'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ParsedRow {
  id: number
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  category: string
  isDuplicate: boolean
  skip: boolean
  matchedByRule: boolean
}

interface Props {
  categories: Category[]
  onImportDone: () => void
}

// ─── Auto-categorization ─────────────────────────────────────────────────────

const CATEGORY_RULES: Array<[RegExp, string]> = [
  // Income signals first so payroll isn't mis-matched below
  [/payroll|direct dep|salary|wages|dividend|interest earned|tax refund|irs|ssdi|ssi/i, 'Income'],
  [/rent|mortgage|lease|hoa/i, 'Rent/Mortgage'],
  [/electric|gas bill|water bill|internet|cable|spectrum|comcast|at&t|verizon|t-?mobile|utility|utilities|phone bill|cox|xfinity/i, 'Utilities'],
  [/grocery|groceries|walmart supercenter|kroger|safeway|whole foods|trader joe|aldi|publix|food lion|sprouts|meijer|heb|wegmans|market|supermarket/i, 'Groceries'],
  [/uber|lyft|transit|metro|mta|bus fare|train|parking|toll|e-?zpass|car wash|dmv|auto insurance/i, 'Transportation'],
  [/gym|planet fitness|la fitness|24 hour|crossfit|ymca|anytime fitness/i, 'Gym'],
  [/restaurant|diner|cafe|coffee|starbucks|mcdonald|burger king|wendy|chick-?fil|taco bell|chipotle|subway|domino|pizza|doordash|grubhub|uber eats|instacart|postmates|eat|dining/i, 'Eating Out'],
  [/supplement|gnc|vitamin|protein|bodybuilding/i, 'Supplements'],
  [/amazon|target|costco|walmart(?! super)|best buy|ebay|etsy|tj maxx|marshalls|gap|old navy|h&m|zara|nike|adidas|clothing|apparel|fashion/i, 'Clothing'],
  [/netflix|spotify|hulu|disney|apple tv|hbo|peacock|paramount|youtube premium|audible|kindle|movie|theater|concert|ticketmaster|stubhub|steam|playstation|xbox/i, 'Entertainment'],
  [/savings|transfer to savings|transfer to investment|brokerage|fidelity|vanguard|robinhood|schwab|401k|ira/i, 'Savings'],
  [/pharmacy|cvs|walgreens|rite aid|hospital|urgent care|doctor|medical|dental|vision|health|optometrist|therapist|prescription/i, 'Health/Medical'],
  [/tuition|college|university|udemy|coursera|skillshare|school|education|student loan|books/i, 'Education'],
]

function autoCategory(description: string, categories: Category[]): string {
  const categoryNames = new Set(categories.map((c) => c.name))
  for (const [pattern, suggested] of CATEGORY_RULES) {
    if (pattern.test(description)) {
      if (categoryNames.has(suggested)) return suggested
      // Fuzzy fallback: find a user category that shares a word with the suggestion
      const words = suggested.toLowerCase().split(/[\s/]+/)
      const fallback = categories.find((c) =>
        words.some((w) => c.name.toLowerCase().includes(w))
      )
      if (fallback) return fallback.name
    }
  }
  return categories.find((c) => c.name === 'Other')?.name ?? categories[0]?.name ?? ''
}

// ─── CSV parsing ──────────────────────────────────────────────────────────────

function parseCSV(raw: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let inQuotes = false
  let row: string[] = []

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    const next = raw[i + 1]
    if (ch === '"') {
      if (inQuotes && next === '"') { field += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      row.push(field.trim()); field = ''
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++
      row.push(field.trim()); field = ''
      if (row.some((c) => c !== '')) rows.push(row)
      row = []
    } else {
      field += ch
    }
  }
  if (field || row.length) { row.push(field.trim()); if (row.some((c) => c)) rows.push(row) }
  return rows
}

interface ColMap {
  date: number
  description: number
  amount?: number
  debit?: number
  credit?: number
}

function detectColumns(headers: string[]): ColMap | null {
  const h = headers.map((s) => s.toLowerCase().replace(/[^a-z0-9]/g, ''))
  const idx = (terms: string[]) => h.findIndex((c) => terms.some((t) => c.includes(t)))

  const dateIdx = idx(['date', 'transdate', 'postdate', 'posteddate'])
  const descIdx = idx(['description', 'desc', 'memo', 'detail', 'payee', 'name', 'narrative', 'particulars'])
  const amtIdx  = idx(['amount', 'amt', 'transactionamount'])
  const debIdx  = idx(['debit', 'withdrawal', 'withdrawals', 'charge', 'dr'])
  const creIdx  = idx(['credit', 'deposit', 'deposits', 'cr'])

  if (dateIdx === -1 || descIdx === -1) return null
  if (amtIdx !== -1) return { date: dateIdx, description: descIdx, amount: amtIdx }
  if (debIdx !== -1 && creIdx !== -1) return { date: dateIdx, description: descIdx, debit: debIdx, credit: creIdx }
  return null
}

function normalizeDate(raw: string): string {
  raw = raw.replace(/^["']|["']$/g, '').trim()
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  // MM/DD/YYYY or MM/DD/YY
  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (mdy) {
    let y = parseInt(mdy[3]); if (y < 100) y += 2000
    return `${y}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`
  }
  // MM-DD-YYYY
  const mdyd = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/)
  if (mdyd) {
    let y = parseInt(mdyd[3]); if (y < 100) y += 2000
    return `${y}-${mdyd[1].padStart(2, '0')}-${mdyd[2].padStart(2, '0')}`
  }
  return raw
}

function parseAmount(raw: string): number {
  if (!raw || raw.trim() === '') return NaN
  const s = raw.replace(/[$,\s]/g, '').replace(/^\((.+)\)$/, '-$1')
  return parseFloat(s)
}

interface CSVTransaction {
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
}

function parseStatement(raw: string): CSVTransaction[] {
  const grid = parseCSV(raw)
  if (grid.length < 2) throw new Error('CSV has fewer than 2 rows')

  // Find the header row — first row where we can detect columns
  let headerIdx = -1
  let colMap: ColMap | null = null
  for (let i = 0; i < Math.min(grid.length, 8); i++) {
    colMap = detectColumns(grid[i])
    if (colMap) { headerIdx = i; break }
  }

  if (headerIdx === -1 || !colMap) {
    throw new Error(
      'Could not identify date, description, and amount columns.\n' +
      'Expected headers like: Date, Description, Amount  (or Debit / Credit).'
    )
  }

  const results: CSVTransaction[] = []
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const row = grid[i]
    const rawDate = row[colMap.date] ?? ''
    const rawDesc = row[colMap.description] ?? ''
    const date = normalizeDate(rawDate)
    if (!date || !rawDesc) continue

    let amount: number
    let type: 'income' | 'expense'

    if (colMap.amount !== undefined) {
      amount = parseAmount(row[colMap.amount] ?? '')
      if (isNaN(amount) || amount === 0) continue
      type = amount > 0 ? 'income' : 'expense'
      amount = Math.abs(amount)
    } else {
      // Separate debit / credit columns
      const debit  = parseAmount(row[colMap.debit!] ?? '')
      const credit = parseAmount(row[colMap.credit!] ?? '')
      const hasDebit  = !isNaN(debit) && debit !== 0
      const hasCredit = !isNaN(credit) && credit !== 0
      if (!hasDebit && !hasCredit) continue
      if (hasCredit && !hasDebit) { amount = Math.abs(credit); type = 'income' }
      else { amount = Math.abs(debit); type = 'expense' }
    }

    results.push({ date, description: rawDesc, amount, type })
  }

  return results
}

// ─── Component ────────────────────────────────────────────────────────────────

let nextId = 0

export default function StatementImport({ categories, onImportDone }: Props) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [importDone, setImportDone] = useState(false)
  const [rules, setRules] = useState<CategoryRule[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/category-rules').then((r) => r.ok ? r.json() : []).then(setRules).catch(() => {})
  }, [])

  // ── file handling ────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a CSV file. Most banks have a "Download as CSV" option in transaction history.')
      return
    }
    setError(null)
    setRows([])
    setImportDone(false)
    setLoading(true)
    setLoadingMsg('Parsing CSV…')

    try {
      const text = await file.text()
      const parsed = parseStatement(text)

      if (parsed.length === 0) {
        setError('No transactions found. Check that your CSV has Date, Description, and Amount columns.')
        return
      }

      setLoadingMsg('Checking for duplicates…')
      const res = await fetch('/api/import-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: parsed }),
      })
      if (!res.ok) throw new Error('Duplicate check failed')
      const checked: (CSVTransaction & { isDuplicate: boolean })[] = await res.json()

      setRows(
        checked.map((t) => {
          const matchedRule = applyRules(t.description, rules)
          const category = matchedRule
            ? matchedRule.category
            : autoCategory(t.description, categories)
          return {
            id: nextId++,
            date: t.date,
            description: t.description,
            amount: t.amount,
            type: t.type,
            category,
            isDuplicate: t.isDuplicate,
            skip: t.isDuplicate,
            matchedByRule: !!matchedRule,
          }
        })
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to process file')
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  // ── row mutations ────────────────────────────────────────────────────────

  const update = useCallback(<K extends keyof ParsedRow>(id: number, key: K, val: ParsedRow[K]) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: val } : r)))
  }, [])

  const toggleAll = useCallback((skip: boolean) => setRows((prev) => prev.map((r) => ({ ...r, skip }))), [])
  const setAllType = useCallback((type: 'income' | 'expense') => setRows((prev) => prev.map((r) => ({ ...r, type }))), [])

  function saveRule(description: string, category: string) {
    const keyword = extractKeyword(description)
    if (!keyword) return
    fetch('/api/category-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword, category }),
    }).then((r) => r.ok ? r.json() : null).then((rule) => {
      if (rule) setRules((prev) => {
        const idx = prev.findIndex((r) => r.id === rule.id)
        return idx >= 0
          ? prev.map((r) => r.id === rule.id ? rule : r)
          : [...prev, rule]
      })
    }).catch(() => {})
  }

  // ── import ───────────────────────────────────────────────────────────────

  async function handleImport() {
    const toImport = rows.filter((r) => !r.skip)
    if (toImport.length === 0) return
    setLoading(true)
    setLoadingMsg(`Importing ${toImport.length} transactions…`)
    try {
      const res = await fetch('/api/transactions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: toImport.map((r) => ({
            amount: r.amount,
            type: r.type,
            category: r.category,
            notes: r.description,
            date: r.date,
          })),
        }),
      })
      if (!res.ok) throw new Error('Import failed')
      setRows([])
      setImportDone(true)
      onImportDone()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }

  // ── derived ──────────────────────────────────────────────────────────────

  const active   = rows.filter((r) => !r.skip)
  const dupeCount = rows.filter((r) => r.isDuplicate && !r.skip).length

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 shadow-xl">
      <h2 className="text-slate-200 font-semibold text-base mb-4">Import Bank Statement (CSV)</h2>

      {/* Drop zone — only shown when no rows loaded */}
      {rows.length === 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !loading && fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-10 px-4 cursor-pointer transition-colors select-none ${
            dragging
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/50'
          }`}
        >
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} />
          {loading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-400 text-sm">{loadingMsg}</span>
            </div>
          ) : (
            <>
              <span className="text-3xl">📊</span>
              <p className="text-slate-300 text-sm font-medium">Drop a bank statement CSV here</p>
              <p className="text-slate-500 text-xs">or click to browse · export CSV from your bank&apos;s transaction history</p>
            </>
          )}
        </div>
      )}

      {/* Success message */}
      {importDone && rows.length === 0 && (
        <div className="mt-3 flex flex-col items-center gap-2">
          <p className="text-emerald-400 text-sm font-medium">Import complete!</p>
          <button
            onClick={() => setImportDone(false)}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Import another file
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-red-400 text-sm mt-3 whitespace-pre-line">{error}</p>
      )}

      {/* ── Preview table ── */}
      {rows.length > 0 && (
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{rows.length} found</span>
              <span className="text-slate-700">·</span>
              <span className="text-emerald-400">{active.length} to import</span>
              {dupeCount > 0 && (
                <>
                  <span className="text-slate-700">·</span>
                  <span className="text-amber-400">{dupeCount} possible duplicate{dupeCount !== 1 ? 's' : ''}</span>
                </>
              )}
            </div>
            <div className="flex gap-2 text-xs shrink-0 flex-wrap justify-end">
              <button onClick={() => setAllType('expense')} className="px-2 py-0.5 rounded-lg bg-red-900/50 text-red-300 hover:bg-red-900 transition-colors font-semibold">All Expense</button>
              <button onClick={() => setAllType('income')} className="px-2 py-0.5 rounded-lg bg-emerald-900/50 text-emerald-300 hover:bg-emerald-900 transition-colors font-semibold">All Income</button>
              <span className="text-slate-700">|</span>
              <button onClick={() => toggleAll(false)} className="text-blue-400 hover:text-blue-300 transition-colors">Select all</button>
              <span className="text-slate-700">|</span>
              <button onClick={() => toggleAll(true)} className="text-slate-400 hover:text-slate-200 transition-colors">Deselect all</button>
              <span className="text-slate-700">|</span>
              <button
                onClick={() => { setRows([]); setError(null) }}
                className="text-red-400 hover:text-red-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-700 divide-y divide-slate-800">
            {rows.map((row) => (
              <div
                key={row.id}
                className={`flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                  row.skip
                    ? 'opacity-40 bg-slate-900'
                    : row.isDuplicate
                    ? 'bg-amber-950/30'
                    : 'bg-slate-800/50'
                }`}
              >
                {/* Skip checkbox */}
                <input
                  type="checkbox"
                  checked={!row.skip}
                  onChange={() => update(row.id, 'skip', !row.skip)}
                  className="accent-blue-500 shrink-0"
                />

                {/* Date */}
                <span className="text-slate-400 shrink-0 w-[88px]">{row.date}</span>

                {/* Description */}
                <input
                  type="text"
                  value={row.description}
                  onChange={(e) => update(row.id, 'description', e.target.value)}
                  className="flex-1 min-w-0 bg-transparent border-b border-transparent hover:border-slate-600 focus:border-blue-500 focus:outline-none text-slate-300 truncate py-0.5 transition-colors"
                  title={row.description}
                />

                {/* Duplicate badge */}
                {row.isDuplicate && !row.skip && (
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300 text-[10px] font-semibold whitespace-nowrap">
                    dupe?
                  </span>
                )}

                {/* Type toggle */}
                <button
                  onClick={() => update(row.id, 'type', row.type === 'expense' ? 'income' : 'expense')}
                  className={`shrink-0 px-2 py-0.5 rounded-lg font-semibold transition-colors ${
                    row.type === 'income'
                      ? 'bg-emerald-900/60 text-emerald-300 hover:bg-emerald-900'
                      : 'bg-red-900/60 text-red-300 hover:bg-red-900'
                  }`}
                >
                  {row.type === 'income' ? '+' : '−'}
                </button>

                {/* Amount */}
                <span
                  className={`shrink-0 tabular-nums w-20 text-right font-semibold ${
                    row.type === 'income' ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  ${row.amount.toFixed(2)}
                </span>

                {/* Rule indicator */}
                {row.matchedByRule && !row.skip && (
                  <span title="Auto-assigned by your saved rules" className="shrink-0 px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 text-[10px] font-semibold">
                    rule
                  </span>
                )}

                {/* Category */}
                <select
                  value={row.category}
                  onChange={(e) => {
                    update(row.id, 'category', e.target.value)
                    update(row.id, 'matchedByRule', false)
                    saveRule(row.description, e.target.value)
                  }}
                  className="shrink-0 bg-slate-700 border border-slate-600 rounded-lg px-1.5 py-0.5 text-slate-200 focus:outline-none focus:border-blue-500 w-32"
                >
                  <option value="" disabled>Category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Action bar */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { setRows([]); setError(null) }}
              className="px-4 py-2.5 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={loading || active.length === 0}
              className="flex-1 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
            >
              {loading
                ? loadingMsg
                : `Confirm & Import ${active.length} Transaction${active.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
