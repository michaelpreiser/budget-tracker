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

// Header-based detection — tries to match column names
function detectColumnsByHeader(headers: string[]): ColMap | null {
  // Strip all non-alphanumeric for fuzzy matching
  const h = headers.map((s) => s.toLowerCase().replace(/[^a-z0-9]/g, ''))
  const idx = (terms: string[]) => h.findIndex((c) => terms.some((t) => c === t || c.includes(t)))

  const dateIdx = idx([
    'date', 'transactiondate', 'transdate', 'postdate', 'posteddate',
    'postingdate', 'settledate', 'settlementdate', 'valuedate',
  ])
  const descIdx = idx([
    'description', 'fulldescription', 'transactiondescription', 'desc',
    'memo', 'detail', 'payee', 'name', 'narrative', 'particulars',
    'merchantname', 'merchant', 'reference',
  ])
  const amtIdx = idx(['amount', 'amt', 'transactionamount', 'txnamount'])
  const debIdx = idx(['debit', 'debitamount', 'withdrawal', 'withdrawals', 'charge', 'dr'])
  const creIdx = idx(['credit', 'creditamount', 'deposit', 'deposits', 'cr'])

  if (dateIdx === -1 || descIdx === -1) return null
  if (amtIdx !== -1) return { date: dateIdx, description: descIdx, amount: amtIdx }
  if (debIdx !== -1 && creIdx !== -1) return { date: dateIdx, description: descIdx, debit: debIdx, credit: creIdx }
  // Single debit-only column (charge cards)
  if (debIdx !== -1) return { date: dateIdx, description: descIdx, amount: debIdx }
  return null
}

function parseAmount(raw: string): number {
  if (!raw || raw.trim() === '') return NaN
  const s = raw.replace(/[$,\s]/g, '').replace(/^\((.+)\)$/, '-$1')
  return parseFloat(s)
}

// Data-pattern detection — for headerless CSVs like Wells Fargo
function detectColumnsByData(grid: string[][]): ColMap | null {
  const sample = grid.slice(0, Math.min(10, grid.length))
  const numCols = Math.max(...sample.map((r) => r.length), 0)
  if (numCols < 2) return null

  let dateIdx = -1, amtIdx = -1, descIdx = -1
  let bestDate = 0, bestAmt = 0, bestDesc = 0

  for (let c = 0; c < numCols; c++) {
    const vals = sample.map((r) => (r[c] ?? '').trim()).filter(Boolean)
    if (vals.length < 2) continue

    const dateFrac = vals.filter((v) =>
      /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(v) || /^\d{4}-\d{2}-\d{2}$/.test(v)
    ).length / vals.length

    const amtFrac = vals.filter((v) => !isNaN(parseAmount(v))).length / vals.length

    const textFrac = vals.filter((v) => /[a-zA-Z]{3,}/.test(v)).length / vals.length
    const avgLen = vals.reduce((s, v) => s + v.length, 0) / vals.length
    const descScore = textFrac * Math.min(avgLen / 8, 3)

    if (dateFrac >= 0.6 && dateFrac > bestDate) { bestDate = dateFrac; dateIdx = c }
    if (amtFrac >= 0.6 && amtFrac > bestAmt && c !== dateIdx) { bestAmt = amtFrac; amtIdx = c }
    if (descScore > bestDesc && c !== dateIdx) { bestDesc = descScore; descIdx = c }
  }

  if (dateIdx === -1 || amtIdx === -1 || descIdx === -1 || amtIdx === descIdx) return null
  return { date: dateIdx, description: descIdx, amount: amtIdx }
}

function normalizeDate(raw: string): string {
  raw = raw.replace(/^["']|["']$/g, '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (mdy) {
    let y = parseInt(mdy[3]); if (y < 100) y += 2000
    return `${y}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`
  }
  const mdyd = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/)
  if (mdyd) {
    let y = parseInt(mdyd[3]); if (y < 100) y += 2000
    return `${y}-${mdyd[1].padStart(2, '0')}-${mdyd[2].padStart(2, '0')}`
  }
  return raw
}

interface CSVTransaction {
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
}

// Pure row builder — given a detected colMap and the start row
function buildTransactions(grid: string[][], startIdx: number, colMap: ColMap): CSVTransaction[] {
  const results: CSVTransaction[] = []
  for (let i = startIdx; i < grid.length; i++) {
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
      const debit  = parseAmount(row[colMap.debit!]  ?? '')
      const credit = parseAmount(row[colMap.credit!] ?? '')
      const hasDebit  = !isNaN(debit)  && debit  !== 0
      const hasCredit = !isNaN(credit) && credit !== 0
      if (!hasDebit && !hasCredit) continue
      if (hasCredit && !hasDebit) { amount = Math.abs(credit); type = 'income' }
      else { amount = Math.abs(debit); type = 'expense' }
    }

    results.push({ date, description: rawDesc, amount, type })
  }
  return results
}

