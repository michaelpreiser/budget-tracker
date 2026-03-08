export interface Transaction {
  id: number
  amount: number
  type: 'income' | 'expense'
  category: string
  notes: string
  date: string
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
