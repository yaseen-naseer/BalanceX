import { prisma } from "@/lib/db"
import type { TxClient } from "@/lib/utils/atomic"

export interface CustomerOutstanding {
  customerId: string
  customerName: string
  customerType: "CONSUMER" | "CORPORATE"
  outstanding: number
  creditLimit: number | null
  limitUsedPercentage: number | null
  lastActivityDate: Date | null
}

export interface CreditSummary {
  totalOutstanding: number
  consumerOutstanding: number
  corporateOutstanding: number
  customerCount: number
  consumerCount: number
  corporateCount: number
  overdueCustomers: number // > 30 days
}

export async function calculateCustomerOutstanding(
  customerId: string,
  tx?: TxClient
): Promise<number> {
  const db = tx ?? prisma
  const transactions = await db.creditTransaction.findMany({
    where: { customerId },
  })

  // D11: Use .toNumber() — idiomatic for Prisma Decimal; safe for MVR amounts < 1M
  return transactions.reduce((sum, txn) => {
    if (txn.type === "CREDIT_SALE") {
      return sum + txn.amount.toNumber()
    } else {
      return sum - txn.amount.toNumber()
    }
  }, 0)
}

export async function getAllCustomerOutstandings(): Promise<CustomerOutstanding[]> {
  // D2: Include transactions in initial query to eliminate N+1
  const customers = await prisma.creditCustomer.findMany({
    where: { isActive: true },
    include: {
      transactions: {
        orderBy: { createdAt: "desc" },
      },
    },
  })

  return customers.map((customer) => {
    const outstanding = customer.transactions.reduce((sum, tx) => {
      if (tx.type === "CREDIT_SALE") {
        return sum + tx.amount.toNumber()
      } else {
        return sum - tx.amount.toNumber()
      }
    }, 0)

    const creditLimit = customer.creditLimit ? customer.creditLimit.toNumber() : null
    const limitUsedPercentage =
      creditLimit && creditLimit > 0 ? (outstanding / creditLimit) * 100 : null

    return {
      customerId: customer.id,
      customerName: customer.name,
      customerType: customer.type,
      outstanding,
      creditLimit,
      limitUsedPercentage,
      lastActivityDate: customer.transactions[0]?.date || null,
    }
  })
}

export async function getCreditSummary(): Promise<CreditSummary> {
  const customerOutstandings = await getAllCustomerOutstandings()

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  let totalOutstanding = 0
  let consumerOutstanding = 0
  let corporateOutstanding = 0
  let consumerCount = 0
  let corporateCount = 0
  let overdueCustomers = 0

  for (const customer of customerOutstandings) {
    if (customer.outstanding > 0) {
      totalOutstanding += customer.outstanding

      if (customer.customerType === "CONSUMER") {
        consumerOutstanding += customer.outstanding
        consumerCount++
      } else {
        corporateOutstanding += customer.outstanding
        corporateCount++
      }

      // Check if overdue
      if (
        customer.lastActivityDate &&
        customer.lastActivityDate < thirtyDaysAgo
      ) {
        overdueCustomers++
      }
    }
  }

  return {
    totalOutstanding,
    consumerOutstanding,
    corporateOutstanding,
    customerCount: consumerCount + corporateCount,
    consumerCount,
    corporateCount,
    overdueCustomers,
  }
}

export interface CreditLimitCheck {
  allowed: boolean
  requiresOverride: boolean
  currentOutstanding: number
  creditLimit: number | null
  newTotal: number
  exceedsBy: number
}

export async function checkCreditLimit(
  customerId: string,
  newAmount: number
): Promise<CreditLimitCheck> {
  const customer = await prisma.creditCustomer.findUnique({
    where: { id: customerId },
  })

  if (!customer) {
    throw new Error("Customer not found")
  }

  const currentOutstanding = await calculateCustomerOutstanding(customerId)
  const newTotal = currentOutstanding + newAmount
  const creditLimit = customer.creditLimit ? customer.creditLimit.toNumber() : null

  if (!creditLimit) {
    return {
      allowed: true,
      requiresOverride: false,
      currentOutstanding,
      creditLimit: null,
      newTotal,
      exceedsBy: 0,
    }
  }

  if (newTotal > creditLimit) {
    return {
      allowed: false,
      requiresOverride: true, // Owner can override
      currentOutstanding,
      creditLimit,
      newTotal,
      exceedsBy: newTotal - creditLimit,
    }
  }

  return {
    allowed: true,
    requiresOverride: false,
    currentOutstanding,
    creditLimit,
    newTotal,
    exceedsBy: 0,
  }
}
