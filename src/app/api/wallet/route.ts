import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/api-auth"
import { PERMISSIONS } from "@/lib/permissions"
import {
  createWalletTopupSchema,
  walletSettingsSchema,
  validateRequestBody,
} from "@/lib/validations"
import { monthParamSchema } from "@/lib/validations/schemas"
import { createAuditLog, getClientIpFromRequest, getUserAgentFromRequest } from "@/lib/audit"
import { logError } from "@/lib/logger"
import { calculateReloadWalletCost } from "@/lib/utils/balance"
import { getWholesaleReloadTotal } from "@/lib/utils/wholesale-reload"

// GET /api/wallet - Get wallet data and top-ups
export async function GET(request: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.WALLET_VIEW)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const month = searchParams.get("month") // Format: YYYY-MM
  const limit = parseInt(searchParams.get("limit") || "50")
  const offset = parseInt(searchParams.get("offset") || "0")
  const previousClosingFor = searchParams.get("previousClosingFor") // Format: YYYY-MM-DD

  if (month) {
    const monthValidation = monthParamSchema.safeParse(month)
    if (!monthValidation.success) {
      return NextResponse.json(
        { success: false, error: "Invalid month format. Expected YYYY-MM" },
        { status: 400 }
      )
    }
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
        return NextResponse.json({
          success: true,
          data: {
            previousClosing: Number(previousEntry.wallet.closingActual),
            previousDate: previousEntry.date.toISOString(),
            source: "PREVIOUS_DAY",
          },
        })
      }

      // No usable previous closing — calculate the running balance up to the target date
      // This matches the wallet page's currentBalance calculation
      const settings = await prisma.walletSettings.findFirst({
        orderBy: { openingDate: "desc" },
      })
      const openingBalance = settings ? Number(settings.openingBalance) : 0

      // All top-ups before the target date
      const topups = await prisma.walletTopup.findMany({
        where: { date: { lt: targetDate } },
      })
      const totalTopups = topups.reduce((sum, t) => sum + Number(t.amount), 0)

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

      return NextResponse.json({
        success: true,
        data: {
          previousClosing: calculatedBalance,
          previousDate: previousEntry?.date?.toISOString() || null,
          source: previousEntry ? "PREVIOUS_DAY" : "INITIAL_SETUP",
        },
      })
    } catch (error) {
      logError("Error fetching previous closing", error)
      return NextResponse.json(
        { success: false, error: "Failed to fetch previous closing" },
        { status: 500 }
      )
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

    const total = await prisma.walletTopup.count({ where })

    // Calculate totals
    const openingBalance = settings ? Number(settings.openingBalance) : 0

    // Get all top-ups
    const allTopups = await prisma.walletTopup.findMany()
    const totalTopups = allTopups.reduce((sum, t) => sum + Number(t.amount), 0)

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

    return NextResponse.json({
      success: true,
      data: {
        currentBalance,
        openingBalance,
        openingDate: settings?.openingDate || null,
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
      },
      pagination: { total, limit, offset },
    })
  } catch (error) {
    logError("Error fetching wallet data", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch wallet data" },
      { status: 500 }
    )
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
      return NextResponse.json(
        { success: false, error: "Session expired. Please logout and login again." },
        { status: 401 }
      )
    }

    const topup = await prisma.walletTopup.create({
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

    // If source is BANK, create a bank withdrawal
    if (body.source === "BANK") {
      const settings = await prisma.bankSettings.findFirst({
        orderBy: { openingDate: "desc" },
      })

      const allTransactions = await prisma.bankTransaction.findMany({
        orderBy: { date: "asc" },
      })

      let currentBalance = settings ? Number(settings.openingBalance) : 0
      for (const tx of allTransactions) {
        if (tx.type === "DEPOSIT") {
          currentBalance += Number(tx.amount)
        } else {
          currentBalance -= Number(tx.amount)
        }
      }

      const bankAmount = body.paidAmount ?? body.amount
      await prisma.bankTransaction.create({
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
    }

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

    return NextResponse.json(
      {
        success: true,
        data: {
          ...topup,
          amount: Number(topup.amount),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    logError("Error creating wallet top-up", error)
    return NextResponse.json(
      { success: false, error: "Failed to create wallet top-up" },
      { status: 500 }
    )
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
        setting: "wallet_opening_balance",
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
    logError("Error updating wallet settings", error)
    return NextResponse.json(
      { success: false, error: "Failed to update wallet settings" },
      { status: 500 }
    )
  }
}

// PUT /api/wallet - Edit a single (non-split) wallet top-up
export async function PUT(request: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.WALLET_ADD_TOPUP)
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const { id, amount, paidAmount, source, notes } = body

    if (!id || !amount || !source) {
      return NextResponse.json(
        { success: false, error: "ID, amount, and source are required" },
        { status: 400 }
      )
    }

    const topup = await prisma.walletTopup.findUnique({ where: { id } })
    if (!topup) {
      return NextResponse.json(
        { success: false, error: "Top-up not found" },
        { status: 404 }
      )
    }

    // Block edits on split payments
    if (topup.splitGroupId) {
      return NextResponse.json(
        { success: false, error: "Cannot edit split payments. Delete and re-add instead." },
        { status: 400 }
      )
    }

    const oldSource = topup.source
    const oldAmount = Number(topup.amount)
    const newSource = source === "Cash" ? "CASH" : source === "BANK" ? "BANK" : source
    const newPaidAmount = paidAmount ?? amount

    // If old source was BANK, remove the old bank withdrawal
    if (oldSource === "BANK") {
      const bankTx = await prisma.bankTransaction.findFirst({
        where: {
          type: "WITHDRAWAL",
          amount: topup.paidAmount ?? topup.amount,
          date: topup.date,
          reference: "Wallet Top-up",
        },
      })
      if (bankTx) {
        await prisma.bankTransaction.delete({ where: { id: bankTx.id } })
      }
    }

    // Update the top-up
    const updated = await prisma.walletTopup.update({
      where: { id },
      data: {
        amount,
        paidAmount: newPaidAmount,
        source: newSource,
        notes: notes || null,
      },
    })

    // If new source is BANK, create a new bank withdrawal
    if (newSource === "BANK") {
      const settings = await prisma.bankSettings.findFirst({
        orderBy: { openingDate: "desc" },
      })
      const allTransactions = await prisma.bankTransaction.findMany({
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      })
      let currentBalance = settings ? Number(settings.openingBalance) : 0
      for (const tx of allTransactions) {
        currentBalance += tx.type === "DEPOSIT" ? Number(tx.amount) : -Number(tx.amount)
      }

      await prisma.bankTransaction.create({
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
    }

    // Recalculate bank balances if source changed
    if (oldSource === "BANK" || newSource === "BANK") {
      const settings = await prisma.bankSettings.findFirst({
        orderBy: { openingDate: "desc" },
      })
      const allTransactions = await prisma.bankTransaction.findMany({
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      })
      let runningBalance = settings ? Number(settings.openingBalance) : 0
      for (const tx of allTransactions) {
        runningBalance += tx.type === "DEPOSIT" ? Number(tx.amount) : -Number(tx.amount)
        if (Number(tx.balanceAfter) !== runningBalance) {
          await prisma.bankTransaction.update({
            where: { id: tx.id },
            data: { balanceAfter: runningBalance },
          })
        }
      }
    }

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

    return NextResponse.json({
      success: true,
      data: { ...updated, amount: Number(updated.amount) },
    })
  } catch (error) {
    logError("Error editing wallet top-up", error)
    return NextResponse.json(
      { success: false, error: "Failed to edit wallet top-up" },
      { status: 500 }
    )
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
      return NextResponse.json(
        { success: false, error: "Top-up ID is required" },
        { status: 400 }
      )
    }

    // Get the top-up first
    const topup = await prisma.walletTopup.findUnique({ where: { id } })
    if (!topup) {
      return NextResponse.json(
        { success: false, error: "Top-up not found" },
        { status: 404 }
      )
    }

    // Determine which top-ups to delete (single or entire split group)
    const topupsToDelete = topup.splitGroupId
      ? await prisma.walletTopup.findMany({ where: { splitGroupId: topup.splitGroupId } })
      : [topup]

    // Delete associated bank withdrawals for BANK-sourced top-ups
    for (const t of topupsToDelete) {
      if (t.source === "BANK") {
        const bankTx = await prisma.bankTransaction.findFirst({
          where: {
            type: "WITHDRAWAL",
            amount: t.paidAmount ?? t.amount,
            date: t.date,
            reference: "Wallet Top-up",
          },
        })
        if (bankTx) {
          await prisma.bankTransaction.delete({ where: { id: bankTx.id } })
        }
      }
    }

    // Delete the top-up(s)
    if (topup.splitGroupId) {
      await prisma.walletTopup.deleteMany({ where: { splitGroupId: topup.splitGroupId } })
    } else {
      await prisma.walletTopup.delete({ where: { id } })
    }

    // Recalculate bank balances if any BANK-sourced top-ups were deleted
    if (topupsToDelete.some((t) => t.source === "BANK")) {
      const settings = await prisma.bankSettings.findFirst({
        orderBy: { openingDate: "desc" },
      })
      const allTransactions = await prisma.bankTransaction.findMany({
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      })
      let runningBalance = settings ? Number(settings.openingBalance) : 0
      for (const tx of allTransactions) {
        runningBalance += tx.type === "DEPOSIT" ? Number(tx.amount) : -Number(tx.amount)
        if (Number(tx.balanceAfter) !== runningBalance) {
          await prisma.bankTransaction.update({
            where: { id: tx.id },
            data: { balanceAfter: runningBalance },
          })
        }
      }
    }

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

    return NextResponse.json({ success: true })
  } catch (error) {
    logError("Error deleting wallet top-up", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete wallet top-up" },
      { status: 500 }
    )
  }
}
