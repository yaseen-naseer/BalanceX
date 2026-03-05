import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/api-auth"
import { PERMISSIONS } from "@/lib/permissions"
import {
  updateCreditCustomerSchema,
  createSettlementSchema,
  validateRequestBody,
} from "@/lib/validations"
import { createAuditLog, getClientIpFromRequest, getUserAgentFromRequest } from "@/lib/audit"

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/credit-customers/[id] - Get customer with transactions
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission(PERMISSIONS.CREDIT_CUSTOMER_VIEW)
  if (auth.error) return auth.error

  const { id } = await params

  try {
    const customer = await prisma.creditCustomer.findUnique({
      where: { id },
    })

    if (!customer) {
      return NextResponse.json(
        { success: false, error: "Customer not found" },
        { status: 404 }
      )
    }

    // Get all transactions
    const transactions = await prisma.creditTransaction.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true } },
      },
    })

    // Calculate outstanding balance
    const outstandingBalance = transactions.reduce((sum, tx) => {
      if (tx.type === "CREDIT_SALE") {
        return sum + Number(tx.amount)
      } else {
        return sum - Number(tx.amount)
      }
    }, 0)

    const lastActivity = transactions[0]?.date || null

    return NextResponse.json({
      success: true,
      data: {
        ...customer,
        creditLimit: customer.creditLimit ? Number(customer.creditLimit) : null,
        outstandingBalance,
        lastActivityDate: lastActivity,
        transactions: transactions.map((tx) => ({
          ...tx,
          amount: Number(tx.amount),
          balanceAfter: Number(tx.balanceAfter),
        })),
      },
    })
  } catch (error) {
    console.error("Error fetching credit customer:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch credit customer" },
      { status: 500 }
    )
  }
}

// PATCH /api/credit-customers/[id] - Update customer
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission(PERMISSIONS.CREDIT_CUSTOMER_EDIT)
  if (auth.error) return auth.error

  const { id } = await params

  try {
    // Validate request body
    const validation = await validateRequestBody(request, updateCreditCustomerSchema)
    if ("error" in validation) return validation.error
    const body = validation.data

    const customer = await prisma.creditCustomer.findUnique({
      where: { id },
    })

    if (!customer) {
      return NextResponse.json(
        { success: false, error: "Customer not found" },
        { status: 404 }
      )
    }

    const updatedCustomer = await prisma.creditCustomer.update({
      where: { id },
      data: {
        name: body.name ?? customer.name,
        type: body.type ?? customer.type,
        phone: body.phone ?? customer.phone,
        email: body.email !== undefined ? body.email : customer.email,
        creditLimit: body.creditLimit !== undefined ? body.creditLimit : customer.creditLimit,
        isActive: body.isActive !== undefined ? body.isActive : customer.isActive,
      },
    })

    if (body.isActive === false && customer.isActive) {
      await createAuditLog({
        action: "CUSTOMER_DEACTIVATED",
        userId: auth.user!.id,
        targetId: id,
        details: { name: customer.name, type: customer.type },
        ipAddress: getClientIpFromRequest(request),
        userAgent: getUserAgentFromRequest(request),
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        ...updatedCustomer,
        creditLimit: updatedCustomer.creditLimit
          ? Number(updatedCustomer.creditLimit)
          : null,
      },
    })
  } catch (error) {
    console.error("Error updating credit customer:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update credit customer" },
      { status: 500 }
    )
  }
}

// POST /api/credit-customers/[id] - Record settlement
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission(PERMISSIONS.SETTLEMENT_RECORD)
  if (auth.error) return auth.error

  // Verify user exists in database (handles stale sessions after db:clean)
  const userExists = await prisma.user.findUnique({
    where: { id: auth.user!.id },
    select: { id: true }
  })

  if (!userExists) {
    return NextResponse.json(
      { success: false, error: "Session expired. Please logout and login again." },
      { status: 401 }
    )
  }

  const { id } = await params

  try {
    // Validate request body
    const validation = await validateRequestBody(request, createSettlementSchema)
    if ("error" in validation) return validation.error
    const body = validation.data

    const customer = await prisma.creditCustomer.findUnique({
      where: { id },
    })

    if (!customer) {
      return NextResponse.json(
        { success: false, error: "Customer not found" },
        { status: 404 }
      )
    }

    // Calculate current outstanding
    const currentOutstanding = await calculateOutstanding(id)

    if (body.amount > currentOutstanding) {
      return NextResponse.json(
        {
          success: false,
          error: "Settlement amount cannot exceed outstanding balance",
        },
        { status: 400 }
      )
    }

    const balanceAfter = currentOutstanding - body.amount

    // Create settlement transaction
    const transaction = await prisma.creditTransaction.create({
      data: {
        customerId: id,
        type: "SETTLEMENT",
        amount: body.amount,
        paymentMethod: body.paymentMethod,
        reference: body.reference || null,
        notes: body.notes || null,
        date: new Date(body.date),
        createdBy: auth.user!.id,
        balanceAfter,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    })

    await createAuditLog({
      action: "SETTLEMENT_RECORDED",
      userId: auth.user!.id,
      targetId: transaction.id,
      details: {
        customerId: id,
        customerName: customer.name,
        amount: body.amount,
        paymentMethod: body.paymentMethod,
        reference: body.reference || null,
        balanceAfter,
      },
      ipAddress: getClientIpFromRequest(request),
      userAgent: getUserAgentFromRequest(request),
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          ...transaction,
          amount: Number(transaction.amount),
          balanceAfter: Number(transaction.balanceAfter),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error recording settlement:", error)
    return NextResponse.json(
      { success: false, error: "Failed to record settlement" },
      { status: 500 }
    )
  }
}

// Helper function to calculate outstanding balance
async function calculateOutstanding(customerId: string): Promise<number> {
  const transactions = await prisma.creditTransaction.findMany({
    where: { customerId },
  })

  return transactions.reduce((sum, tx) => {
    if (tx.type === "CREDIT_SALE") {
      return sum + Number(tx.amount)
    } else {
      return sum - Number(tx.amount)
    }
  }, 0)
}
