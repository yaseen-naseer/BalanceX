import type { CreditTransactionType, BankTransactionType, Prisma } from "@prisma/client"

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

/**
 * Calculate total reload sales from wallet categories
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
