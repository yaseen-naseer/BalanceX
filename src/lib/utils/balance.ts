import type { CreditTransactionType, BankTransactionType, Prisma } from "@prisma/client"
import DecimalLight from "decimal.js-light"

type Decimal = Prisma.Decimal

/**
 * Shared balance calculation utilities.
 * Consolidates duplicate balance calculation logic across the codebase.
 */

/**
 * Credit transaction structure for balance calculation
 */
interface CreditTransactionLike {
  type: CreditTransactionType
  amount: Decimal | number | string
}

/**
 * Calculate outstanding credit balance from a list of transactions.
 * CREDIT_SALE increases balance, SETTLEMENT decreases balance.
 */
export function calculateCreditBalance(transactions: CreditTransactionLike[]): number {
  return transactions.reduce((sum, tx) => {
    const amount = Number(tx.amount)
    if (tx.type === "CREDIT_SALE") {
      return sum + amount
    } else {
      return sum - amount
    }
  }, 0)
}

/**
 * Bank transaction structure for balance calculation
 */
interface BankTransactionLike {
  type: BankTransactionType
  amount: Decimal | number | string
}

/**
 * Calculate bank balance from opening balance and transactions.
 * DEPOSIT increases balance, WITHDRAWAL decreases balance.
 */
export function calculateBankBalanceFromTransactions(
  openingBalance: number,
  transactions: BankTransactionLike[]
): number {
  return transactions.reduce((balance, tx) => {
    const amount = Number(tx.amount)
    if (tx.type === "DEPOSIT") {
      return balance + amount
    } else {
      return balance - amount
    }
  }, openingBalance)
}

/**
 * Calculate running balance after each transaction.
 * Returns array of balances in same order as transactions.
 */
export function calculateRunningBalances(
  openingBalance: number,
  transactions: BankTransactionLike[]
): number[] {
  let balance = openingBalance
  return transactions.map((tx) => {
    const amount = Number(tx.amount)
    if (tx.type === "DEPOSIT") {
      balance += amount
    } else {
      balance -= amount
    }
    return balance
  })
}

/**
 * Wallet reload calculation structure
 */
interface WalletCategoryLike {
  consumerCash: Decimal | number | string
  consumerTransfer: Decimal | number | string
  consumerCredit: Decimal | number | string
  corporateCash: Decimal | number | string
  corporateTransfer: Decimal | number | string
  corporateCredit: Decimal | number | string
}

import { GST_RATE } from "@/lib/constants"

/**
 * @deprecated Use GST_RATE from @/lib/constants instead.
 */
export const RETAIL_RELOAD_GST_RATE = GST_RATE

/**
 * Strip GST from a retail reload sale amount to get the wallet cost.
 * e.g. customer pays 108 MVR → wallet deduction = 100 MVR (108 / 1.08).
 */
export function stripRetailGst(amount: number): number {
  // Use Decimal arithmetic to avoid floating-point rounding errors on financial values
  return new DecimalLight(amount)
    .div(new DecimalLight(1).plus(GST_RATE))
    .toDecimalPlaces(2)
    .toNumber()
}

/**
 * Calculate total reload sales from wallet categories (simple sum, no GST adjustment).
 * @deprecated Use calculateReloadWalletCost for wallet balance calculations.
 */
export function calculateReloadSales(categories: WalletCategoryLike[]): number {
  return categories.reduce(
    (sum, cat) =>
      sum +
      Number(cat.consumerCash) +
      Number(cat.consumerTransfer) +
      Number(cat.consumerCredit) +
      Number(cat.corporateCash) +
      Number(cat.corporateTransfer) +
      Number(cat.corporateCredit),
    0
  )
}

export interface WalletCategoryWithType {
  category: string
  consumerCash: Decimal | number | string | unknown
  consumerTransfer: Decimal | number | string | unknown
  consumerCredit: Decimal | number | string | unknown
  corporateCash: Decimal | number | string | unknown
  corporateTransfer: Decimal | number | string | unknown
  corporateCredit: Decimal | number | string | unknown
}

/**
 * Sum all payment fields for a single category record.
 */
function sumCategoryFields(cat: WalletCategoryWithType): number {
  return (
    Number(cat.consumerCash) +
    Number(cat.consumerTransfer) +
    Number(cat.consumerCredit) +
    Number(cat.corporateCash) +
    Number(cat.corporateTransfer) +
    Number(cat.corporateCredit)
  )
}

/**
 * Calculate the actual wallet cost for reload sales.
 * Retail reload: strips 8% GST (customer pays 108, wallet deduction = 100).
 * Wholesale reload: uses line items' reload amount (amount field), NOT the category grid
 *   (category grid stores cash received for wholesale).
 * @param wholesaleReloadFromLineItems - pre-calculated wholesale reload total from line items
 */
export function calculateReloadWalletCost(
  categories: WalletCategoryWithType[],
  wholesaleReloadFromLineItems?: number
): number {
  let total = 0
  for (const cat of categories) {
    if (cat.category === "WHOLESALE_RELOAD") {
      // Use line item reload sum if provided, otherwise skip (grid has cash amounts)
      if (wholesaleReloadFromLineItems != null) {
        total += wholesaleReloadFromLineItems
      }
      // If not provided, we skip wholesale — caller must provide it
    } else {
      const catTotal = sumCategoryFields(cat)
      if (cat.category === "RETAIL_RELOAD") {
        total += stripRetailGst(catTotal)
      } else {
        total += catTotal
      }
    }
  }
  return new DecimalLight(total).toDecimalPlaces(2).toNumber()
}

