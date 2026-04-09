import { prisma } from "@/lib/db"
import { format } from "date-fns"
import { z } from "zod"
import { withTransaction } from "./atomic"

const cuidSchema = z.string().cuid()

const TRANSFER_SALE_REFERENCE = "Transfer Sale"
const TRANSFER_SALE_NOTE_PREFIX = "Auto-created from transfer sale"

/**
 * Recalculate all bank transaction running balances atomically.
 * Must be called inside a transaction (tx).
 */
async function recalculateBalances(tx: Parameters<Parameters<typeof withTransaction>[0]>[0]): Promise<void> {
  const settings = await tx.bankSettings.findFirst({
    orderBy: { openingDate: "desc" },
  })
  const allTransactions = await tx.bankTransaction.findMany({
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  })
  let runningBalance = settings ? Number(settings.openingBalance) : 0
  for (const t of allTransactions) {
    runningBalance += t.type === "DEPOSIT" ? Number(t.amount) : -Number(t.amount)
    if (Number(t.balanceAfter) !== runningBalance) {
      await tx.bankTransaction.update({
        where: { id: t.id },
        data: { balanceAfter: runningBalance },
      })
    }
  }
}

/**
 * Create a bank deposit for a transfer sale line item.
 * Wrapped in a serializable transaction to prevent race conditions.
 */
export async function createTransferBankDeposit(
  lineItemId: string,
  amount: number,
  entryDate: Date,
  category: string,
  userId: string
): Promise<void> {
  await withTransaction(async (tx) => {
    const settings = await tx.bankSettings.findFirst({
      orderBy: { openingDate: "desc" },
    })
    const allTransactions = await tx.bankTransaction.findMany({
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    })
    let currentBalance = settings ? Number(settings.openingBalance) : 0
    for (const t of allTransactions) {
      currentBalance += t.type === "DEPOSIT" ? Number(t.amount) : -Number(t.amount)
    }

    await tx.bankTransaction.create({
      data: {
        type: "DEPOSIT",
        amount,
        reference: TRANSFER_SALE_REFERENCE,
        notes: `${TRANSFER_SALE_NOTE_PREFIX} (${category}, ${format(entryDate, "dd MMM yyyy")}, item: ${lineItemId})`,
        date: entryDate,
        createdBy: userId,
        balanceAfter: currentBalance + amount,
      },
    })
  })
}

/**
 * Delete the auto-created bank deposit for a transfer sale line item.
 * Wrapped in a serializable transaction to prevent race conditions.
 */
export async function deleteTransferBankDeposit(lineItemId: string): Promise<void> {
  if (!cuidSchema.safeParse(lineItemId).success) return

  await withTransaction(async (tx) => {
    const bankTx = await tx.bankTransaction.findFirst({
      where: {
        reference: TRANSFER_SALE_REFERENCE,
        notes: { contains: `item: ${lineItemId}` },
      },
    })

    if (!bankTx) return

    await tx.bankTransaction.delete({ where: { id: bankTx.id } })
    await recalculateBalances(tx)
  })
}

/**
 * Update the amount of an auto-created bank deposit for a transfer sale line item.
 * Wrapped in a serializable transaction to prevent race conditions.
 */
export async function updateTransferBankDeposit(
  lineItemId: string,
  newAmount: number
): Promise<void> {
  if (!cuidSchema.safeParse(lineItemId).success) return

  await withTransaction(async (tx) => {
    const bankTx = await tx.bankTransaction.findFirst({
      where: {
        reference: TRANSFER_SALE_REFERENCE,
        notes: { contains: `item: ${lineItemId}` },
      },
    })

    if (!bankTx) return

    await tx.bankTransaction.update({
      where: { id: bankTx.id },
      data: { amount: newAmount },
    })
    await recalculateBalances(tx)
  })
}

/**
 * Check if a bank transaction is an auto-created transfer sale deposit.
 */
export function isTransferSaleDeposit(reference: string | null, notes: string | null): boolean {
  return reference === TRANSFER_SALE_REFERENCE && (notes?.startsWith(TRANSFER_SALE_NOTE_PREFIX) ?? false)
}
