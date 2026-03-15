import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { getAuthenticatedUser } from "@/lib/api-auth"
import { updateWholesaleCustomerSchema, validateRequestBody } from "@/lib/validations"
import { successResponse, ApiErrors } from "@/lib/api-response"
import { convertPrismaDecimals } from "@/lib/utils/serialize"
import { createAuditLog, getClientIpFromRequest, getUserAgentFromRequest } from "@/lib/audit"

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/wholesale-customers/[id] - Get customer with purchase history
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await getAuthenticatedUser()
  if (!auth.authenticated) return auth.error!

  const { id } = await params

  try {
    const customer = await prisma.wholesaleCustomer.findUnique({
      where: { id },
      include: {
        saleLineItems: {
          orderBy: { createdAt: "desc" },
          take: 100,
          include: {
            dailyEntry: { select: { date: true } },
          },
        },
      },
    })

    if (!customer) return ApiErrors.notFound("Wholesale customer")

    // Aggregate total purchases
    const agg = await prisma.saleLineItem.aggregate({
      where: { wholesaleCustomerId: id },
      _sum: { amount: true, cashAmount: true },
      _count: true,
    })

    return successResponse({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      businessName: customer.businessName,
      notes: customer.notes,
      discountOverride: customer.discountOverride ? Number(customer.discountOverride) : null,
      isActive: customer.isActive,
      totalPurchases: Number(agg._sum.amount ?? 0),
      totalCashAmount: Number(agg._sum.cashAmount ?? 0),
      purchaseCount: agg._count,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
      purchases: convertPrismaDecimals(
        customer.saleLineItems.map((item) => ({
          id: item.id,
          amount: item.amount,
          cashAmount: item.cashAmount,
          discountPercent: item.discountPercent,
          serviceNumber: item.serviceNumber,
          note: item.note,
          category: item.category,
          paymentMethod: item.paymentMethod,
          date: item.dailyEntry.date.toISOString(),
          createdAt: item.createdAt.toISOString(),
        }))
      ),
    })
  } catch (error) {
    console.error("Error fetching wholesale customer:", error)
    return ApiErrors.serverError("Failed to fetch wholesale customer")
  }
}

// PATCH /api/wholesale-customers/[id] - Update customer
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await getAuthenticatedUser()
  if (!auth.authenticated) return auth.error!

  const { id } = await params

  try {
    const existing = await prisma.wholesaleCustomer.findUnique({ where: { id } })
    if (!existing) return ApiErrors.notFound("Wholesale customer")

    const validation = await validateRequestBody(request, updateWholesaleCustomerSchema)
    if ("error" in validation) return validation.error
    const data = validation.data

    // If changing phone, check uniqueness
    if (data.phone && data.phone !== existing.phone) {
      const duplicate = await prisma.wholesaleCustomer.findUnique({
        where: { phone: data.phone },
      })
      if (duplicate) {
        return ApiErrors.conflict("A customer with this phone number already exists")
      }
    }

    const customer = await prisma.wholesaleCustomer.update({
      where: { id },
      data,
    })

    await createAuditLog({
      action: "SETTINGS_CHANGED",
      userId: auth.user!.id,
      targetId: customer.id,
      details: { type: "wholesale_customer_updated", changes: data },
      ipAddress: getClientIpFromRequest(request),
      userAgent: getUserAgentFromRequest(request),
    })

    return successResponse({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      businessName: customer.businessName,
      notes: customer.notes,
      discountOverride: customer.discountOverride ? Number(customer.discountOverride) : null,
      isActive: customer.isActive,
      createdAt: customer.createdAt.toISOString(),
    })
  } catch (error) {
    console.error("Error updating wholesale customer:", error)
    return ApiErrors.serverError("Failed to update wholesale customer")
  }
}

// DELETE /api/wholesale-customers/[id] - Deactivate customer (soft delete)
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await getAuthenticatedUser()
  if (!auth.authenticated) return auth.error!

  const { id } = await params

  try {
    const existing = await prisma.wholesaleCustomer.findUnique({ where: { id } })
    if (!existing) return ApiErrors.notFound("Wholesale customer")

    await prisma.wholesaleCustomer.update({
      where: { id },
      data: { isActive: false },
    })

    await createAuditLog({
      action: "CUSTOMER_DEACTIVATED",
      userId: auth.user!.id,
      targetId: id,
      details: { name: existing.name, type: "wholesale" },
      ipAddress: getClientIpFromRequest(_request),
      userAgent: getUserAgentFromRequest(_request),
    })

    return successResponse({ success: true })
  } catch (error) {
    console.error("Error deactivating wholesale customer:", error)
    return ApiErrors.serverError("Failed to deactivate wholesale customer")
  }
}
