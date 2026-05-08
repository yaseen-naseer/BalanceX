import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/api-auth"
import { PERMISSIONS } from "@/lib/permissions"
import {
  createWalletTopupSchema,
  updateWalletTopupSchema,
  walletSettingsSchema,
  validateRequestBody,
} from "@/lib/validations"
import { monthParamSchema, dateParamSchema } from "@/lib/validations/schemas"
import { createAuditLog, getClientIpFromRequest, getUserAgentFromRequest } from "@/lib/audit"
import { logError } from "@/lib/logger"
import { calculateReloadWalletCost } from "@/lib/utils/balance"
import { getWholesaleReloadTotal } from "@/lib/utils/wholesale-reload"
import { recalculateBankBalancesFrom, getCurrentBankBalance } from "@/lib/bank-utils"
import { ApiErrors, successResponse, successOk } from "@/lib/api-response"

// GET /api/wallet - Get wallet data and top-ups
export async function GET(request: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.WALLET_VIEW)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const month = searchParams.get("month") // Format: YYYY-MM
  // Same convention as bank: `limit=0` = "no pagination" (used by the wallet page
  // for client-side month filtering); else clamp to [1, 5000] for DoS protection.
  const rawLimit = parseInt(searchParams.get("limit") || "50")
  const limit = rawLimit === 0 ? 5000 : Math.min(Math.max(rawLimit, 1), 5000)
  const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0)
  const previousClosingForRaw = searchParams.get("previousClosingFor") // Format: YYYY-MM-DD

  if (month) {
    const monthValidation = monthParamSchema.safeParse(month)
    if (!monthValidation.success) {
      return ApiErrors.badRequest("Invalid month format. Expected YYYY-MM")
    }
  }

  let previousClosingFor: string | null = null
  if (previousClosingForRaw !== null) {
    const validation = dateParamSchema.safeParse(previousClosingForRaw)
    if (!validation.success) {
      return ApiErrors.badRequest(validation.error.issues[0]?.message ?? "Invalid previousClosingFor date")
    }
    previousClosingFor = validation.data
  }

  // If requesting previous day's closing for a specific date
  if (previousClosingFor) {
    try {
      const targetDate = new Date(previousClosingFor)
      targetDate.setUTCHours(0, 0, 0, 0)

      // Find the most recent entry with wallet data before target date (handles gaps/month boundaries)
      const previousEntry = await prisma.dailyEntry.findFirst({
        where: {
          date: { lt: targetDate },
          wallet: { isNot: null },
        },
        include: { wallet: true },
        orderBy: { date: "desc" },
      })

      if (previousEntry?.wallet && Number(previousEntry.wallet.closingActual) > 0) {
        return successResponse({
          previousClosing: Number(previousEntry.wallet.closingActual),
          previousDate: previousEntry.date.toISOString(),
          source: "PREVIOUS_DAY" as const,
        })
      }

      // No usable previous closing — calculate the running balance up to the target date
      // This matches the wallet page's currentBalance calculation
      const settings = await prisma.walletSettings.findFirst({
        orderBy: { openingDate: "desc" },
      })
      const openingBalance = settings ? Number(settings.openingBalance) : 0

      // All top-ups before the target date — sum via aggregate (single SQL SUM
      // instead of pulling every row + JS reduce; identical semantics).
      const topupAgg = await prisma.walletTopup.aggregate({
        _sum: { amount: true },
        where: { date: { lt: targetDate } },
      })
      const totalTopups = Number(topupAgg._sum.amount ?? 0)

      // All reload sales before the target date (retail reload strips 8% GST for wallet cost)
      const reloadCategories = await prisma.dailyEntryCategory.findMany({
        where: {
          category: { in: ["RETAIL_RELOAD", "WHOLESALE_RELOAD"] },
          dailyEntry: { date: { lt: targetDate } },
        },
      })
      const wholesaleReload = await getWholesaleReloadTotal({ beforeDate: targetDate })
      const totalReloadSales = calculateReloadWalletCost(reloadCategories, wholesaleReload)

      const calculatedBalance = openingBalance + totalTopups - totalReloadSales

      return successResponse({
        previousClosing: calculatedBalance,
        previousDate: previousEntry?.date?.toISOString() || null,
        source: (previousEntry ? "PREVIOUS_DAY" : "INITIAL_SETUP") as "PREVIOUS_DAY" | "INITIAL_SETUP",
      })
    } catch (error) {
      logError("Error fetching previous closing", error)
      return ApiErrors.serverError("Failed to fetch previous closing")
    }
  }

  try {
    // Get wallet settings (opening balance)
    const settings = await prisma.walletSettings.findFirst({
      orderBy: { openingDate: "desc" },
    })

    const where: { date?: { gte: Date; lte: Date } } = {}

    if (month) {
      const [year, monthNum] = month.split("-").map(Number)
      const startDate = new Date(year, monthNum - 1, 1)
      const endDate = new Date(year, monthNum, 0)
      where.date = { gte: startDate, lte: endDate }
    }

    // Get top-ups
    const topups = await prisma.walletTopup.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
      take: limit,
      skip: offset,
    })

    // Calculate totals
    const openingBalance = settings ? Number(settings.openingBalance) : 0

    // All-time top-up total — single SQL SUM (was reading every row + JS reduce).
    const allTopupsAgg = await prisma.walletTopup.aggregate({
      _sum: { amount: true },
    })
    const totalTopups = Number(allTopupsAgg._sum.amount ?? 0)

    // Get reload sales from daily entries
    const reloadCategories = await prisma.dailyEntryCategory.findMany({
      where: {
        category: { in: ["RETAIL_RELOAD", "WHOLESALE_RELOAD"] },
      },
    })

    const allWholesaleReload = await getWholesaleReloadTotal()
    const totalReloadSales = calculateReloadWalletCost(reloadCategories, allWholesaleReload)

    const currentBalance = openingBalance + totalTopups - totalReloadSales

    // Monthly breakdown
    const monthlyTopups = topups.reduce((sum, t) => sum + Number(t.amount), 0)
    const cashTopups = topups
      .filter((t) => t.source === "CASH")
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const bankTopups = topups
      .filter((t) => t.source === "BANK")
      .reduce((sum, t) => sum + Number(t.amount), 0)

    // Today's activity
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    // Calculate this month's reload usage
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)

    const monthlyReloadCategories = await prisma.dailyEntryCategory.findMany({
      where: {
        category: { in: ["RETAIL_RELOAD", "WHOLESALE_RELOAD"] },
        dailyEntry: {
          date: { gte: currentMonthStart, lte: currentMonthEnd },
        },
      },
    })

    const monthlyWholesaleReload = await getWholesaleReloadTotal({
      dateRange: { gte: currentMonthStart, lte: currentMonthEnd },
    })
    const monthlyUsage = calculateReloadWalletCost(monthlyReloadCategories, monthlyWholesaleReload)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todayTopups = await prisma.walletTopup.findMany({
      where: {
        date: { gte: today, lt: tomorrow },
      },
    })

    const todayEntry = await prisma.dailyEntry.findUnique({
      where: { date: today },
      include: {
        wallet: true,
        categories: {
          where: {
            category: { in: ["RETAIL_RELOAD", "WHOLESALE_RELOAD"] },
          },
        },
      },
    })

    const todayTopupsTotal = todayTopups.reduce((sum, t) => sum + Number(t.amount), 0)
    const todayWholesaleReload = todayEntry
      ? await getWholesaleReloadTotal({ dailyEntryId: todayEntry.id })
      : 0
    const todayReloadSales = todayEntry?.categories
      ? calculateReloadWalletCost(todayEntry.categories, todayWholesaleReload)
      : 0

    return successResponse({
      currentBalance,
      openingBalance,
      openingDate: settings?.openingDate || null,
      settings: settings
        ? { ...settings, openingBalance: Number(settings.openingBalance) }
        : null,
      monthlyTopups,
      monthlyUsage,
      topupsBySource: {
        cash: cashTopups,
        bank: bankTopups,
      },
      todayActivity: {
        opening: todayEntry?.wallet ? Number(todayEntry.wallet.opening) : openingBalance,
        topups: todayTopupsTotal,
        reloadSales: todayReloadSales,
        expected: (todayEntry?.wallet ? Number(todayEntry.wallet.opening) : openingBalance) + todayTopupsTotal - todayReloadSales,
        actual: todayEntry?.wallet ? Number(todayEntry.wallet.closingActual) : null,
        variance: todayEntry?.wallet ? Number(todayEntry.wallet.variance) : null,
      },
      topups: topups.map((t) => ({
        ...t,
        amount: Number(t.amount),
      })),
    })
  } catch (error) {
    logError("Error fetching wallet data", error)
    return ApiErrors.serverError("Failed to fetch wallet data")
  }
}

