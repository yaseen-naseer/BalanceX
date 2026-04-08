import { prisma } from "@/lib/db"
import { format } from "date-fns"

const TRANSFER_SALE_REFERENCE = "Transfer Sale"
const TRANSFER_SALE_NOTE_PREFIX = "Auto-created from transfer sale"

/**
 * Create a bank deposit for a transfer sale line item.
 */
export async function createTransferBankDeposit(
  lineItemId: string,
  amount: number,
  entryDate: Date,
  category: string,
  userId: string
): Promise<void> {
  // Calculate current bank balance
  const settings = await prisma.bankSettings.findFirst({
    orderBy: { openingDate: "desc" },
  })
  const allTransactions = await prisma.bankTransaction.findMany({
    orderBy: { date: "asc" },
  })
  let currentBalance = settings ? Number(settings.openingBalance) : 0
  for (const tx of allTransactions) {
    currentBalance += tx.type === "DEPOSIT" ? Number(tx.amount) : -Number(tx.amount)
  }

  await prisma.bankTransaction.create({
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
}

/**
 * Delete the auto-created bank deposit for a transfer sale line item.
 */
export async function deleteTransferBankDeposit(lineItemId: string): Promise<void> {
  const bankTx = await prisma.bankTransaction.findFirst({
    where: {
      reference: TRANSFER_SALE_REFERENCE,
      notes: { contains: `item: ${lineItemId}` },
    },
  })

  if (bankTx) {
    await prisma.bankTransaction.delete({ where: { id: bankTx.id } })

    // Recalculate balances after deletion
    const settings = await prisma.bankSettings.findFirst({
      orderBy: { openingDate: "desc" },
    })
    const allTransactions = await prisma.bankTransaction.findMany({
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    })
    let runningBalance = settings ? Number(settings.openingBalance) : 0
    for (const tx of allTransactions) {
      runningBalance += tx.type === "DEPOSIT" ? Number(tx.amount) : -Number(tx.amount)
      if (Number(tx.balanceAfter) !== runningBalance) {
        await prisma.bankTransaction.update({
          where: { id: tx.id },
          data: { balanceAfter: runningBalance },
        })
      }
    }
  }
}

/**
 * Update the amount of an auto-created bank deposit for a transfer sale line item.
 */
export async function updateTransferBankDeposit(
  lineItemId: string,
  newAmount: number
): Promise<void> {
  const bankTx = await prisma.bankTransaction.findFirst({
    where: {
      reference: TRANSFER_SALE_REFERENCE,
      notes: { contains: `item: ${lineItemId}` },
    },
  })

  if (bankTx) {
    await prisma.bankTransaction.update({
      where: { id: bankTx.id },
      data: { amount: newAmount },
    })

    // Recalculate balances
    const settings = await prisma.bankSettings.findFirst({
      orderBy: { openingDate: "desc" },
    })
    const allTransactions = await prisma.bankTransaction.findMany({
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    })
    let runningBalance = settings ? Number(settings.openingBalance) : 0
    for (const tx of allTransactions) {
      runningBalance += tx.type === "DEPOSIT" ? Number(tx.amount) : -Number(tx.amount)
      if (Number(tx.balanceAfter) !== runningBalance) {
        await prisma.bankTransaction.update({
          where: { id: tx.id },
          data: { balanceAfter: runningBalance },
        })
      }
    }
  }
}

/**
 * Check if a bank transaction is an auto-created transfer sale deposit.
 */
export function isTransferSaleDeposit(reference: string | null, notes: string | null): boolean {
  return reference === TRANSFER_SALE_REFERENCE && (notes?.startsWith(TRANSFER_SALE_NOTE_PREFIX) ?? false)
}
