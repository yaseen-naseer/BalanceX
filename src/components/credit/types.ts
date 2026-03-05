'use client'

export interface NewCustomerFormData {
  name: string
  phone: string
  email: string
  type: 'CONSUMER' | 'CORPORATE'
  creditLimit: string
}

export interface SettlementFormData {
  amount: string
  paymentMethod: 'CASH' | 'TRANSFER'
  reference: string
  notes: string
}

export interface CreditTransaction {
  id: string
  type: 'CREDIT_SALE' | 'SETTLEMENT'
  amount: number
  balanceAfter: number
  date: string
  paymentMethod: string | null
  reference: string | null
  notes: string | null
  user?: { id: string; name: string }
}

export interface CustomerWithTransactions {
  id: string
  name: string
  phone: string | null
  email: string | null
  type: 'CONSUMER' | 'CORPORATE'
  creditLimit: number | null
  outstandingBalance: number
  transactions: CreditTransaction[]
}

export const initialCustomerForm: NewCustomerFormData = {
  name: '',
  phone: '',
  email: '',
  type: 'CONSUMER',
  creditLimit: '',
}

export const initialSettlementForm: SettlementFormData = {
  amount: '',
  paymentMethod: 'TRANSFER',
  reference: '',
  notes: '',
}