// POST /api/wallet - Add wallet top-up
export async function POST(request: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.WALLET_ADD_TOPUP)
  if (auth.error) return auth.error

  try {
    // Validate request body
    const validation = await validateRequestBody(request, createWalletTopupSchema)
    if ("error" in validation) return validation.error
    const body = validation.data

    // Verify user exists in database (handles stale sessions after db:clean)
    const userExists = await prisma.user.findUnique({
      where: { id: auth.user!.id },
      select: { id: true }
    })

    if (!userExists) {
      return ApiErrors.sessionExpired()
    }

    const topup = await prisma.$transaction(async (tx) => {
      const created = await tx.walletTopup.create({
        data: {
          amount: body.amount,
          paidAmount: body.paidAmount ?? body.amount,
          source: body.source,
          notes: body.notes || null,
          date: new Date(body.date),
          splitGroupId: body.splitGroupId || null,
          createdBy: auth.user!.id,
        },
        include: {
          user: { select: { id: true, name: true } },
        },
      })

      // If source is BANK, create a bank withdrawal in the same transaction
      // and link it via FK so future edits/deletes don't rely on content matching (S1).
      if (body.source === "BANK") {
        const currentBalance = await getCurrentBankBalance(tx)
        const bankAmount = body.paidAmount ?? body.amount
        const bankTx = await tx.bankTransaction.create({
          data: {
            type: "WITHDRAWAL",
            amount: bankAmount,
            reference: `Wallet Top-up`,
            notes: `Auto-created from wallet top-up (reload: ${body.amount})`,
            date: new Date(body.date),
            createdBy: auth.user!.id,
            balanceAfter: currentBalance - bankAmount,
          },
        })

        await tx.walletTopup.update({
          where: { id: created.id },
          data: { bankTransactionId: bankTx.id },
        })
      }

      return created
    })

    await createAuditLog({
      action: "WALLET_TOPUP_ADDED",
      userId: auth.user!.id,
      targetId: topup.id,
      details: {
        amount: body.amount,
        source: body.source,
        date: body.date,
      },
      ipAddress: getClientIpFromRequest(request),
      userAgent: getUserAgentFromRequest(request),
    })

    return successResponse(
      {
        ...topup,
        amount: Number(topup.amount),
      },
      201
    )
  } catch (error) {
    logError("Error creating wallet top-up", error)
    return ApiErrors.serverError("Failed to create wallet top-up")
  }
}

