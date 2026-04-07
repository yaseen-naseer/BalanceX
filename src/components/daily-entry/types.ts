/**
 * Shared types for daily entry components
 */

export type Category = 'DHIRAAGU_BILLS' | 'RETAIL_RELOAD' | 'WHOLESALE_RELOAD' | 'SIM' | 'USIM'
export type CustomerType = 'consumer' | 'corporate'
export type PaymentMethod = 'cash' | 'transfer' | 'credit'

export interface CategoryConfig {
  key: Category
  label: string
  hasQuantity: boolean
}

export interface CustomerTypeConfig {
  key: CustomerType
  label: string
}

export interface PaymentMethodConfig {
  key: PaymentMethod
  label: string
  color: string
}

export interface CategoryData {
  consumerCash: number
  consumerTransfer: number
  consumerCredit: number
  corporateCash: number
  corporateTransfer: number
  corporateCredit: number
  quantity: number
}

export interface CashDrawerData {
  opening: number
  bankDeposits: number
  closingActual: number
}

export interface WalletData {
  opening: number
  closingActual: number
}

export interface LocalEntryData {
  categories: Record<Category, CategoryData>
  cashDrawer: CashDrawerData
  wallet: WalletData
  notes: string
}

export interface TotalsData {
  totalCash: number
  totalTransfer: number
  totalCredit: number
  totalRevenue: number
  consumerTotal: number
  corporateTotal: number
}

export interface VarianceData {
  cashExpected: number
  cashVariance: number
  walletExpected: number
  walletVariance: number
}

/**
 * Static configuration constants
 */
export const CATEGORIES: CategoryConfig[] = [
  { key: 'DHIRAAGU_BILLS', label: 'Dhiraagu Bills', hasQuantity: false },
  { key: 'RETAIL_RELOAD', label: 'Retail Reload', hasQuantity: false },
  { key: 'WHOLESALE_RELOAD', label: 'Wholesale Reload', hasQuantity: false },
  { key: 'SIM', label: 'SIM', hasQuantity: true },
  { key: 'USIM', label: 'USIM', hasQuantity: true },
]

export const CUSTOMER_TYPES: CustomerTypeConfig[] = [
  { key: 'consumer', label: 'Consumer' },
  { key: 'corporate', label: 'Corporate' },
]

export const PAYMENT_METHODS: PaymentMethodConfig[] = [
  { key: 'cash', label: 'Cash', color: 'text-emerald-600' },
  { key: 'transfer', label: 'Transfer', color: 'text-blue-600' },
  { key: 'credit', label: 'Credit', color: 'text-amber-600' },
]

/**
 * Validation thresholds — re-exported from shared constants for backward compatibility
 */
export { CASH_VARIANCE_THRESHOLD as VARIANCE_THRESHOLD } from "@/lib/constants"
