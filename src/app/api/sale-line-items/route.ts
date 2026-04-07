import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { getAuthenticatedUser } from "@/lib/api-auth"
import { canEditDailyEntry } from "@/lib/permissions"
import { createSaleLineItemSchema, validateRequestBody } from "@/lib/validations"
import { successResponse, ApiErrors } from "@/lib/api-response"
import { convertPrismaDecimals } from "@/lib/utils/serialize"
import { createAuditLog, getClientIpFromRequest, getUserAgentFromRequest } from "@/lib/audit"
import type { CategoryType, CustomerType, PaymentMethod } from "@prisma/client"
import { getWalletDeduction, checkWalletSufficiency } from "@/lib/utils/wallet-check"
import { logError } from "@/lib/logger"
import { withTransaction } from "@/lib/utils/atomic"
import { syncCellTotal } from "@/lib/utils/sync-cell-total"

// GET /api/sale-line-items?dailyEntryId=xxx
export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (!auth.authenticated) return auth.error!

  const { searchParams } = new URL(request.url)
  const dailyEntryId = searchParams.get("dailyEntryId")

  if (!dailyEntryId) {
    return ApiErrors.badRequest("dailyEntryId is required")
  }

  try {
    const items = await prisma.saleLineItem.findMany({
      where: { dailyEntryId },
      orderBy: { timestamp: "asc" },
      include: {
        wholesaleCustomer: {
          select: { id: true, name: true, phone: true, businessName: true },
        },
      },
    })

    return successResponse(convertPrismaDecimals(items))
  } catch (error) {
    logError("Error fetching sale line items", error)
    return ApiErrors.serverError("Failed to fetch sale line items")
  }
}

// POST /api/sale-line-items - Create a new line item
export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (!auth.authenticated) return auth.error!

  try {
    const validation = await validateRequestBody(request, createSaleLineItemSchema)
    if ("error" in validation) return validation.error
    const { dailyEntryId, category, customerType, paymentMethod, amount, serviceNumber, note, wholesaleCustomerId, cashAmount, discountPercent } = validation.data

    // Verify daily entry exists and is DRAFT
    const dailyEntry = await prisma.dailyEntry.findUnique({
      where: { id: dailyEntryId },
      select: { id: true, status: true, date: true, createdBy: true },
    })

    if (!dailyEntry) return ApiErrors.notFound("Daily entry")
    if (dailyEntry.status === "SUBMITTED") {
      return ApiErrors.badRequest("Cannot add line items to a submitted entry")
    }

    // Check edit permissions
    const isOwnEntry = dailyEntry.createdBy === auth.user!.id
    const editPerm = canEditDailyEntry(auth.user!.role, dailyEntry.date, isOwnEntry)
    if (!editPerm.canEdit) {
      return ApiErrors.forbidden(editPerm.reason || "Cannot edit this entry")
    }

    // Validate cell is allowed (corporate only for DHIRAAGU_BILLS)
    if (customerType === "CORPORATE" && category !== "DHIRAAGU_BILLS") {
      return ApiErrors.badRequest("Corporate sales are only allowed for Dhiraagu Bills")
    }

    // Validate wholesale customer if provided
    if (wholesaleCustomerId) {
      const wholesaleCustomer = await prisma.wholesaleCustomer.findUnique({
        where: { id: wholesaleCustomerId },
        select: { id: true, isActive: true },
      })
      if (!wholesaleCustomer) return ApiErrors.notFound("Wholesale customer")
      if (!wholesaleCustomer.isActive) {
        return ApiErrors.badRequest("Wholesale customer is deactivated")
      }
    }

    // Atomic: wallet check + create + syncCellTotal in a single serializable transaction
    const { lineItem, cellTotal, cellCount } = await withTransaction(async (tx) => {
      // Check wallet balance for reload sales (inside transaction for atomicity)
      const walletDeduction = getWalletDeduction(category, amount)
      if (walletDeduction > 0) {
        const walletError = await checkWalletSufficiency(category, walletDeduction, tx)
        if (walletError) {
          throw new Error(`WALLET_INSUFFICIENT:${walletError}`)
        }
      }

      // Create line item
      const item = await tx.saleLineItem.create({
        data: {
          dailyEntryId,
          category,
          customerType,
          paymentMethod,
          amount,
          serviceNumber: serviceNumber || null,
          note: note || null,
          wholesaleCustomerId: wholesaleCustomerId || null,
          cashAmount: cashAmount ?? null,
          discountPercent: discountPercent ?? null,
          createdBy: auth.user!.id,
        },
        include: {
          wholesaleCustomer: {
            select: { id: true, name: true, phone: true, businessName: true },
          },
        },
      })

      // Sync cell total
      const total = await syncCellTotal(dailyEntryId, category, customerType, paymentMethod, tx)

      // Count items for this cell
      const count = await tx.saleLineItem.count({
        where: { dailyEntryId, category, customerType, paymentMethod },
      })

      return { lineItem: item, cellTotal: total, cellCount: count }
    }).catch((err: Error) => {
      if (err.message.startsWith("WALLET_INSUFFICIENT:")) {
        throw { walletError: err.message.replace("WALLET_INSUFFICIENT:", "") }
      }
      throw err
    })
    // Note: wallet error is caught below in the outer catch

    await createAuditLog({
      action: "SALE_LINE_ITEM_ADDED",
      userId: auth.user!.id,
      targetId: lineItem.id,
      details: {
        dailyEntryId,
        category,
        customerType,
        paymentMethod,
        amount,
        serviceNumber,
        cellTotal,
      },
      ipAddress: getClientIpFromRequest(request),
      userAgent: getUserAgentFromRequest(request),
    })

    return successResponse({
      lineItem: convertPrismaDecimals(lineItem),
      cellTotal,
      cellCount,
    }, 201)
  } catch (error: unknown) {
    // Handle wallet insufficient error thrown from inside transaction
    if (error && typeof error === "object" && "walletError" in error) {
      return ApiErrors.badRequest((error as { walletError: string }).walletError)
    }
    logError("Error creating sale line item", error)
    return ApiErrors.serverError("Failed to create sale line item")
  }
}