// PATCH /api/wallet - Update wallet settings (opening balance)
export async function PATCH(request: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.WALLET_SET_OPENING)
  if (auth.error) return auth.error

  try {
    // Validate request body
    const validation = await validateRequestBody(request, walletSettingsSchema)
    if ("error" in validation) return validation.error
    const body = validation.data

    const openingDate = body.openingDate ? new Date(body.openingDate) : new Date()
    openingDate.setUTCHours(0, 0, 0, 0)

    const existing = await prisma.walletSettings.findUnique({ where: { id: "default" } })
    const oldOpeningBalance = existing ? Number(existing.openingBalance) : null
    const oldOpeningDate = existing ? existing.openingDate.toISOString().slice(0, 10) : null

    const settings = await prisma.walletSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        openingBalance: body.openingBalance,
        openingDate,
      },
      update: {
        openingBalance: body.openingBalance,
        openingDate,
      },
    })

    await createAuditLog({
      action: "SETTINGS_CHANGED",
      userId: auth.user!.id,
      details: {
        scope: "wallet_opening_balance",
        oldOpeningBalance,
        newOpeningBalance: body.openingBalance,
        oldOpeningDate,
        newOpeningDate: openingDate.toISOString().slice(0, 10),
        reason: body.reason,
      },
      ipAddress: getClientIpFromRequest(request),
      userAgent: getUserAgentFromRequest(request),
    })

    return successResponse({
      ...settings,
      openingBalance: Number(settings.openingBalance),
    })
  } catch (error) {
    logError("Error updating wallet settings", error)
    return ApiErrors.serverError("Failed to update wallet settings")
  }
}

