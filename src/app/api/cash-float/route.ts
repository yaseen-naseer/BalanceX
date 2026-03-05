import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getAuthenticatedUser, requirePermission } from "@/lib/api-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { convertPrismaDecimals } from "@/lib/utils/serialize"
import {
  createCashFloatSchema,
  updateCashFloatSchema,
  validateRequestBody,
} from "@/lib/validations"
import { getCashSettlements, getWalletTopupsFromCash } from "@/lib/calculations/daily-entry"

// GET /api/cash-float?date=YYYY-MM-DD - Get cash float for a specific date
export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const date = searchParams.get("date")

  if (!date) {
    return NextResponse.json(
      { success: false, error: "Date parameter is required" },
      { status: 400 }
    )
  }

  try {
    const entryDate = new Date(date)
    entryDate.setUTCHours(0, 0, 0, 0)

    // Find the daily entry for this date
    const dailyEntry = await prisma.dailyEntry.findUnique({
      where: { date: entryDate },
      include: {
        cashFloat: true,
      },
    })

    if (!dailyEntry) {
      return NextResponse.json(
        { success: false, error: "No entry found for this date" },
        { status: 404 }
      )
    }

    // Get available float settings
    const floatSettings = await prisma.cashFloatSettings.findMany({
      where: { isActive: true },
      orderBy: { amount: "asc" },
    })

    return NextResponse.json({
      success: true,
      data: {
        cashFloat: dailyEntry.cashFloat
          ? convertPrismaDecimals(dailyEntry.cashFloat)
          : null,
        availableSettings: floatSettings.map((s) => ({
          ...s,
          amount: Number(s.amount),
        })),
      },
    })
  } catch (error) {
    console.error("Error fetching cash float:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch cash float" },
      { status: 500 }
    )
  }
}

