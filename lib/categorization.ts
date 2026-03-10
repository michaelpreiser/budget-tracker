export interface CategoryRule {
  id: number
  keyword: string
  category: string
  match_count: number
}

/**
 * Strip store numbers, locations, transaction IDs from a bank description
 * to produce a short, reusable keyword.
 *
 * Examples:
 *   "WALMART SUPERCENTER #1234 ATLANTA GA"  → "WALMART"
 *   "AMAZON.COM*AB12CD34"                   → "AMAZON"
 *   "SHELL OIL 57422119800 01234"           → "SHELL"
 *   "NETFLIX.COM"                           → "NETFLIX"
 *   "SQ *COFFEE SHOP"                       → "SQ COFFEE"
 */
export function extractKeyword(description: string): string {
  let s = description.toUpperCase().trim()

  // Remove everything after * (Amazon order codes, Square merchant names kept below)
  s = s.replace(/\*.*$/, '')

  // Remove store/terminal numbers: #1234, #ABC, -1234
  s = s.replace(/\s*[-#]\w+/g, '')

  // Remove common TLDs
  s = s.replace(/\.(COM|NET|ORG|IO|CO|APP|GOV)\b/g, '')

  // Remove trailing US state abbreviation (2 uppercase letters)
  s = s.replace(/\s+[A-Z]{2}\s*$/, '').trim()

  // Remove trailing zip codes
  s = s.replace(/\s+\d{5}(-\d{4})?\s*$/, '').trim()

  // Remove long digit sequences (transaction IDs, account numbers)
  s = s.replace(/\s+\d{4,}/g, '').trim()

  // Remove trailing short digit groups (e.g. terminal " 01")
  s = s.replace(/\s+\d{1,3}\s*$/, '').trim()

  const words = s.split(/\s+/).filter((w) => w.length >= 2 && !/^\d+$/.test(w))

  if (words.length === 0) return description.substring(0, 15).toUpperCase().trim()

  // Very short first words ("SQ", "TST") → keep 2 words for context
  if (words[0].length <= 3 && words.length > 1) return words.slice(0, 2).join(' ')

  return words[0]
}

/**
 * Find the best matching rule for a description.
 * Returns the rule with the longest (most specific) keyword match, or null.
 */
export function applyRules(description: string, rules: CategoryRule[]): CategoryRule | null {
  if (!description || rules.length === 0) return null
  const upper = description.toUpperCase()
  const matches = rules.filter((r) => upper.includes(r.keyword.toUpperCase()))
  if (matches.length === 0) return null
  return matches.reduce((best, r) => (r.keyword.length > best.keyword.length ? r : best))
}
