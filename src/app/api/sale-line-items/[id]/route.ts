import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { getAuthenticatedUser } from "@/lib/api-auth"
import { canEditDailyEntry } from "@/lib/permissions"
import { getBusinessRules } from "@/lib/business-rules"
import { successResponse, ApiErrors } from "@/lib/api-response"
import { updateSaleLineItemSchema, validateRequestBody } from "@/lib/validations"
import { createAuditLog, getClientIpFromRequest, getUserAgentFromRequest } from "@/lib/audit"
import { withTransaction } from "@/lib/utils/atomic"
import { getWalletDeduction, checkWalletSufficiency } from "@/lib/utils/wallet-check"
import { syncCellTotal } from "@/lib/utils/sync-cell-total"
import { logError } from "@/lib/logger"
import { deleteTransferBankDeposit, updateTransferBankDeposit } from "@/lib/utils/sync-transfer-bank"

// PATCH /api/sale-line-items/[id] - Edit a sale line item
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedUser()
  if (!auth.authenticated) return auth.error!

  try {
    const { id } = await params

    // Validate request body with Zod schema (S6)
    const validation = await validateRequestBody(request, updateSaleLineItemSchema)
    if ("error" in validation) return validation.error
    const { amount, serviceNumber, note, reason } = validation.data

    const lineItem = await prisma.saleLineItem.findUnique({
      where: { id },
      include: {
        dailyEntry: { select: { id: true, status: true, date: true, createdBy: true } },
      },
    })

    if (!lineItem) return ApiErrors.notFound("Sale line item")

    if (lineItem.dailyEntry.status === "SUBMITTED") {
      return ApiErrors.badRequest("Cannot edit line items on a submitted entry")
    }

    const isOwnEntry = lineItem.dailyEntry.createdBy === auth.user!.id
    const rules = await getBusinessRules()
    const editPerm = canEditDailyEntry(auth.user!.role, lineItem.dailyEntry.date, isOwnEntry, {
      accountantEditWindowDays: rules.accountantEditWindowDays,
    })
    if (!editPerm.canEdit) {
      return ApiErrors.forbidden(editPerm.reason || "Cannot edit this entry")
    }

    const previousAmount = Number(lineItem.amount)

    // Atomic: update + wallet check + syncCellTotal in a single serializable transaction
    const { updated, cellTotal, cellCount } = await withTransaction(async (tx) => {
      // B13: Re-check wallet sufficiency when amount increases for reload categories
      if (amount !== undefined && amount > previousAmount) {
        const delta = amount - previousAmount
        const walletDelta = getWalletDeduction(lineItem.category, delta)
        if (walletDelta > 0) {
          const walletError = await checkWalletSufficiency(lineItem.category, walletDelta, tx)
          if (walletError) {
            throw { type: "WALLET_INSUFFICIENT", message: walletError }
          }
        }
      }

      const upd = await tx.saleLineItem.update({
        where: { id },
        data: {
          ...(amount !== undefined && { amount }),
          ...(serviceNumber !== undefined && { serviceNumber: serviceNumber || null }),
          ...(note !== undefined && { note: note || null }),
        },
      })

      let total = previousAmount
      if (amount !== undefined && amount !== previousAmount) {
        total = await syncCellTotal(
          lineItem.dailyEntryId,
          lineItem.category,
          lineItem.customerType,
          lineItem.paymentMethod,
          tx
        )
      }

      const count = await tx.saleLineItem.count({
        where: {
          dailyEntryId: lineItem.dailyEntryId,
          category: lineItem.category,
          customerType: lineItem.customerType,
          paymentMethod: lineItem.paymentMethod,
        },
      })

      return { updated: upd, cellTotal: total, cellCount: count }
    })

    // Update linked bank deposit if transfer amount changed.
    // Pass the FK (S1.b) so the lookup doesn't rely on notes substring matching.
    if (lineItem.paymentMethod === "TRANSFER" && amount !== undefined && amount !== previousAmount) {
      try {
        await updateTransferBankDeposit(id, amount, lineItem.bankTransactionId)
      } catch (bankErr) {
        logError("Bank sync error on transfer sale edit (non-fatal)", bankErr)
      }
    }

    await createAuditLog({
      action: "SALE_LINE_ITEM_EDITED",
      userId: auth.user!.id,
      targetId: id,
      details: {
        dailyEntryId: lineItem.dailyEntryId,
        category: lineItem.category,
        customerType: lineItem.customerType,
        paymentMethod: lineItem.paymentMethod,
        previousAmount,
        newAmount: Number(updated.amount),
        cellTotal,
        reason: reason ?? "No reason provided",
      },
      ipAddress: getClientIpFromRequest(request),
      userAgent: getUserAgentFromRequest(request),
    })

    return successResponse({
      lineItem: {
        id: updated.id,
        dailyEntryId: updated.dailyEntryId,
        category: updated.category,
        customerType: updated.customerType,
        paymentMethod: updated.paymentMethod,
        amount: Number(updated.amount),
        serviceNumber: updated.serviceNumber,
        note: updated.note,
        timestamp: updated.timestamp.toISOString(),
        createdBy: updated.createdBy,
        createdAt: updated.createdAt.toISOString(),
      },
      cellTotal,
      cellCount,
    })
  } catch (error: unknown) {
    // Handle structured wallet error from inside transaction (B13)
    if (error && typeof error === "object" && "type" in error) {
      const typed = error as { type: string; message?: string }
      if (typed.type === "WALLET_INSUFFICIENT") {
        return ApiErrors.badRequest(typed.message || "Insufficient wallet balance")
      }
    }
    logError("Error editing sale line item", error)
    return ApiErrors.serverError("Failed to edit sale line item")
  }
}

