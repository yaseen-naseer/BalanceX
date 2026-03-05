import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { canReopenDailyEntry } from '@/lib/permissions'
import { successResponse, ApiErrors } from '@/lib/api-response'
import { fullEntryInclude } from '@/lib/calculations/daily-entry'
import { convertPrismaDecimals } from '@/lib/utils/serialize'

interface RouteParams {
  params: Promise<{ date: string }>
}

// POST /api/daily-entries/[date]/reopen - Reopen a submitted entry as draft
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await getAuthenticatedUser()
  if (auth.error) return auth.error

  const { date } = await params
  const entryDate = new Date(date)
  entryDate.setUTCHours(0, 0, 0, 0)

  // Check reopen permission
  if (!canReopenDailyEntry(auth.user!.role, entryDate)) {
    return ApiErrors.forbidden('You do not have permission to reopen this entry')
  }

  try {
    const body = await request.json()
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''

    if (reason.length < 3) {
      return ApiErrors.badRequest('Reason must be at least 3 characters')
    }

    // Fetch the entry
    const entry = await prisma.dailyEntry.findUnique({
      where: { date: entryDate },
      include: fullEntryInclude,
    })

    if (!entry) {
      return ApiErrors.notFound('Entry')
    }

    if (entry.status !== 'SUBMITTED') {
      return ApiErrors.badRequest('Entry is not submitted')
    }

    // Capture snapshot before reopening
    const snapshotBefore = JSON.stringify(convertPrismaDecimals(entry))

    // Create amendment record and update entry in a transaction
    await prisma.$transaction([
      prisma.dailyEntryAmendment.create({
        data: {
          dailyEntryId: entry.id,
          reason,
          reopenedBy: auth.user!.id,
          snapshotBefore,
        },
      }),
      prisma.dailyEntry.update({
        where: { id: entry.id },
        data: {
          status: 'DRAFT',
          submittedAt: null,
          updatedAt: new Date(),
        },
      }),
      prisma.auditLog.create({
        data: {
          action: 'DAILY_ENTRY_REOPENED',
          userId: auth.user!.id,
          targetId: entry.id,
          details: JSON.stringify({ reason, date }),
        },
      }),
    ])

    // Return updated entry
    const updatedEntry = await prisma.dailyEntry.findUnique({
      where: { id: entry.id },
      include: fullEntryInclude,
    })

    return successResponse(convertPrismaDecimals(updatedEntry))
  } catch (error) {
    console.error('Error reopening daily entry:', error)
    return ApiErrors.serverError('Failed to reopen daily entry')
  }
}