// PUT /api/wallet - Edit a single (non-split) wallet top-up
export async function PUT(request: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.WALLET_ADD_TOPUP)
  if (auth.error) return auth.error

  try {
    const validation = await validateRequestBody(request, updateWalletTopupSchema)
    if ("error" in validation) return validation.error
    const { id, amount, paidAmount, source, notes } = validation.data

    const topup = await prisma.walletTopup.findUnique({ where: { id } })
    if (!topup) {
      return ApiErrors.notFound("Top-up")
    }

    // Block edits on split payments
    if (topup.splitGroupId) {
      return ApiErrors.badRequest("Cannot edit split payments. Delete and re-add instead.")
    }

    const oldSource = topup.source
    const oldAmount = Number(topup.amount)
    const newSource = source
    const newPaidAmount = paidAmount ?? amount

    const updated = await prisma.$transaction(async (tx) => {
      // If old source was BANK, remove the old bank withdrawal.
      // Prefer the FK (post-backfill); fall back to content match for legacy rows (S1).
      if (oldSource === "BANK") {
        if (topup.bankTransactionId) {
          await tx.bankTransaction.delete({ where: { id: topup.bankTransactionId } }).catch(() => {
            // Bank tx may have been independently deleted; safe to ignore.
          })
        } else {
          const bankTx = await tx.bankTransaction.findFirst({
            where: {
              type: "WITHDRAWAL",
              amount: topup.paidAmount ?? topup.amount,
              date: topup.date,
              reference: "Wallet Top-up",
            },
          })
          if (bankTx) {
            await tx.bankTransaction.delete({ where: { id: bankTx.id } })
          }
        }
      }

      // Update the top-up. Reset bankTransactionId — it will be set below if new source is BANK.
      const updatedTopup = await tx.walletTopup.update({
        where: { id },
        data: {
          amount,
          paidAmount: newPaidAmount,
          source: newSource,
          notes: notes || null,
          bankTransactionId: null,
        },
      })

      // If new source is BANK, create a new bank withdrawal and link the FK.
      if (newSource === "BANK") {
        const currentBalance = await getCurrentBankBalance(tx)
        const bankTx = await tx.bankTransaction.create({
          data: {
            type: "WITHDRAWAL",
            amount: newPaidAmount,
            reference: "Wallet Top-up",
            notes: `Auto-created from wallet top-up (reload: ${amount})`,
            date: topup.date,
            createdBy: auth.user!.id,
            balanceAfter: currentBalance - newPaidAmount,
          },
        })

        await tx.walletTopup.update({
          where: { id },
          data: { bankTransactionId: bankTx.id },
        })
      }

      // Recalculate bank balances if source changed.
      // Anchor = topup.date — split topups (which we don't allow editing of anyway)
      // share a date, and a single topup edit doesn't change the date.
      if (oldSource === "BANK" || newSource === "BANK") {
        await recalculateBankBalancesFrom(topup.date, tx)
      }

      return updatedTopup
    })

    await createAuditLog({
      action: "WALLET_TOPUP_EDITED",
      userId: auth.user!.id,
      targetId: id,
      details: {
        oldAmount,
        newAmount: amount,
        oldSource,
        newSource,
      },
      ipAddress: getClientIpFromRequest(request),
      userAgent: getUserAgentFromRequest(request),
    })

    return successResponse({ ...updated, amount: Number(updated.amount) })
  } catch (error) {
    logError("Error editing wallet top-up", error)
    return ApiErrors.serverError("Failed to edit wallet top-up")
  }
}