// DELETE /api/sale-line-items/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedUser()
  if (!auth.authenticated) return auth.error!

  try {
    const { id } = await params

    const lineItem = await prisma.saleLineItem.findUnique({
      where: { id },
      include: {
        dailyEntry: { select: { id: true, status: true, date: true, createdBy: true } },
        creditSale: { select: { id: true, creditTransactionId: true, customerId: true } },
      },
    })

    if (!lineItem) return ApiErrors.notFound("Sale line item")

    if (lineItem.dailyEntry.status === "SUBMITTED") {
      return ApiErrors.badRequest("Cannot delete line items from a submitted entry")
    }

    // Check edit permissions (uses owner-tunable accountant window).
    const isOwnEntry = lineItem.dailyEntry.createdBy === auth.user!.id
    const rules = await getBusinessRules()
    const editPerm = canEditDailyEntry(auth.user!.role, lineItem.dailyEntry.date, isOwnEntry, {
      accountantEditWindowDays: rules.accountantEditWindowDays,
    })
    if (!editPerm.canEdit) {
      return ApiErrors.forbidden(editPerm.reason || "Cannot edit this entry")
    }

    // Parse reason from request body
    let reason: string | null = null
    try {
      const body = await request.json()
      reason = body?.reason ?? null
    } catch {
      // no body is fine
    }

    // Atomic: delete line item (+ linked credit sale if wholesale) + syncCellTotal
    const { cellTotal, cellCount } = await withTransaction(async (tx) => {
      // If this line item is linked to a credit sale, cascade-delete it
      if (lineItem.creditSale) {
        const { id: creditSaleId, creditTransactionId } = lineItem.creditSale

        // Delete the line item first (has FK to credit sale with onDelete: SetNull)
        await tx.saleLineItem.delete({ where: { id } })

        // Delete the credit sale
        await tx.creditSale.delete({ where: { id: creditSaleId } })

        // Delete the linked credit transaction
        if (creditTransactionId) {
          await tx.creditTransaction.delete({ where: { id: creditTransactionId } })
        }
      } else {
        await tx.saleLineItem.delete({ where: { id } })
      }

      const total = await syncCellTotal(
        lineItem.dailyEntryId,
        lineItem.category,
        lineItem.customerType,
        lineItem.paymentMethod,
        tx
      )

      const count = await tx.saleLineItem.count({
        where: {
          dailyEntryId: lineItem.dailyEntryId,
          category: lineItem.category,
          customerType: lineItem.customerType,
          paymentMethod: lineItem.paymentMethod,
        },
      })

      return { cellTotal: total, cellCount: count }
    })

    // Delete linked bank deposit for transfer sales.
    // We captured `bankTransactionId` from the line item BEFORE the deletion
    // transaction above, so we can pass it to the helper to use the FK lookup (S1.b).
    if (lineItem.paymentMethod === "TRANSFER") {
      try {
        await deleteTransferBankDeposit(id, lineItem.bankTransactionId)
      } catch (bankErr) {
        logError("Bank sync error on transfer sale delete (non-fatal)", bankErr)
      }
    }

    await createAuditLog({
      action: "SALE_LINE_ITEM_DELETED",
      userId: auth.user!.id,
      targetId: id,
      details: {
        dailyEntryId: lineItem.dailyEntryId,
        category: lineItem.category,
        customerType: lineItem.customerType,
        paymentMethod: lineItem.paymentMethod,
        amount: Number(lineItem.amount),
        cellTotal,
        reason: reason ?? "No reason provided",
        ...(lineItem.creditSale && { cascadeDeletedCreditSaleId: lineItem.creditSale.id }),
      },
      ipAddress: getClientIpFromRequest(request),
      userAgent: getUserAgentFromRequest(request),
    })

    return successResponse({ cellTotal, cellCount })
  } catch (error) {
    logError("Error deleting sale line item", error)
    return ApiErrors.serverError("Failed to delete sale line item")
  }
}
