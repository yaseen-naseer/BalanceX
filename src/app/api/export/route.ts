import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/api-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { logError } from "@/lib/logger"
import prisma from "@/lib/db"
import type {
  DailyEntry,
  DailyEntryCashDrawer,
  DailyEntryWallet,
  DailyEntryCategory,
  DailyEntryNotes,
  CreditSale,
  CreditCustomer,
  CreditTransaction,
  BankTransaction,
  BankSettings,
  WalletTopup,
  WalletSettings,
} from "@prisma/client"

interface ExportDailyEntry extends DailyEntry {
  cashDrawer: DailyEntryCashDrawer | null
  wallet: DailyEntryWallet | null
  categories: DailyEntryCategory[]
  notes: DailyEntryNotes | null
  creditSales: (CreditSale & { customer: CreditCustomer })[]
}

interface ExportData {
  dailyEntries?: ExportDailyEntry[]
  creditCustomers?: CreditCustomer[]
  creditTransactions?: (CreditTransaction & { customer: CreditCustomer })[]
  bankTransactions?: BankTransaction[]
  bankSettings?: BankSettings | null
  walletTopups?: WalletTopup[]
  walletSettings?: WalletSettings | null
  warning?: string
  exportedAt?: string
  exportedBy?: string
}

// GET - Export all data (Owner/Accountant only)
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(PERMISSIONS.REPORTS_EXPORT)
    if (auth.error) return auth.error

    const { searchParams } = new URL(request.url)
    const format = searchParams.get("format") || "json"
    const type = searchParams.get("type") || "all"

    // D7: Parse optional date range filters and enforce row limits
    const EXPORT_LIMIT = 50000
    const fromDate = searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined
    const toDate = searchParams.get("to") ? new Date(searchParams.get("to")!) : undefined
    const dateFilter = {
      ...(fromDate && { gte: fromDate }),
      ...(toDate && { lte: toDate }),
    }
    const hasDateFilter = fromDate || toDate

    const data: ExportData = {}
    let limitHit = false
    const isOwner = auth.user!.role === "OWNER"

    if (type === "all" || type === "daily-entries") {
      const entries = await prisma.dailyEntry.findMany({
        take: EXPORT_LIMIT,
        ...(hasDateFilter && { where: { date: dateFilter } }),
        include: {
          cashDrawer: true,
          wallet: true,
          categories: true,
          notes: true,
          creditSales: {
            include: {
              customer: true,
            },
          },
        },
        orderBy: { date: "desc" },
      })
      data.dailyEntries = entries
      if (entries.length >= EXPORT_LIMIT) limitHit = true
    }

    if (type === "all" || type === "credit-customers") {
      const customers = await prisma.creditCustomer.findMany({
        take: EXPORT_LIMIT,
        orderBy: { name: "asc" },
      })
      data.creditCustomers = customers
      if (customers.length >= EXPORT_LIMIT) limitHit = true
    }

    if (type === "all" || type === "credit-transactions") {
      const transactions = await prisma.creditTransaction.findMany({
        take: EXPORT_LIMIT,
        ...(hasDateFilter && { where: { date: dateFilter } }),
        include: {
          customer: true,
        },
        orderBy: { date: "desc" },
      })
      data.creditTransactions = transactions
      if (transactions.length >= EXPORT_LIMIT) limitHit = true
    }

    // S9: Bank and wallet data restricted to OWNER
    if ((type === "all" || type === "bank-transactions") && isOwner) {
      const bankTx = await prisma.bankTransaction.findMany({
        take: EXPORT_LIMIT,
        ...(hasDateFilter && { where: { date: dateFilter } }),
        orderBy: { date: "desc" },
      })
      data.bankTransactions = bankTx
      data.bankSettings = await prisma.bankSettings.findFirst()
      if (bankTx.length >= EXPORT_LIMIT) limitHit = true
    }

    if ((type === "all" || type === "wallet") && isOwner) {
      const topups = await prisma.walletTopup.findMany({
        take: EXPORT_LIMIT,
        ...(hasDateFilter && { where: { date: dateFilter } }),
        orderBy: { date: "desc" },
      })
      data.walletTopups = topups
      data.walletSettings = await prisma.walletSettings.findFirst()
      if (topups.length >= EXPORT_LIMIT) limitHit = true
    }

    if (limitHit) {
      data.warning = `Export limited to ${EXPORT_LIMIT.toLocaleString()} records per type. Use date filters (?from=YYYY-MM-DD&to=YYYY-MM-DD) for complete data.`
    }

    data.exportedAt = new Date().toISOString()
    data.exportedBy = auth.user!.name

    if (format === "csv") {
      // For CSV, we'll just return daily entries summary
      const entries = data.dailyEntries
      if (!entries || entries.length === 0) {
        return new NextResponse("No data to export", { status: 200 })
      }

      const headers = ["Date", "Status", "Total Cash", "Total Transfer", "Total Credit", "Cash Variance", "Wallet Variance"]
      const rows = entries.map((e) => {
        let totalCash = 0, totalTransfer = 0, totalCredit = 0
        e.categories.forEach((c) => {
          totalCash += Number(c.consumerCash) + Number(c.corporateCash)
          totalTransfer += Number(c.consumerTransfer) + Number(c.corporateTransfer)
          totalCredit += Number(c.consumerCredit) + Number(c.corporateCredit)
        })
        return [
          e.date.toISOString().split("T")[0],
          e.status,
          totalCash,
          totalTransfer,
          totalCredit,
          e.cashDrawer ? Number(e.cashDrawer.variance) : 0,
          e.wallet ? Number(e.wallet.variance) : 0,
        ].join(",")
      })

      const csv = [headers.join(","), ...rows].join("\n")

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename=balancex-export-${new Date().toISOString().split("T")[0]}.csv`,
        },
      })
    }

    // Return JSON
    return NextResponse.json(data)
  } catch (error) {
    logError("Error exporting data", error)
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    )
  }
}
