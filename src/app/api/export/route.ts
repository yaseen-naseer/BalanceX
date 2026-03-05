import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"

// GET - Export all data (Owner/Accountant only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role === "SALES") {
      return NextResponse.json(
        { error: "Sales role cannot export data" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get("format") || "json"
    const type = searchParams.get("type") || "all"

    const data: Record<string, unknown> = {}

    if (type === "all" || type === "daily-entries") {
      data.dailyEntries = await prisma.dailyEntry.findMany({
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
    }

    if (type === "all" || type === "credit-customers") {
      data.creditCustomers = await prisma.creditCustomer.findMany({
        orderBy: { name: "asc" },
      })
    }

    if (type === "all" || type === "credit-transactions") {
      data.creditTransactions = await prisma.creditTransaction.findMany({
        include: {
          customer: true,
        },
        orderBy: { date: "desc" },
      })
    }

    if (type === "all" || type === "bank-transactions") {
      data.bankTransactions = await prisma.bankTransaction.findMany({
        orderBy: { date: "desc" },
      })
      data.bankSettings = await prisma.bankSettings.findFirst()
    }

    if (type === "all" || type === "wallet") {
      data.walletTopups = await prisma.walletTopup.findMany({
        orderBy: { date: "desc" },
      })
      data.walletSettings = await prisma.walletSettings.findFirst()
    }

    data.exportedAt = new Date().toISOString()
    data.exportedBy = session.user.name

    if (format === "csv") {
      // For CSV, we'll just return daily entries summary
      const entries = data.dailyEntries as Array<Record<string, unknown>>
      if (!entries || entries.length === 0) {
        return new NextResponse("No data to export", { status: 200 })
      }

      const headers = ["Date", "Status", "Total Cash", "Total Transfer", "Total Credit", "Cash Variance", "Wallet Variance"]
      const rows = entries.map((e: Record<string, unknown>) => {
        const categories = e.categories as Array<Record<string, number>> || []
        let totalCash = 0, totalTransfer = 0, totalCredit = 0
        categories.forEach((c) => {
          totalCash += (c.consumerCash || 0) + (c.corporateCash || 0)
          totalTransfer += (c.consumerTransfer || 0) + (c.corporateTransfer || 0)
          totalCredit += (c.consumerCredit || 0) + (c.corporateCredit || 0)
        })
        const cashDrawer = e.cashDrawer as Record<string, number> | null
        const wallet = e.wallet as Record<string, number> | null
        return [
          new Date(e.date as string).toISOString().split("T")[0],
          e.status,
          totalCash,
          totalTransfer,
          totalCredit,
          cashDrawer?.variance || 0,
          wallet?.variance || 0,
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
    console.error("Error exporting data:", error)
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    )
  }
}
