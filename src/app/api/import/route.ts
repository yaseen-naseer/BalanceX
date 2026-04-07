import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/api-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { CategoryType } from "@prisma/client"
import { logError } from "@/lib/logger"

interface ImportedRow {
  siteName: string
  paymentMethod: string
  customerType: string
  paymentType: string
  amount: number
}

interface ImportRequest {
  date: string
  rows: ImportedRow[]
  totals: {
    cash: number
    transfer: number
    total: number
  }
}

// Map payment types to categories
function mapPaymentTypeToCategory(paymentType: string): CategoryType {
  const type = paymentType.toLowerCase()

  if (type.includes("bill") || type.includes("postpaid")) {
    return "DHIRAAGU_BILLS"
  }
  if (type.includes("reload") || type.includes("prepaid") || type.includes("recharge")) {
    return "RETAIL_RELOAD"
  }
  if (type.includes("sim") && !type.includes("usim")) {
    return "SIM"
  }
  if (type.includes("usim") || type.includes("4g") || type.includes("5g")) {
    return "USIM"
  }

  // Default to DHIRAAGU_BILLS for unmatched types
  return "DHIRAAGU_BILLS"
}

// POST /api/import - Import telco report data to daily entry
export async function POST(request: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.IMPORT_DATA) // Only Owner/Accountant
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

  try {
    const body: ImportRequest = await request.json()
    const { date, rows, totals } = body

    if (!date || !rows || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Date and rows are required" },
        { status: 400 }
      )
    }

    const entryDate = new Date(date)
    entryDate.setUTCHours(0, 0, 0, 0)

    // Aggregate data by category, customer type, and payment method
    const aggregated: Record<
      CategoryType,
      {
        consumerCash: number
        consumerTransfer: number
        corporateCash: number
        corporateTransfer: number
        quantity: number
      }
    > = {
      DHIRAAGU_BILLS: { consumerCash: 0, consumerTransfer: 0, corporateCash: 0, corporateTransfer: 0, quantity: 0 },
      RETAIL_RELOAD: { consumerCash: 0, consumerTransfer: 0, corporateCash: 0, corporateTransfer: 0, quantity: 0 },
      WHOLESALE_RELOAD: { consumerCash: 0, consumerTransfer: 0, corporateCash: 0, corporateTransfer: 0, quantity: 0 },
      SIM: { consumerCash: 0, consumerTransfer: 0, corporateCash: 0, corporateTransfer: 0, quantity: 0 },
      USIM: { consumerCash: 0, consumerTransfer: 0, corporateCash: 0, corporateTransfer: 0, quantity: 0 },
    }

    // Process each row
    for (const row of rows) {
      const category = mapPaymentTypeToCategory(row.paymentType)
      const isCash = row.paymentMethod.toLowerCase().includes("cash")
      const isCorporate = row.customerType.toLowerCase().includes("corporate") ||
                          row.customerType.toLowerCase().includes("business")

      if (isCorporate) {
        if (isCash) {
          aggregated[category].corporateCash += row.amount
        } else {
          aggregated[category].corporateTransfer += row.amount
        }
      } else {
        if (isCash) {
          aggregated[category].consumerCash += row.amount
        } else {
          aggregated[category].consumerTransfer += row.amount
        }
      }

      // Count SIM/USIM quantities
      if (category === "SIM" || category === "USIM") {
        aggregated[category].quantity += 1
      }
    }

    // Check if entry already exists
    const existingEntry = await prisma.dailyEntry.findUnique({
      where: { date: entryDate },
      include: { categories: true },
    })

    if (existingEntry) {
      // Update existing entry categories
      for (const [cat, values] of Object.entries(aggregated)) {
        const category = cat as CategoryType
        const existingCat = existingEntry.categories.find((c) => c.category === category)

        if (existingCat) {
          // Update existing category
          await prisma.dailyEntryCategory.update({
            where: { id: existingCat.id },
            data: {
              consumerCash: values.consumerCash,
              consumerTransfer: values.consumerTransfer,
              corporateCash: values.corporateCash,
              corporateTransfer: values.corporateTransfer,
              quantity: values.quantity > 0 ? values.quantity : existingCat.quantity,
            },
          })
        } else if (
          values.consumerCash > 0 ||
          values.consumerTransfer > 0 ||
          values.corporateCash > 0 ||
          values.corporateTransfer > 0
        ) {
          // Create new category
          await prisma.dailyEntryCategory.create({
            data: {
              dailyEntryId: existingEntry.id,
              category,
              consumerCash: values.consumerCash,
              consumerTransfer: values.consumerTransfer,
              consumerCredit: 0,
              corporateCash: values.corporateCash,
              corporateTransfer: values.corporateTransfer,
              corporateCredit: 0,
              quantity: values.quantity,
            },
          })
        }
      }

      // Update the entry timestamp
      await prisma.dailyEntry.update({
        where: { id: existingEntry.id },
        data: { updatedAt: new Date() },
      })

      return NextResponse.json({
        success: true,
        data: {
          entryId: existingEntry.id,
          action: "updated",
          totals,
          categoriesUpdated: Object.keys(aggregated).filter(
            (cat) =>
              aggregated[cat as CategoryType].consumerCash > 0 ||
              aggregated[cat as CategoryType].consumerTransfer > 0 ||
              aggregated[cat as CategoryType].corporateCash > 0 ||
              aggregated[cat as CategoryType].corporateTransfer > 0
          ),
        },
        message: "Daily entry updated with imported data",
      })
    } else {
      // Create new entry with imported data
      const newEntry = await prisma.dailyEntry.create({
        data: {
          date: entryDate,
          createdBy: auth.user!.id,
          status: "DRAFT",
          categories: {
            create: Object.entries(aggregated)
              .filter(
                ([, values]) =>
                  values.consumerCash > 0 ||
                  values.consumerTransfer > 0 ||
                  values.corporateCash > 0 ||
                  values.corporateTransfer > 0 ||
                  values.quantity > 0
              )
              .map(([cat, values]) => ({
                category: cat as CategoryType,
                consumerCash: values.consumerCash,
                consumerTransfer: values.consumerTransfer,
                consumerCredit: 0,
                corporateCash: values.corporateCash,
                corporateTransfer: values.corporateTransfer,
                corporateCredit: 0,
                quantity: values.quantity,
              })),
          },
          cashDrawer: {
            create: {
              opening: 0,
              bankDeposits: 0,
              closingActual: 0,
              closingExpected: totals.cash,
              variance: 0,
            },
          },
          wallet: {
            create: {
              opening: 0,
              openingSource: "PREVIOUS_DAY",
              closingActual: 0,
              closingExpected: 0,
              variance: 0,
            },
          },
        },
      })

      return NextResponse.json(
        {
          success: true,
          data: {
            entryId: newEntry.id,
            action: "created",
            totals,
            categoriesCreated: Object.keys(aggregated).filter(
              (cat) =>
                aggregated[cat as CategoryType].consumerCash > 0 ||
                aggregated[cat as CategoryType].consumerTransfer > 0 ||
                aggregated[cat as CategoryType].corporateCash > 0 ||
                aggregated[cat as CategoryType].corporateTransfer > 0
            ),
          },
          message: "New daily entry created with imported data",
        },
        { status: 201 }
      )
    }
  } catch (error) {
    logError("Error importing telco data", error)
    return NextResponse.json(
      { success: false, error: "Failed to import data" },
      { status: 500 }
    )
  }
}
