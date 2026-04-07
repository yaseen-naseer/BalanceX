import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { getAuthenticatedUser } from "@/lib/api-auth"
import { successResponse, ApiErrors } from "@/lib/api-response"
import { logError } from "@/lib/logger"

interface RouteParams {
  params: Promise<{ date: string }>
}

const PRESENCE_TTL_MS = 30_000 // 30 seconds — 3 missed polls = gone

// GET /api/daily-entries/[date]/poll - Lightweight check for changes + presence heartbeat
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

    // Heartbeat — upsert current user's presence
    await prisma.dailyEntryPresence.upsert({
      where: {
        dailyEntryId_userId: { dailyEntryId: entry.id, userId: auth.user!.id },
      },
      update: { lastSeenAt: new Date(), userName: auth.user!.name },
      create: {
        dailyEntryId: entry.id,
        userId: auth.user!.id,
        userName: auth.user!.name,
      },
    })

    // Clean up stale presences
    const cutoff = new Date(Date.now() - PRESENCE_TTL_MS)
    await prisma.dailyEntryPresence.deleteMany({
      where: { dailyEntryId: entry.id, lastSeenAt: { lt: cutoff } },
    })

    // Get other active editors
    const activeEditors = await prisma.dailyEntryPresence.findMany({
      where: {
        dailyEntryId: entry.id,
        userId: { not: auth.user!.id },
        lastSeenAt: { gte: cutoff },
      },
      select: { userId: true, userName: true },
    })

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
      activeEditors,
    })
  } catch (error) {
    logError("Error polling daily entry", error)
    return ApiErrors.serverError("Failed to poll daily entry")
  }
}

// DELETE /api/daily-entries/[date]/poll - Remove presence on page unload
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await getAuthenticatedUser()
  if (auth.error) return auth.error

  const { date } = await params
  const entryDate = new Date(date)
  entryDate.setUTCHours(0, 0, 0, 0)

  try {
    const entry = await prisma.dailyEntry.findUnique({
      where: { date: entryDate },
      select: { id: true },
    })

    if (entry) {
      await prisma.dailyEntryPresence.deleteMany({
        where: { dailyEntryId: entry.id, userId: auth.user!.id },
      })
    }

    return successResponse({ removed: true })
  } catch (error) {
    logError("Error removing presence", error)
    return successResponse({ removed: false })
  }
}
