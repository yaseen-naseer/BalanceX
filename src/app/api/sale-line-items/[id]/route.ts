import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { getAuthenticatedUser } from "@/lib/api-auth"
import { canEditDailyEntry } from "@/lib/permissions"
import { successResponse, ApiErrors } from "@/lib/api-response"
import { createAuditLog, getClientIpFromRequest, getUserAgentFromRequest } from "@/lib/audit"
import type { CategoryType, CustomerType, PaymentMethod } from "@prisma/client"

function getCategoryFieldName(customerType: CustomerType, paymentMethod: PaymentMethod): string {
  const ct = customerType === "CONSUMER" ? "consumer" : "corporate"
  const pm = paymentMethod.charAt(0) + paymentMethod.slice(1).toLowerCase()
  return `${ct}${pm}`
}

async function syncCellTotal(
  dailyEntryId: string,
  category: CategoryType,
  customerType: CustomerType,
  paymentMethod: PaymentMethod
): Promise<number> {
  const agg = await prisma.saleLineItem.aggregate({
    where: { dailyEntryId, category, customerType, paymentMethod },
    _sum: { amount: true },
  })
  const total = Number(agg._sum.amount ?? 0)
  const fieldName = getCategoryFieldName(customerType, paymentMethod)

  const existing = await prisma.dailyEntryCategory.findUnique({
    where: { dailyEntryId_category: { dailyEntryId, category } },
  })

  if (existing) {
    await prisma.dailyEntryCategory.update({
      where: { dailyEntryId_category: { dailyEntryId, category } },
      data: { [fieldName]: total },
    })
  }

  return total
}

// PATCH /api/sale-line-items/[id] - Edit a sale line item
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedUser()
  if (!auth.authenticated) return auth.error!

  try {
    const { id } = await params
    const body = await request.json()
    const { amount, serviceNumber, note, reason } = body

    if (amount !== undefined && (typeof amount !== "number" || amount <= 0)) {
      return ApiErrors.badRequest("Amount must be a positive number")
    }

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
    const editPerm = canEditDailyEntry(auth.user!.role, lineItem.dailyEntry.date, isOwnEntry)
    if (!editPerm.canEdit) {
      return ApiErrors.forbidden(editPerm.reason || "Cannot edit this entry")
    }

    const previousAmount = Number(lineItem.amount)

    // Update the line item
    const updated = await prisma.saleLineItem.update({
      where: { id },
      data: {
        ...(amount !== undefined && { amount }),
        ...(serviceNumber !== undefined && { serviceNumber: serviceNumber || null }),
        ...(note !== undefined && { note: note || null }),
      },
    })

    // Sync cell total if amount changed
    let cellTotal = previousAmount
    if (amount !== undefined && amount !== previousAmount) {
      cellTotal = await syncCellTotal(
        lineItem.dailyEntryId,
        lineItem.category,
        lineItem.customerType,
        lineItem.paymentMethod
      )
    }

    const cellCount = await prisma.saleLineItem.count({
      where: {
        dailyEntryId: lineItem.dailyEntryId,
        category: lineItem.category,
        customerType: lineItem.customerType,
        paymentMethod: lineItem.paymentMethod,
      },
    })

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
  } catch (error) {
    console.error("Error editing sale line item:", error)
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
      },
    })

    if (!lineItem) return ApiErrors.notFound("Sale line item")

    if (lineItem.dailyEntry.status === "SUBMITTED") {
      return ApiErrors.badRequest("Cannot delete line items from a submitted entry")
    }

    // Check edit permissions
    const isOwnEntry = lineItem.dailyEntry.createdBy === auth.user!.id
    const editPerm = canEditDailyEntry(auth.user!.role, lineItem.dailyEntry.date, isOwnEntry)
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

    // Delete the line item
    await prisma.saleLineItem.delete({ where: { id } })

    // Sync cell total
    const cellTotal = await syncCellTotal(
      lineItem.dailyEntryId,
      lineItem.category,
      lineItem.customerType,
      lineItem.paymentMethod
    )

    const cellCount = await prisma.saleLineItem.count({
      where: {
        dailyEntryId: lineItem.dailyEntryId,
        category: lineItem.category,
        customerType: lineItem.customerType,
        paymentMethod: lineItem.paymentMethod,
      },
    })

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
      },
      ipAddress: getClientIpFromRequest(request),
      userAgent: getUserAgentFromRequest(request),
    })

    return successResponse({ cellTotal, cellCount })
  } catch (error) {
    console.error("Error deleting sale line item:", error)
    return ApiErrors.serverError("Failed to delete sale line item")
  }
}
