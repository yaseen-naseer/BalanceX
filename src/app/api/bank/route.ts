import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/api-auth"
import { PERMISSIONS } from "@/lib/permissions"
import {
  createBankTransactionSchema,
  updateBankTransactionSchema,
  bankSettingsSchema,
  validateRequestBody,
} from "@/lib/validations"
import { createAuditLog, getClientIpFromRequest, getUserAgentFromRequest } from "@/lib/audit"

// GET /api/bank - Get bank transactions and balance
export async function GET(request: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.BANK_VIEW)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const month = searchParams.get("month") // Format: YYYY-MM
  const type = searchParams.get("type") as "DEPOSIT" | "WITHDRAWAL" | null
  const limit = parseInt(searchParams.get("limit") || "50")
  const offset = parseInt(searchParams.get("offset") || "0")

  try {
    // Get bank settings (opening balance)
    const settings = await prisma.bankSettings.findFirst({
      orderBy: { openingDate: "desc" },
    })

    const where: {
      type?: "DEPOSIT" | "WITHDRAWAL"
      date?: { gte: Date; lte: Date }
    } = {}

    if (type) {
      where.type = type
    }

    if (month) {
      const [year, monthNum] = month.split("-").map(Number)
      const startDate = new Date(year, monthNum - 1, 1)
      const endDate = new Date(year, monthNum, 0)
      where.date = { gte: startDate, lte: endDate }
    }

    // Get transactions
    const transactions = await prisma.bankTransaction.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
      take: limit,
      skip: offset,
    })

    const total = await prisma.bankTransaction.count({ where })

    // Calculate current balance
    const allTransactions = await prisma.bankTransaction.findMany({
      orderBy: { date: "asc" },
    })

    const openingBalance = settings ? Number(settings.openingBalance) : 0
    let currentBalance = openingBalance

    for (const tx of allTransactions) {
      if (tx.type === "DEPOSIT") {
        currentBalance += Number(tx.amount)
      } else {
        currentBalance -= Number(tx.amount)
      }
    }

    // Calculate monthly totals
    const monthlyDeposits = transactions
      .filter((tx) => tx.type === "DEPOSIT")
      .reduce((sum, tx) => sum + Number(tx.amount), 0)

    const monthlyWithdrawals = transactions
      .filter((tx) => tx.type === "WITHDRAWAL")
      .reduce((sum, tx) => sum + Number(tx.amount), 0)

    return NextResponse.json({
      success: true,
      data: {
        currentBalance,
        openingBalance,
        openingDate: settings?.openingDate || null,
        monthlyDeposits,
        monthlyWithdrawals,
        transactions: transactions.map((tx) => ({
          ...tx,
          amount: Number(tx.amount),
          balanceAfter: Number(tx.balanceAfter),
        })),
      },
      pagination: { total, limit, offset },
    })
  } catch (error) {
    console.error("Error fetching bank data:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch bank data" },
      { status: 500 }
    )
  }
}