// ─── Column detection pipeline ────────────────────────────────────────────────

interface DetectResult {
  colMap: ColMap
  headerIdx: number  // -1 means no header row (data starts at row 0)
}

function detectColumns(grid: string[][]): DetectResult | null {
  // 1. Header-based: scan first 10 rows for recognisable column names
  for (let i = 0; i < Math.min(grid.length, 10); i++) {
    const colMap = detectColumnsByHeader(grid[i])
    if (colMap) return { colMap, headerIdx: i }
  }

  // 2. Data-pattern: headerless CSVs (Wells Fargo, etc.)
  const colMap = detectColumnsByData(grid)
  if (colMap) return { colMap, headerIdx: -1 }

  return null
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

  // Manual column mapping state (fallback when auto-detect fails)
  const [pendingGrid, setPendingGrid] = useState<string[][] | null>(null)
  const [manualDate, setManualDate] = useState('')
  const [manualDesc, setManualDesc] = useState('')
  const [manualAmt, setManualAmt] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/category-rules').then((r) => r.ok ? r.json() : []).then(setRules).catch(() => {})
  }, [])

  // ── process parsed transactions ──────────────────────────────────────────

  async function processTransactions(parsed: CSVTransaction[]) {
    if (parsed.length === 0) {
      setError('No transactions found. Check that the correct columns are selected.')
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
  }

  // ── file handling ────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a CSV file. Most banks have a "Download as CSV" option in transaction history.')
      return
    }
    setError(null)
    setRows([])
    setPendingGrid(null)
    setImportDone(false)
    setLoading(true)
    setLoadingMsg('Parsing CSV…')

    try {
      const text = await file.text()
      const grid = parseCSV(text)
      if (grid.length < 2) throw new Error('CSV has fewer than 2 rows')

      const detected = detectColumns(grid)

      if (!detected) {
        // Fall back to manual mapping UI
        setPendingGrid(grid)
        setLoading(false)
        setLoadingMsg('')
        return
      }

      const { colMap, headerIdx } = detected
      const parsed = buildTransactions(grid, headerIdx + 1, colMap)
      await processTransactions(parsed)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to process file')
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }

  // ── manual mapping apply ─────────────────────────────────────────────────

  async function handleManualParse() {
    if (!pendingGrid || manualDate === '' || manualDesc === '' || manualAmt === '') return
    setError(null)
    setLoading(true)
    setLoadingMsg('Parsing with selected columns…')
    try {
      const colMap: ColMap = {
        date: parseInt(manualDate),
        description: parseInt(manualDesc),
        amount: parseInt(manualAmt),
      }
      // Skip row 0 if it looks like a header (non-numeric in all chosen columns)
      const firstRow = pendingGrid[0]
      const firstIsHeader = isNaN(parseAmount(firstRow[colMap.amount!] ?? '')) &&
        normalizeDate(firstRow[colMap.date] ?? '') === (firstRow[colMap.date] ?? '').trim()
      const startIdx = firstIsHeader ? 1 : 0
      const parsed = buildTransactions(pendingGrid, startIdx, colMap)
      await processTransactions(parsed)
      setPendingGrid(null)
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
        return idx >= 0 ? prev.map((r) => r.id === rule.id ? rule : r) : [...prev, rule]
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

  const active    = rows.filter((r) => !r.skip)
  const dupeCount = rows.filter((r) => r.isDuplicate && !r.skip).length

  // Column labels for manual mapping UI
  const colLabels = pendingGrid
    ? (pendingGrid[0] ?? []).map((h, i) =>
        h && h.length < 40 && /[a-zA-Z]/.test(h)
          ? `${i + 1}: ${h}`
          : `Column ${i + 1}`
      )
    : []
  const manualReady = manualDate !== '' && manualDesc !== '' && manualAmt !== '' &&
    manualDate !== manualDesc && manualDate !== manualAmt && manualDesc !== manualAmt

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 shadow-xl">
      <h2 className="text-slate-200 font-semibold text-base mb-4">Import Bank Statement (CSV)</h2>

      {/* Drop zone */}
      {rows.length === 0 && !pendingGrid && (
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

      {/* ── Manual column mapping UI ── */}
      {pendingGrid && rows.length === 0 && (
        <div className="space-y-4">
          <div className="rounded-xl bg-amber-950/40 border border-amber-700/40 px-4 py-3">
            <p className="text-amber-300 text-sm font-medium">Couldn&apos;t auto-detect columns</p>
            <p className="text-amber-400/70 text-xs mt-0.5">
              Select which column contains each field below, then click Parse.
            </p>
          </div>

          {/* Preview of raw CSV */}
          <div className="overflow-x-auto rounded-xl border border-slate-700 text-xs">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/60">
                  {(pendingGrid[0] ?? []).map((_, i) => (
                    <th key={i} className="px-3 py-2 text-left text-slate-500 font-medium whitespace-nowrap">
                      Col {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pendingGrid.slice(0, 4).map((row, ri) => (
                  <tr key={ri} className="border-b border-slate-800/50 last:border-0">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-1.5 text-slate-400 whitespace-nowrap max-w-[160px] truncate">
                        {cell || <span className="text-slate-700">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Column assignment dropdowns */}
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                { label: 'Date column', value: manualDate, set: setManualDate, colour: 'border-blue-500/50' },
                { label: 'Description column', value: manualDesc, set: setManualDesc, colour: 'border-emerald-500/50' },
                { label: 'Amount column', value: manualAmt, set: setManualAmt, colour: 'border-red-500/50' },
              ] as const
            ).map(({ label, value, set, colour }) => (
              <div key={label}>
                <p className="text-slate-500 text-xs mb-1">{label}</p>
                <select
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className={`w-full bg-slate-800 border ${colour} rounded-lg px-2 py-1.5 text-slate-200 text-xs focus:outline-none`}
                >
                  <option value="" disabled>Select…</option>
                  {colLabels.map((lbl, i) => (
                    <option key={i} value={String(i)}>{lbl}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { setPendingGrid(null); setError(null) }}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleManualParse}
              disabled={!manualReady || loading}
              className="flex-1 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
            >
              {loading ? loadingMsg : 'Parse with these columns'}
            </button>
          </div>
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
              <button onClick={() => { setRows([]); setError(null) }} className="text-red-400 hover:text-red-300 transition-colors">Cancel</button>
            </div>
          </div>

          {/* Table */}
          <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-700 divide-y divide-slate-800">
            {rows.map((row) => (
              <div
                key={row.id}
                className={`flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                  row.skip ? 'opacity-40 bg-slate-900' : row.isDuplicate ? 'bg-amber-950/30' : 'bg-slate-800/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={!row.skip}
                  onChange={() => update(row.id, 'skip', !row.skip)}
                  className="accent-blue-500 shrink-0"
                />
                <span className="text-slate-400 shrink-0 w-[88px]">{row.date}</span>
                <input
                  type="text"
                  value={row.description}
                  onChange={(e) => update(row.id, 'description', e.target.value)}
                  className="flex-1 min-w-0 bg-transparent border-b border-transparent hover:border-slate-600 focus:border-blue-500 focus:outline-none text-slate-300 truncate py-0.5 transition-colors"
                  title={row.description}
                />
                {row.isDuplicate && !row.skip && (
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300 text-[10px] font-semibold whitespace-nowrap">
                    dupe?
                  </span>
                )}
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
                <span className={`shrink-0 tabular-nums w-20 text-right font-semibold ${row.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                  ${row.amount.toFixed(2)}
                </span>
                {row.matchedByRule && !row.skip && (
                  <span title="Auto-assigned by your saved rules" className="shrink-0 px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 text-[10px] font-semibold">
                    rule
                  </span>
                )}
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
              {loading ? loadingMsg : `Confirm & Import ${active.length} Transaction${active.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
