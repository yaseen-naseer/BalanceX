import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { getAuthenticatedUser } from "@/lib/api-auth"
import { successResponse, ApiErrors } from "@/lib/api-response"

interface RouteParams {
  params: Promise<{ date: string }>
}

// GET /api/daily-entries/[date]/poll - Lightweight check for changes
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await getAuthenticatedUser()
  if (auth.error) return auth.error

  const { date } = await params
  const entryDate = new Date(date)
  entryDate.setUTCHours(0, 0, 0, 0)

  try {
    const entry = await prisma.dailyEntry.findUnique({
      where: { date: entryDate },
      select: {
        id: true,
        updatedAt: true,
        status: true,
      },
    })

    if (!entry) {
      return ApiErrors.notFound("Entry")
    }

    // Get the latest line item timestamp for this entry
    const lastLineItem = await prisma.saleLineItem.findFirst({
      where: { dailyEntryId: entry.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    })

    // Get the latest credit sale timestamp
    const lastCreditSale = await prisma.creditSale.findFirst({
      where: { dailyEntryId: entry.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    })

    return successResponse({
      updatedAt: entry.updatedAt.toISOString(),
      status: entry.status,
      lastLineItemAt: lastLineItem?.createdAt?.toISOString() ?? null,
      lastCreditSaleAt: lastCreditSale?.createdAt?.toISOString() ?? null,
    })
  } catch (error) {
    console.error("Error polling daily entry:", error)
    return ApiErrors.serverError("Failed to poll daily entry")
  }
}