// POST /api/bank - Create bank transaction
export async function POST(request: NextRequest) {
  // Validate request body first
  const validation = await validateRequestBody(request, createBankTransactionSchema)
  if ("error" in validation) return validation.error
  const body = validation.data

  // Check permission based on transaction type
  const permission =
    body.type === "DEPOSIT" ? PERMISSIONS.BANK_DEPOSIT : PERMISSIONS.BANK_WITHDRAW
  const auth = await requirePermission(permission)
  if (auth.error) return auth.error

  try {

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

    // Calculate current balance before this transaction
    const settings = await prisma.bankSettings.findFirst({
      orderBy: { openingDate: "desc" },
    })

    const allTransactions = await prisma.bankTransaction.findMany({
      where: {
        date: { lte: new Date(body.date) },
      },
      orderBy: { date: "asc" },
    })

    let balanceBefore = settings ? Number(settings.openingBalance) : 0
    for (const tx of allTransactions) {
      if (tx.type === "DEPOSIT") {
        balanceBefore += Number(tx.amount)
      } else {
        balanceBefore -= Number(tx.amount)
      }
    }

    const balanceAfter =
      body.type === "DEPOSIT"
        ? balanceBefore + body.amount
        : balanceBefore - body.amount

    const transaction = await prisma.bankTransaction.create({
      data: {
        type: body.type,
        amount: body.amount,
        reference: body.reference,
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
      action: "BANK_TRANSACTION_ADDED",
      userId: auth.user!.id,
      targetId: transaction.id,
      details: {
        type: body.type,
        amount: body.amount,
        reference: body.reference,
        date: body.date,
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
    console.error("Error creating bank transaction:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create bank transaction" },
      { status: 500 }
    )
  }
}

// PATCH /api/bank - Update bank settings (opening balance)
export async function PATCH(request: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.BANK_SET_OPENING)
  if (auth.error) return auth.error

  try {
    // Validate request body
    const validation = await validateRequestBody(request, bankSettingsSchema)
    if ("error" in validation) return validation.error
    const body = validation.data

    // Use provided date or default to today
    const openingDate = body.openingDate ? new Date(body.openingDate) : new Date()

    const settings = await prisma.bankSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        openingBalance: body.openingBalance,
        openingDate: openingDate,
      },
      update: {
        openingBalance: body.openingBalance,
        openingDate: openingDate,
      },
    })

    await createAuditLog({
      action: "SETTINGS_CHANGED",
      userId: auth.user!.id,
      details: {
        setting: "bank_opening_balance",
        openingBalance: body.openingBalance,
        openingDate: openingDate.toISOString().slice(0, 10),
      },
      ipAddress: getClientIpFromRequest(request),
      userAgent: getUserAgentFromRequest(request),
    })

    return NextResponse.json({
      success: true,
      data: {
        ...settings,
        openingBalance: Number(settings.openingBalance),
      },
    })
  } catch (error) {
    console.error("Error updating bank settings:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update bank settings" },
      { status: 500 }
    )
  }
}

// DELETE /api/bank - Delete bank transaction (Owner only)
export async function DELETE(request: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.BANK_TRANSACTION_DELETE)
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Transaction ID is required" },
        { status: 400 }
      )
    }

    // Get the transaction to be deleted first
    const transactionToDelete = await prisma.bankTransaction.findUnique({
      where: { id },
    })

    if (!transactionToDelete) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      )
    }

    // Delete the transaction
    await prisma.bankTransaction.delete({
      where: { id },
    })

    // Recalculate balances for all subsequent transactions
    // Get all transactions ordered by date to recalculate running balances
    const settings = await prisma.bankSettings.findFirst({
      orderBy: { openingDate: "desc" },
    })

    const allTransactions = await prisma.bankTransaction.findMany({
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    })

    // Recalculate running balances
    let runningBalance = settings ? Number(settings.openingBalance) : 0

    for (const tx of allTransactions) {
      if (tx.type === "DEPOSIT") {
        runningBalance += Number(tx.amount)
      } else {
        runningBalance -= Number(tx.amount)
      }

      // Update if balance changed
      if (Number(tx.balanceAfter) !== runningBalance) {
        await prisma.bankTransaction.update({
          where: { id: tx.id },
          data: { balanceAfter: runningBalance },
        })
      }
    }

    await createAuditLog({
      action: "BANK_TRANSACTION_DELETED",
      userId: auth.user!.id,
      targetId: id,
      details: {
        type: transactionToDelete.type,
        amount: Number(transactionToDelete.amount),
        reference: transactionToDelete.reference,
        date: transactionToDelete.date,
      },
      ipAddress: getClientIpFromRequest(request),
      userAgent: getUserAgentFromRequest(request),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting bank transaction:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete bank transaction" },
      { status: 500 }
    )
  }
}

// PUT /api/bank - Edit bank transaction (Owner/Accountant)
export async function PUT(request: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.BANK_TRANSACTION_EDIT)
  if (auth.error) return auth.error

  try {
    // Validate request body
    const validation = await validateRequestBody(request, updateBankTransactionSchema)
    if ("error" in validation) return validation.error
    const { id, reference, notes } = validation.data

    const existingTransaction = await prisma.bankTransaction.findUnique({
      where: { id },
    })

    if (!existingTransaction) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      )
    }

    const updatedTransaction = await prisma.bankTransaction.update({
      where: { id },
      data: {
        reference: reference ?? existingTransaction.reference,
        notes: notes !== undefined ? notes : existingTransaction.notes,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...updatedTransaction,
        amount: Number(updatedTransaction.amount),
        balanceAfter: Number(updatedTransaction.balanceAfter),
      },
    })
  } catch (error) {
    console.error("Error updating bank transaction:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update bank transaction" },
      { status: 500 }
    )
  }
}
