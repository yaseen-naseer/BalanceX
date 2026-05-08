import { describe, expect, it } from "vitest"
import {
  calculateBankBalanceFromTransactions,
  calculateRunningBalances,
  calculateCreditBalance,
  stripRetailGst,
  calculateReloadWalletCost,
} from "./balance"

describe("calculateBankBalanceFromTransactions", () => {
  it("returns opening balance when no transactions", () => {
    expect(calculateBankBalanceFromTransactions(1000, [])).toBe(1000)
  })

  it("adds deposits and subtracts withdrawals", () => {
    const txs = [
      { type: "DEPOSIT" as const, amount: 500 },
      { type: "WITHDRAWAL" as const, amount: 200 },
      { type: "DEPOSIT" as const, amount: 100 },
    ]
    expect(calculateBankBalanceFromTransactions(1000, txs)).toBe(1400)
  })

  it("handles string and Decimal-like amounts", () => {
    const txs = [
      { type: "DEPOSIT" as const, amount: "250.50" },
      { type: "WITHDRAWAL" as const, amount: 100 },
    ]
    expect(calculateBankBalanceFromTransactions(0, txs)).toBe(150.5)
  })

  it("can go negative (overdraft)", () => {
    const txs = [{ type: "WITHDRAWAL" as const, amount: 1500 }]
    expect(calculateBankBalanceFromTransactions(1000, txs)).toBe(-500)
  })
})

describe("calculateRunningBalances", () => {
  it("returns balances in the same order as inputs", () => {
    const txs = [
      { type: "DEPOSIT" as const, amount: 100 },
      { type: "DEPOSIT" as const, amount: 200 },
      { type: "WITHDRAWAL" as const, amount: 50 },
    ]
    expect(calculateRunningBalances(0, txs)).toEqual([100, 300, 250])
  })

  it("returns empty array for empty input", () => {
    expect(calculateRunningBalances(500, [])).toEqual([])
  })
})

describe("calculateCreditBalance", () => {
  it("CREDIT_SALE adds, SETTLEMENT subtracts", () => {
    const txs = [
      { type: "CREDIT_SALE" as const, amount: 1000 },
      { type: "SETTLEMENT" as const, amount: 400 },
      { type: "CREDIT_SALE" as const, amount: 200 },
    ]
    expect(calculateCreditBalance(txs)).toBe(800)
  })

  it("returns 0 for fully-settled customer", () => {
    const txs = [
      { type: "CREDIT_SALE" as const, amount: 500 },
      { type: "SETTLEMENT" as const, amount: 500 },
    ]
    expect(calculateCreditBalance(txs)).toBe(0)
  })
})

describe("stripRetailGst", () => {
  it("strips 8% GST from a retail reload amount", () => {
    // 108 / 1.08 = 100
    expect(stripRetailGst(108)).toBe(100)
  })

  it("rounds to 2 decimal places", () => {
    // 100 / 1.08 = 92.5925... → 92.59
    expect(stripRetailGst(100)).toBe(92.59)
  })

  it("returns 0 for 0", () => {
    expect(stripRetailGst(0)).toBe(0)
  })
})

describe("calculateReloadWalletCost", () => {
  it("strips GST for RETAIL_RELOAD", () => {
    const cats = [
      {
        category: "RETAIL_RELOAD",
        consumerCash: 108,
        consumerTransfer: 0,
        consumerCredit: 0,
        corporateCash: 0,
        corporateTransfer: 0,
        corporateCredit: 0,
      },
    ]
    expect(calculateReloadWalletCost(cats)).toBe(100)
  })

  it("uses provided wholesale total instead of grid for WHOLESALE_RELOAD", () => {
    const cats = [
      {
        category: "WHOLESALE_RELOAD",
        consumerCash: 999, // grid contains cash, not reload value — must be ignored
        consumerTransfer: 0,
        consumerCredit: 0,
        corporateCash: 0,
        corporateTransfer: 0,
        corporateCredit: 0,
      },
    ]
    expect(calculateReloadWalletCost(cats, 500)).toBe(500)
  })

  it("skips WHOLESALE_RELOAD when no override is provided", () => {
    const cats = [
      {
        category: "WHOLESALE_RELOAD",
        consumerCash: 999,
        consumerTransfer: 0,
        consumerCredit: 0,
        corporateCash: 0,
        corporateTransfer: 0,
        corporateCredit: 0,
      },
    ]
    expect(calculateReloadWalletCost(cats)).toBe(0)
  })

  it("combines retail (GST stripped) + wholesale (from line items)", () => {
    const cats = [
      {
        category: "RETAIL_RELOAD",
        consumerCash: 108,
        consumerTransfer: 216,
        consumerCredit: 0,
        corporateCash: 0,
        corporateTransfer: 0,
        corporateCredit: 0,
      },
      {
        category: "WHOLESALE_RELOAD",
        consumerCash: 0,
        consumerTransfer: 0,
        consumerCredit: 0,
        corporateCash: 0,
        corporateTransfer: 0,
        corporateCredit: 0,
      },
    ]
    // 324 / 1.08 = 300, plus wholesale 500 = 800
    expect(calculateReloadWalletCost(cats, 500)).toBe(800)
  })
})
