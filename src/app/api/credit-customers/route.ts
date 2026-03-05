import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/api-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { CustomerType } from "@prisma/client"
import { createCreditCustomerSchema, validateRequestBody } from "@/lib/validations"
import { calculateCreditBalance } from "@/lib/utils/balance"
import { createAuditLog, getClientIpFromRequest, getUserAgentFromRequest } from "@/lib/audit"

// GET /api/credit-customers - List all credit customers
export async function GET(request: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.CREDIT_CUSTOMER_VIEW)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const typeParam = searchParams.get("type")
  // Validate and sanitize search input
  const search = searchParams.get("search")?.slice(0, 100).trim() || null
  const activeOnly = searchParams.get("activeOnly") !== "false"

  // Pagination parameters
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50"), 1), 200) // Between 1 and 200
  const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0)

  // Validate type parameter
  const type = typeParam && ["CONSUMER", "CORPORATE"].includes(typeParam)
    ? (typeParam as CustomerType)
    : null

  try {
    const where: {
      type?: CustomerType
      isActive?: boolean
      OR?: Array<{ name: { contains: string; mode: "insensitive" } } | { phone: { contains: string } }>
    } = {}

    if (type) {
      where.type = type
    }

    if (activeOnly) {
      where.isActive = true
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ]
    }

    // Get total count for pagination
    const total = await prisma.creditCustomer.count({ where })

    // Include transactions in initial query to avoid N+1
    const customers = await prisma.creditCustomer.findMany({
      where,
      orderBy: { name: "asc" },
      take: limit,
      skip: offset,
      include: {
        transactions: {
          select: {
            type: true,
            amount: true,
            date: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    })

    // Calculate outstanding balance for each customer (no additional queries)
    const customersWithBalance = customers.map((customer) => {
      const txList = customer.transactions
      const outstandingBalance = calculateCreditBalance(txList)
      const lastActivity = txList[0]?.date || null

      // Remove transactions from response (not needed by client)
      const { transactions: _, ...customerData } = customer

      return {
        ...customerData,
        creditLimit: customer.creditLimit ? Number(customer.creditLimit) : null,
        outstandingBalance,
        lastActivityDate: lastActivity,
      }
    })

    return NextResponse.json({
      success: true,
      data: customersWithBalance,
      pagination: { total, limit, offset },
    })
  } catch (error) {
    console.error("Error fetching credit customers:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch credit customers" },
      { status: 500 }
    )
  }
}

// POST /api/credit-customers - Create new credit customer
export async function POST(request: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.CREDIT_CUSTOMER_CREATE)
  if (auth.error) return auth.error

  try {
    // Validate request body
    const validation = await validateRequestBody(request, createCreditCustomerSchema)
    if ("error" in validation) return validation.error
    const body = validation.data

    const customer = await prisma.creditCustomer.create({
      data: {
        name: body.name,
        type: body.type as CustomerType,
        phone: body.phone,
        email: body.email || null,
        creditLimit: body.creditLimit || null,
      },
    })

    await createAuditLog({
      action: "CUSTOMER_CREATED",
      userId: auth.user!.id,
      targetId: customer.id,
      details: {
        name: customer.name,
        type: customer.type,
        phone: customer.phone,
        creditLimit: customer.creditLimit ? Number(customer.creditLimit) : null,
      },
      ipAddress: getClientIpFromRequest(request),
      userAgent: getUserAgentFromRequest(request),
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          ...customer,
          creditLimit: customer.creditLimit ? Number(customer.creditLimit) : null,
          outstandingBalance: 0,
          lastActivityDate: null,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating credit customer:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create credit customer" },
      { status: 500 }
    )
  }
}
