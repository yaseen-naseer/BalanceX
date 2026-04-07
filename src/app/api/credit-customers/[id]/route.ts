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
import { withTransaction } from "@/lib/utils/atomic"
import { calculateCustomerOutstanding } from "@/lib/calculations/credit"
import { CURRENCY_CODE } from "@/lib/constants"
import { logError } from "@/lib/logger"

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
    logError("Error fetching credit customer", error)
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

    // B4: Check outstanding balance before deactivation (non-Owner blocked)
    if (body.isActive === false && customer.isActive) {
      const outstanding = await calculateCustomerOutstanding(id)
      if (outstanding > 0 && auth.user!.role !== "OWNER") {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot deactivate: outstanding balance of ${outstanding.toLocaleString()} ${CURRENCY_CODE}. Owner approval required.`,
            outstandingBalance: outstanding,
          },
          { status: 400 }
        )
      }
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
    logError("Error updating credit customer", error)
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

    // Atomic: calculate outstanding + validate + create settlement in single transaction (S4)
    let transaction: Awaited<ReturnType<typeof prisma.creditTransaction.create>>
    let balanceAfter: number

    try {
      const result = await withTransaction(async (tx) => {
        // Calculate current outstanding inside transaction for atomicity
        const transactions = await tx.creditTransaction.findMany({
          where: { customerId: id },
        })

        const currentOutstanding = transactions.reduce((sum, t) => {
          if (t.type === "CREDIT_SALE") {
            return sum + Number(t.amount)
          } else {
            return sum - Number(t.amount)
          }
        }, 0)

        if (body.amount > currentOutstanding) {
          throw { type: "EXCEEDS_BALANCE", currentOutstanding }
        }

        const bal = currentOutstanding - body.amount

        const tx_result = await tx.creditTransaction.create({
          data: {
            customerId: id,
            type: "SETTLEMENT",
            amount: body.amount,
            paymentMethod: body.paymentMethod,
            reference: body.reference || null,
            notes: body.notes || null,
            date: new Date(body.date),
            createdBy: auth.user!.id,
            balanceAfter: bal,
          },
          include: {
            user: { select: { id: true, name: true } },
          },
        })

        return { transaction: tx_result, balanceAfter: bal }
      })

      transaction = result.transaction
      balanceAfter = result.balanceAfter
    } catch (err: unknown) {
      if (err && typeof err === "object" && "type" in err && (err as { type: string }).type === "EXCEEDS_BALANCE") {
        return NextResponse.json(
          {
            success: false,
            error: "Settlement amount cannot exceed outstanding balance",
          },
          { status: 400 }
        )
      }
      throw err
    }

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
    logError("Error recording settlement", error)
    return NextResponse.json(
      { success: false, error: "Failed to record settlement" },
      { status: 500 }
    )
  }
}

