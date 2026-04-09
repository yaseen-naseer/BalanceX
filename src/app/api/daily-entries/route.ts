import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getAuthenticatedUser, requirePermission } from "@/lib/api-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { CategoryType } from "@prisma/client"
import { convertPrismaDecimals } from "@/lib/utils/serialize"
import { createDailyEntrySchema, validateRequestBody, validateDate } from "@/lib/validations"
import { createAuditLog } from "@/lib/audit"
import { logError } from "@/lib/logger"

// GET /api/daily-entries - List daily entries
export async function GET(request: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.DAILY_ENTRY_VIEW)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const date = searchParams.get("date")
  const month = searchParams.get("month") // Format: YYYY-MM
  const limitParam = searchParams.get("limit")
  const offsetParam = searchParams.get("offset")

  // Validate pagination params
  const limit = Math.min(Math.max(parseInt(limitParam || "30"), 1), 100)
  const offset = Math.max(parseInt(offsetParam || "0"), 0)

  try {
    const where: { date?: { gte?: Date; lte?: Date; equals?: Date } } = {}

    if (date) {
      // Validate date format
      const parsedDate = new Date(date)
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json(
          { success: false, error: "Invalid date format" },
          { status: 400 }
        )
      }
      where.date = { equals: parsedDate }
    } else if (month) {
      // Validate month format (YYYY-MM)
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return NextResponse.json(
          { success: false, error: "Invalid month format. Expected YYYY-MM" },
          { status: 400 }
        )
      }
      const [year, monthNum] = month.split("-").map(Number)
      if (monthNum < 1 || monthNum > 12) {
        return NextResponse.json(
          { success: false, error: "Invalid month value" },
          { status: 400 }
        )
      }
      const startDate = new Date(year, monthNum - 1, 1)
      const endDate = new Date(year, monthNum, 0)
      where.date = { gte: startDate, lte: endDate }
    }

    const entries = await prisma.dailyEntry.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, username: true } },
        cashDrawer: true,
        wallet: true,
        categories: true,
        notes: true,
        creditSales: {
          include: {
            customer: { select: { id: true, name: true, type: true } },
          },
        },
        screenshot: true,
      },
      orderBy: { date: "desc" },
      take: limit,
      skip: offset,
    })

    const total = await prisma.dailyEntry.count({ where })

    // Serialize Decimal values to numbers before sending response
    const serializedEntries = entries.map(entry => convertPrismaDecimals(entry))

    return NextResponse.json({
      success: true,
      data: serializedEntries,
      pagination: { total, limit, offset },
    })
  } catch (error) {
    logError("Error fetching daily entries", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch daily entries" },
      { status: 500 }
    )
  }
}

// POST /api/daily-entries - Create or update daily entry
export async function POST(request: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.DAILY_ENTRY_CREATE)
  if (auth.error) return auth.error

  try {
    // Validate request body
    const validation = await validateRequestBody(request, createDailyEntrySchema)
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

    const entryDate = new Date(body.date)
    entryDate.setUTCHours(0, 0, 0, 0)

    // Reject future dates
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    if (entryDate > today) {
      return NextResponse.json(
        { success: false, error: "Cannot create a daily entry for a future date" },
        { status: 400 }
      )
    }

    // Check if entry already exists
    const existingEntry = await prisma.dailyEntry.findUnique({
      where: { date: entryDate },
    })

    if (existingEntry) {
      return NextResponse.json(
        { success: false, error: "Entry for this date already exists" },
        { status: 409 }
      )
    }

    // Create the entry with related data
    const entry = await prisma.dailyEntry.create({
      data: {
        date: entryDate,
        createdBy: auth.user!.id,
        cashDrawer: body.cashDrawer
          ? {
              create: {
                opening: body.cashDrawer.opening || 0,
                bankDeposits: body.cashDrawer.bankDeposits || 0,
                closingActual: body.cashDrawer.closingActual || 0,
                closingExpected: 0,
                variance: 0,
              },
            }
          : undefined,
        wallet: body.wallet
          ? {
              create: {
                opening: body.wallet.opening || 0,
                openingSource: body.wallet.openingSource || "PREVIOUS_DAY",
                closingActual: body.wallet.closingActual || 0,
                closingExpected: 0,
                variance: 0,
              },
            }
          : undefined,
        categories: body.categories
          ? {
              create: body.categories.map((cat) => ({
                category: cat.category as CategoryType,
                consumerCash: cat.consumerCash || 0,
                consumerTransfer: cat.consumerTransfer || 0,
                consumerCredit: cat.consumerCredit || 0,
                corporateCash: cat.corporateCash || 0,
                corporateTransfer: cat.corporateTransfer || 0,
                corporateCredit: cat.corporateCredit || 0,
                quantity: cat.quantity || 0,
              })),
            }
          : undefined,
        notes: body.notes
          ? {
              create: { content: body.notes },
            }
          : undefined,
      },
      include: {
        user: { select: { id: true, name: true, username: true } },
        cashDrawer: true,
        wallet: true,
        categories: true,
        notes: true,
      },
    })

    // Serialize Decimal values to numbers before sending response
    const serializedEntry = convertPrismaDecimals(entry)

    await createAuditLog({
      action: "DAILY_ENTRY_CREATED",
      userId: auth.user!.id,
      targetId: entry.id,
      details: { date: body.date },
    })

    return NextResponse.json({ success: true, data: serializedEntry }, { status: 201 })
  } catch (error) {
    logError("Error creating daily entry", error)
    return NextResponse.json(
      { success: false, error: "Failed to create daily entry" },
      { status: 500 }
    )
  }
}
