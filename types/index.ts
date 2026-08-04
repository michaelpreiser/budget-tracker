export interface Transaction {
  id: number
  amount: number
  type: 'income' | 'expense' | 'savings'
  category: string
  notes: string
  date: string
  bucket_id?: number | null
}

export interface Category {
  id: number
  name: string
}

export interface Budget {
  id?: number
  category: string
  amount: number | null
  percentage: number | null
  input_mode: 'amount' | 'percentage'
  is_goal?: boolean
}

export interface SavingsBucket {
  id: number
  name: string
  goal_amount: number | null
  starting_balance: number
  created_at: string
}

export interface BucketAssignment {
  category: string
  bucket: 'needs' | 'wants' | 'savings'
}

export interface UserSettings {
  needs_pct: number
  wants_pct: number
  savings_pct: number
  include_savings_in_discretionary: boolean
}

export interface SavingsSuballocation {
  id: number
  name: string
  pct: number
}
