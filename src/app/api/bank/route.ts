import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/api-auth"
import { PERMISSIONS } from "@/lib/permissions"
import {
  createBankTransactionSchema,
  updateBankTransactionSchema,
  validateRequestBody,
} from "@/lib/validations"
import { monthParamSchema } from "@/lib/validations/schemas"
import { createAuditLog, getClientIpFromRequest, getUserAgentFromRequest } from "@/lib/audit"
import { withTransaction } from "@/lib/utils/atomic"
import { recalculateBankBalancesFrom, getCurrentBankBalance } from "@/lib/bank-utils"
import { logError } from "@/lib/logger"
import { ApiErrors, successResponse, successOk } from "@/lib/api-response"

// GET /api/bank - Get bank transactions and balance
export async function GET(request: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.BANK_VIEW)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const month = searchParams.get("month") // Format: YYYY-MM
  const type = searchParams.get("type") as "DEPOSIT" | "WITHDRAWAL" | null
  // `limit=0` is a documented sentinel meaning "no pagination" — the bank ledger UI
  // uses it to load every transaction for client-side month filtering. Cap at 5000
  // to keep the DoS protection intent of audit 0.5 (well above any realistic
  // small-shop volume of ~365 txs/year for ~10 years).
  const rawLimit = parseInt(searchParams.get("limit") || "50")
  const limit = rawLimit === 0 ? 5000 : Math.min(Math.max(rawLimit, 1), 5000)
  const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0)

  if (month) {
    const monthValidation = monthParamSchema.safeParse(month)
    if (!monthValidation.success) {
      return ApiErrors.badRequest("Invalid month format. Expected YYYY-MM")
    }
  }

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

    const transactions = await prisma.bankTransaction.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: limit,
      skip: offset,
    })

    const openingBalance = settings ? Number(settings.openingBalance) : 0
    const currentBalance = await getCurrentBankBalance()

    // Calculate monthly totals
    const monthlyDeposits = transactions
      .filter((tx) => tx.type === "DEPOSIT")
      .reduce((sum, tx) => sum + Number(tx.amount), 0)

    const monthlyWithdrawals = transactions
      .filter((tx) => tx.type === "WITHDRAWAL")
      .reduce((sum, tx) => sum + Number(tx.amount), 0)

    return successResponse({
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
    })
  } catch (error) {
    logError("Error fetching bank data", error)
    return ApiErrors.serverError("Failed to fetch bank data")
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
      return ApiErrors.sessionExpired()
    }

    // Atomic: calculate balance + create in a single serializable transaction
    const transaction = await withTransaction(async (tx) => {
      const currentBalance = await getCurrentBankBalance(tx)
      const balanceAfter =
        body.type === "DEPOSIT"
          ? currentBalance + body.amount
          : currentBalance - body.amount

      return tx.bankTransaction.create({
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

    return successResponse(
      {
        ...transaction,
        amount: Number(transaction.amount),
        balanceAfter: Number(transaction.balanceAfter),
      },
      201
    )
  } catch (error) {
    logError("Error creating bank transaction", error)
    return ApiErrors.serverError("Failed to create bank transaction")
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
      return ApiErrors.badRequest("Transaction ID is required")
    }

    // Get the transaction to be deleted first
    const transactionToDelete = await prisma.bankTransaction.findUnique({
      where: { id },
    })

    if (!transactionToDelete) {
      return ApiErrors.notFound("Transaction")
    }

    // Block deletion of auto-created wallet top-up transactions
    if (transactionToDelete.reference === "Wallet Top-up" && transactionToDelete.notes?.startsWith("Auto-created from wallet top-up")) {
      return ApiErrors.badRequest("This transaction was auto-created from a wallet top-up. Delete the top-up from the Wallet page instead.")
    }

    // Block deletion of auto-created transfer sale deposits
    if (transactionToDelete.reference === "Transfer Sale" && transactionToDelete.notes?.startsWith("Auto-created from transfer sale")) {
      return ApiErrors.badRequest("This transaction was auto-created from a transfer sale. Delete the sale line item instead.")
    }

    // Atomic: delete + recalculate balances from the affected date onward.
    await withTransaction(async (tx) => {
      await tx.bankTransaction.delete({ where: { id } })
      await recalculateBankBalancesFrom(transactionToDelete.date, tx)
    })

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

    return successOk()
  } catch (error) {
    logError("Error deleting bank transaction", error)
    return ApiErrors.serverError("Failed to delete bank transaction")
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
      return ApiErrors.notFound("Transaction")
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

    return successResponse({
      ...updatedTransaction,
      amount: Number(updatedTransaction.amount),
      balanceAfter: Number(updatedTransaction.balanceAfter),
    })
  } catch (error) {
    logError("Error updating bank transaction", error)
    return ApiErrors.serverError("Failed to update bank transaction")
  }
}
