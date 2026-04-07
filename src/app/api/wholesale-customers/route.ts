import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { getAuthenticatedUser } from "@/lib/api-auth"
import { createWholesaleCustomerSchema, validateRequestBody } from "@/lib/validations"
import { successResponse, paginatedResponse, ApiErrors } from "@/lib/api-response"
import { createAuditLog, getClientIpFromRequest, getUserAgentFromRequest } from "@/lib/audit"
import { logError } from "@/lib/logger"

// GET /api/wholesale-customers - List/search wholesale customers
export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (!auth.authenticated) return auth.error!

  const { searchParams } = new URL(request.url)
  const search = (searchParams.get("search") || "").slice(0, 100).trim()
  const activeOnly = searchParams.get("activeOnly") !== "false"
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
  const offset = parseInt(searchParams.get("offset") || "0")

  try {
    const where = {
      ...(activeOnly ? { isActive: true } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search } },
              { businessName: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    }

    const [customers, total] = await Promise.all([
      prisma.wholesaleCustomer.findMany({
        where,
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
        include: {
          _count: { select: { saleLineItems: true } },
          saleLineItems: {
            select: { amount: true, cashAmount: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
      prisma.wholesaleCustomer.count({ where }),
    ])

    const data = customers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      businessName: c.businessName,
      notes: c.notes,
      discountOverride: c.discountOverride ? Number(c.discountOverride) : null,
      isActive: c.isActive,
      totalPurchases: 0,
      totalCashAmount: 0,
      purchaseCount: c._count.saleLineItems,
      lastPurchaseDate: c.saleLineItems[0]?.createdAt?.toISOString() || null,
      createdAt: c.createdAt.toISOString(),
    }))

    // Get purchase totals in bulk
    if (data.length > 0) {
      const totals = await prisma.saleLineItem.groupBy({
        by: ["wholesaleCustomerId"],
        where: { wholesaleCustomerId: { in: data.map((c) => c.id) } },
        _sum: { amount: true, cashAmount: true },
      })

      const totalMap = new Map(
        totals.map((t) => [
          t.wholesaleCustomerId,
          {
            reload: Number(t._sum.amount ?? 0),
            cash: Number(t._sum.cashAmount ?? 0),
          },
        ])
      )

      for (const customer of data) {
        const t = totalMap.get(customer.id)
        customer.totalPurchases = t?.reload || 0
        customer.totalCashAmount = t?.cash || 0
      }
    }

    return paginatedResponse(data, { total, limit, offset })
  } catch (error) {
    logError("Error fetching wholesale customers", error)
    return ApiErrors.serverError("Failed to fetch wholesale customers")
  }
}

// POST /api/wholesale-customers - Create a new wholesale customer
export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (!auth.authenticated) return auth.error!

  try {
    const validation = await validateRequestBody(request, createWholesaleCustomerSchema)
    if ("error" in validation) return validation.error
    const { name, phone, businessName, notes, discountOverride } = validation.data

    // Check for duplicate phone
    const existing = await prisma.wholesaleCustomer.findUnique({
      where: { phone },
    })

    if (existing) {
      if (!existing.isActive) {
        return ApiErrors.conflict(
          "A deactivated customer with this phone exists. Reactivate them instead."
        )
      }
      return ApiErrors.conflict("A customer with this phone number already exists")
    }

    const customer = await prisma.wholesaleCustomer.create({
      data: {
        name,
        phone,
        businessName: businessName || null,
        notes: notes || null,
        discountOverride: discountOverride ?? null,
      },
    })

    await createAuditLog({
      action: "CUSTOMER_CREATED",
      userId: auth.user!.id,
      targetId: customer.id,
      details: { name, phone, type: "wholesale", discountOverride },
      ipAddress: getClientIpFromRequest(request),
      userAgent: getUserAgentFromRequest(request),
    })

    return successResponse(
      {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        businessName: customer.businessName,
        notes: customer.notes,
        discountOverride: customer.discountOverride ? Number(customer.discountOverride) : null,
        isActive: customer.isActive,
        totalPurchases: 0,
        totalCashAmount: 0,
        purchaseCount: 0,
        lastPurchaseDate: null,
        createdAt: customer.createdAt.toISOString(),
      },
      201
    )
  } catch (error) {
    logError("Error creating wholesale customer", error)
    return ApiErrors.serverError("Failed to create wholesale customer")
  }
}
