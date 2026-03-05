'use client'

export interface TransactionFormData {
  date: Date
  type: 'DEPOSIT' | 'WITHDRAWAL'
  amount: string
  reference: string
  notes: string
}

export interface BankTransactionWithBalance {
  id: string
  date: string | Date
  type: 'DEPOSIT' | 'WITHDRAWAL'
  amount: number | { toString(): string }
  reference: string | null
  notes: string | null
  balance: number
}

export const initialTransactionForm: TransactionFormData = {
  date: new Date(),
  type: 'DEPOSIT',
  amount: '',
  reference: '',
  notes: '',
}
