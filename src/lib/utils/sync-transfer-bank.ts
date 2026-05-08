import { format } from "date-fns"
import { z } from "zod"
import { withTransaction } from "./atomic"
import { recalculateBankBalancesFrom, getCurrentBankBalance } from "@/lib/bank-utils"

const cuidSchema = z.string().cuid()

const TRANSFER_SALE_REFERENCE = "Transfer Sale"
const TRANSFER_SALE_NOTE_PREFIX = "Auto-created from transfer sale"

/**
 * Create a bank deposit for a transfer-sale line item and link them via FK (S1.b).
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
    const currentBalance = await getCurrentBankBalance(tx)
    const bankTx = await tx.bankTransaction.create({
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

    // Link the FK so future edits/deletes go through `bankTransactionId` instead
    // of substring-matching against the notes column (S1.b).
    await tx.saleLineItem.update({
      where: { id: lineItemId },
      data: { bankTransactionId: bankTx.id },
    })
  })
}

/**
 * Locate the auto-created bank deposit for a transfer-sale line item.
 * Prefers the FK (post-backfill), falls back to legacy notes-substring match
 * for rows created before the FK was introduced.
 */
async function findTransferBankTx(
  tx: Parameters<Parameters<typeof withTransaction>[0]>[0],
  lineItemId: string,
  bankTransactionId: string | null,
) {
  if (bankTransactionId) {
    return tx.bankTransaction.findUnique({ where: { id: bankTransactionId } })
  }
  return tx.bankTransaction.findFirst({
    where: {
      reference: TRANSFER_SALE_REFERENCE,
      notes: { contains: `item: ${lineItemId}` },
    },
  })
}

/**
 * Delete the auto-created bank deposit for a transfer-sale line item.
 * Caller must pass the line item's `bankTransactionId` (read it BEFORE deleting
 * the line item itself) so we can use the FK; legacy rows fall back to notes match.
 */
export async function deleteTransferBankDeposit(
  lineItemId: string,
  bankTransactionId: string | null,
): Promise<void> {
  if (!cuidSchema.safeParse(lineItemId).success) return

  await withTransaction(async (tx) => {
    const bankTx = await findTransferBankTx(tx, lineItemId, bankTransactionId)
    if (!bankTx) return

    // Capture the date before deletion — the targeted recompute needs it as the
    // anchor (the affected slice of the ledger starts here).
    const anchorDate = bankTx.date
    await tx.bankTransaction.delete({ where: { id: bankTx.id } })
    await recalculateBankBalancesFrom(anchorDate, tx)
  })
}

/**
 * Update the amount of an auto-created bank deposit for a transfer-sale line item.
 * Caller passes `bankTransactionId` (FK preferred); legacy rows fall back to notes match.
 */
export async function updateTransferBankDeposit(
  lineItemId: string,
  newAmount: number,
  bankTransactionId: string | null,
): Promise<void> {
  if (!cuidSchema.safeParse(lineItemId).success) return

  await withTransaction(async (tx) => {
    const bankTx = await findTransferBankTx(tx, lineItemId, bankTransactionId)
    if (!bankTx) return

    await tx.bankTransaction.update({
      where: { id: bankTx.id },
      data: { amount: newAmount },
    })
    await recalculateBankBalancesFrom(bankTx.date, tx)
  })
}

/**
 * Check if a bank transaction is an auto-created transfer sale deposit.
 * Used by the bank DELETE handler to block direct deletion of auto-created txs.
 * Class check (no per-id matching), so this stays independent of the FK refactor.
 */
export function isTransferSaleDeposit(reference: string | null, notes: string | null): boolean {
  return reference === TRANSFER_SALE_REFERENCE && (notes?.startsWith(TRANSFER_SALE_NOTE_PREFIX) ?? false)
}