// DELETE /api/wallet - Delete wallet top-up (or entire split group)
export async function DELETE(request: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.WALLET_DELETE_TOPUP)
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return ApiErrors.badRequest("Top-up ID is required")
    }

    // Get the top-up first
    const topup = await prisma.walletTopup.findUnique({ where: { id } })
    if (!topup) {
      return ApiErrors.notFound("Top-up")
    }

    const topupsToDelete = await prisma.$transaction(async (tx) => {
      // Determine which top-ups to delete (single or entire split group)
      const toDelete = topup.splitGroupId
        ? await tx.walletTopup.findMany({ where: { splitGroupId: topup.splitGroupId } })
        : [topup]

      // Delete associated bank withdrawals for BANK-sourced top-ups.
      // Prefer the FK (post-backfill); fall back to content match for legacy rows (S1).
      for (const t of toDelete) {
        if (t.source === "BANK") {
          if (t.bankTransactionId) {
            await tx.bankTransaction.delete({ where: { id: t.bankTransactionId } }).catch(() => {
              // Bank tx may have been independently deleted; safe to ignore.
            })
          } else {
            const bankTx = await tx.bankTransaction.findFirst({
              where: {
                type: "WITHDRAWAL",
                amount: t.paidAmount ?? t.amount,
                date: t.date,
                reference: "Wallet Top-up",
              },
            })
            if (bankTx) {
              await tx.bankTransaction.delete({ where: { id: bankTx.id } })
            }
          }
        }
      }

      // Delete the top-up(s)
      if (topup.splitGroupId) {
        await tx.walletTopup.deleteMany({ where: { splitGroupId: topup.splitGroupId } })
      } else {
        await tx.walletTopup.delete({ where: { id } })
      }

      // Recalculate bank balances if any BANK-sourced top-ups were deleted.
      // Anchor = earliest deleted topup date (split groups share a date, but
      // taking min handles any unexpected mixed-date case defensively).
      const deletedBankTopups = toDelete.filter((t) => t.source === "BANK")
      if (deletedBankTopups.length > 0) {
        const anchorDate = deletedBankTopups.reduce(
          (min, t) => (t.date < min ? t.date : min),
          deletedBankTopups[0].date,
        )
        await recalculateBankBalancesFrom(anchorDate, tx)
      }

      return toDelete
    })

    const totalDeleted = topupsToDelete.reduce((sum, t) => sum + Number(t.amount), 0)

    await createAuditLog({
      action: "WALLET_TOPUP_DELETED",
      userId: auth.user!.id,
      targetId: id,
      details: {
        amount: totalDeleted,
        count: topupsToDelete.length,
        splitGroup: topup.splitGroupId || null,
        sources: [...new Set(topupsToDelete.map((t) => t.source))],
        date: topup.date,
      },
      ipAddress: getClientIpFromRequest(request),
      userAgent: getUserAgentFromRequest(request),
    })

    return successOk()
  } catch (error) {
    logError("Error deleting wallet top-up", error)
    return ApiErrors.serverError("Failed to delete wallet top-up")
  }
}
