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

/**
 * Maps (customerType, paymentMethod) to the DailyEntryCategory field name.
 * e.g. (CONSUMER, CASH) => "consumerCash"
 */
function getCategoryFieldName(customerType: CustomerType, paymentMethod: PaymentMethod): string {
  const ct = customerType === "CONSUMER" ? "consumer" : "corporate"
  const pm = paymentMethod.charAt(0) + paymentMethod.slice(1).toLowerCase()
  return `${ct}${pm}`
}

/**
 * Recalculates the cell total from line items and updates the DailyEntryCategory.
 * Returns the new cell total.
 */
async function syncCellTotal(
  dailyEntryId: string,
  category: CategoryType,
  customerType: CustomerType,
  paymentMethod: PaymentMethod
): Promise<number> {
  // For wholesale reload: grid shows cash received (cashAmount), not reload amount
  // For all others: grid shows the sale amount
  let total: number
  if (category === "WHOLESALE_RELOAD") {
    // Sum cashAmount where available, fall back to amount
    const items = await prisma.saleLineItem.findMany({
      where: { dailyEntryId, category, customerType, paymentMethod },
      select: { amount: true, cashAmount: true },
    })
    total = items.reduce((sum, item) => sum + Number(item.cashAmount ?? item.amount), 0)
  } else {
    const agg = await prisma.saleLineItem.aggregate({
      where: { dailyEntryId, category, customerType, paymentMethod },
      _sum: { amount: true },
    })
    total = Number(agg._sum.amount ?? 0)
  }

  const fieldName = getCategoryFieldName(customerType, paymentMethod)

  // Upsert the category record
  await prisma.dailyEntryCategory.upsert({
    where: { dailyEntryId_category: { dailyEntryId, category } },
    update: { [fieldName]: total },
    create: {
      dailyEntryId,
      category,
      [fieldName]: total,
    },
  })

  return total
}

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
    console.error("Error fetching sale line items:", error)
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

    // Check wallet balance for reload sales
    const walletDeduction = getWalletDeduction(category, amount)
    if (walletDeduction > 0) {
      const walletError = await checkWalletSufficiency(category, walletDeduction)
      if (walletError) {
        return ApiErrors.badRequest(walletError)
      }
    }

    // Create line item
    const lineItem = await prisma.saleLineItem.create({
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
    const cellTotal = await syncCellTotal(dailyEntryId, category, customerType, paymentMethod)

    // Count items for this cell
    const cellCount = await prisma.saleLineItem.count({
      where: { dailyEntryId, category, customerType, paymentMethod },
    })

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
  } catch (error) {
    console.error("Error creating sale line item:", error)
    return ApiErrors.serverError("Failed to create sale line item")
  }
}
