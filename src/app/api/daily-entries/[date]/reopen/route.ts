import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { canReopenDailyEntry } from '@/lib/permissions'
import { getBusinessRules } from '@/lib/business-rules'
import { successResponse, ApiErrors } from '@/lib/api-response'
import { validateDate } from '@/lib/validations'
import { fullEntryInclude } from '@/lib/calculations/daily-entry'
import { convertPrismaDecimals } from '@/lib/utils/serialize'
import { logError } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ date: string }>
}

// POST /api/daily-entries/[date]/reopen - Reopen a submitted entry as draft
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await getAuthenticatedUser()
  if (auth.error) return auth.error

  const { date } = await params
  const dateValidation = validateDate(date)
  if ("error" in dateValidation) return dateValidation.error
  const entryDate = dateValidation.date

  // Check reopen permission (uses owner-tunable accountant window).
  const rules = await getBusinessRules()
  if (!canReopenDailyEntry(auth.user!.role, entryDate, {
    accountantEditWindowDays: rules.accountantEditWindowDays,
  })) {
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

    // Prevent reopening if screenshot has been verified
    const screenshot = await prisma.telcoScreenshot.findFirst({
      where: { dailyEntryId: entry.id, isVerified: true },
    })
    if (screenshot) {
      return ApiErrors.badRequest('Cannot reopen — screenshot has been verified')
    }

    // B9: Prevent reopening if there's already an open (unresubmitted) amendment
    const openAmendment = await prisma.dailyEntryAmendment.findFirst({
      where: { dailyEntryId: entry.id, resubmittedAt: null },
    })
    if (openAmendment) {
      return ApiErrors.badRequest('Entry already has an open amendment that has not been resubmitted')
    }

    // Capture snapshot before reopening
    const snapshotBefore = convertPrismaDecimals(entry) as Prisma.InputJsonValue

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
          details: { reason, date },
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
    logError('Error reopening daily entry', error)
    return ApiErrors.serverError('Failed to reopen daily entry')
  }
}