// POST /api/cash-float - Create cash float for a daily entry
export async function POST(request: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.DAILY_ENTRY_CREATE)
  if (auth.error) return auth.error

  try {
    // Validate request body
    const validation = await validateRequestBody(request, createCashFloatSchema)
    if ("error" in validation) return validation.error
    const { dailyEntryId, selectedFloatId, shiftId } = validation.data

    // Check if float already exists
    const existingFloat = await prisma.cashFloatLog.findUnique({
      where: { dailyEntryId },
    })

    if (existingFloat) {
      return NextResponse.json(
        { success: false, error: "Cash float already exists for this entry" },
        { status: 409 }
      )
    }

    // Get the selected float amount
    let selectedFloatAmount = 0
    if (selectedFloatId) {
      const setting = await prisma.cashFloatSettings.findUnique({
        where: { id: selectedFloatId },
      })
      if (setting) {
        selectedFloatAmount = Number(setting.amount)
      }
    }

    // Get shift name if shiftId provided
    let shiftName = "Default"
    if (shiftId) {
      const shift = await prisma.shiftSettings.findUnique({
        where: { id: shiftId },
      })
      if (shift) {
        shiftName = shift.name
      }
    }

    // Create cash float log
    const cashFloat = await prisma.cashFloatLog.create({
      data: {
        dailyEntryId,
        shiftId,
        shiftName,
        selectedFloatId,
        selectedFloatAmount,
        openingTotal: 0,
        closingTotal: 0,
        variance: 0,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: convertPrismaDecimals(cashFloat),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating cash float:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create cash float" },
      { status: 500 }
    )
  }
}

// PATCH /api/cash-float - Update cash float (opening or closing)
export async function PATCH(request: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.DAILY_ENTRY_CREATE)
  if (auth.error) return auth.error

  try {
    // Validate request body
    const validation = await validateRequestBody(request, updateCashFloatSchema)
    if ("error" in validation) return validation.error
    const { id, type, ...data } = validation.data

    const existingFloat = await prisma.cashFloatLog.findUnique({
      where: { id },
      include: {
        dailyEntry: {
          include: { categories: true, cashDrawer: true },
        },
      },
    })

    if (!existingFloat) {
      return NextResponse.json(
        { success: false, error: "Cash float not found" },
        { status: 404 }
      )
    }

    let updateData: Record<string, unknown> = {}

    if (type === "opening") {
      // Calculate opening total from denominations
      const openingTotal =
        (data.openingMvr1000 || 0) * 1000 +
        (data.openingMvr500 || 0) * 500 +
        (data.openingMvr100 || 0) * 100 +
        (data.openingMvr50 || 0) * 50 +
        (data.openingMvr20 || 0) * 20 +
        (data.openingMvr10 || 0) * 10 +
        (data.openingMvr5 || 0) * 5 +
        (data.openingMvr2 || 0) * 2 +
        (data.openingMvr1 || 0) * 1 +
        (data.openingMvr050 || 0) * 0.5

      updateData = {
        openingFloatVerified: data.verified || false,
        openingFloatNotes: data.notes,
        openingMvr1000: data.openingMvr1000 || 0,
        openingMvr500: data.openingMvr500 || 0,
        openingMvr100: data.openingMvr100 || 0,
        openingMvr50: data.openingMvr50 || 0,
        openingMvr20: data.openingMvr20 || 0,
        openingMvr10: data.openingMvr10 || 0,
        openingMvr5: data.openingMvr5 || 0,
        openingMvr2: data.openingMvr2 || 0,
        openingMvr1: data.openingMvr1 || 0,
        openingMvr050: data.openingMvr050 || 0,
        openingTotal,
      }
    } else if (type === "closing") {
      // Calculate closing total from denominations
      const closingTotal =
        (data.closingMvr1000 || 0) * 1000 +
        (data.closingMvr500 || 0) * 500 +
        (data.closingMvr100 || 0) * 100 +
        (data.closingMvr50 || 0) * 50 +
        (data.closingMvr20 || 0) * 20 +
        (data.closingMvr10 || 0) * 10 +
        (data.closingMvr5 || 0) * 5 +
        (data.closingMvr2 || 0) * 2 +
        (data.closingMvr1 || 0) * 1 +
        (data.closingMvr050 || 0) * 0.5

      // Compute expected closing the same way cash reconciliation does
      const categories = existingFloat.dailyEntry?.categories || []
      const cashDrawer = existingFloat.dailyEntry?.cashDrawer
      const entryDate = existingFloat.dailyEntry?.date

      const totalCashSales = categories.reduce(
        (sum, cat) => sum + Number(cat.consumerCash) + Number(cat.corporateCash),
        0
      )

      const [cashSettlements, walletTopupsFromCash] = entryDate
        ? await Promise.all([
            getCashSettlements(entryDate),
            getWalletTopupsFromCash(entryDate),
          ])
        : [0, 0]

      const cashExpected =
        Number(cashDrawer?.opening ?? 0) +
        totalCashSales +
        cashSettlements -
        Number(cashDrawer?.bankDeposits ?? 0) -
        walletTopupsFromCash

      // Variance: actual closing vs expected cash (matches cash reconciliation)
      const variance = closingTotal - cashExpected

      updateData = {
        closingFloatVerified: data.verified || false,
        closingFloatNotes: data.notes,
        closingMvr1000: data.closingMvr1000 || 0,
        closingMvr500: data.closingMvr500 || 0,
        closingMvr100: data.closingMvr100 || 0,
        closingMvr50: data.closingMvr50 || 0,
        closingMvr20: data.closingMvr20 || 0,
        closingMvr10: data.closingMvr10 || 0,
        closingMvr5: data.closingMvr5 || 0,
        closingMvr2: data.closingMvr2 || 0,
        closingMvr1: data.closingMvr1 || 0,
        closingMvr050: data.closingMvr050 || 0,
        closingTotal,
        variance,
      }
    }

    const updatedFloat = await prisma.cashFloatLog.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: convertPrismaDecimals(updatedFloat),
    })
  } catch (error) {
    console.error("Error updating cash float:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update cash float" },
      { status: 500 }
    )
  }
}

// DELETE /api/cash-float - Delete cash float
export async function DELETE(request: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.DAILY_ENTRY_CREATE)
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Cash float ID is required" },
        { status: 400 }
      )
    }

    await prisma.cashFloatLog.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting cash float:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete cash float" },
      { status: 500 }
    )
  }
}
