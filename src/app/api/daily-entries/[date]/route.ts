import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { canEditDailyEntry } from '@/lib/permissions'
import { DailyEntryStatus } from '@prisma/client'
import { validateBeforeSubmit } from '@/lib/validations/daily-entry'
import { updateDailyEntrySchema, validateRequestBody } from '@/lib/validations'
import { successResponse, ApiErrors } from '@/lib/api-response'
import {
  getCashSettlements,
  getWalletTopupsFromCash,
  recalculateEntryValues,
  upsertCashDrawer,
  upsertWallet,
  upsertCategory,
  upsertNotes,
  fullEntryInclude,
} from '@/lib/calculations/daily-entry'
import { convertPrismaDecimals } from '@/lib/utils/serialize'
import { syncDailyEntryBankDeposit } from '@/lib/bank-utils'
import type { UpdateDailyEntryDto } from '@/types'

interface RouteParams {
  params: Promise<{ date: string }>
}

// GET /api/daily-entries/[date] - Get daily entry by date
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await getAuthenticatedUser()
  if (auth.error) return auth.error

  const { date } = await params
  const entryDate = new Date(date)
  entryDate.setUTCHours(0, 0, 0, 0)

  try {
    const entry = await prisma.dailyEntry.findUnique({
      where: { date: entryDate },
      include: fullEntryInclude,
    })

    if (!entry) {
      return ApiErrors.notFound('Entry')
    }

    // Get calculation data in parallel
    const [cashSettlements, walletTopupsFromCash] = await Promise.all([
      getCashSettlements(entryDate),
      getWalletTopupsFromCash(entryDate),
    ])

    // Serialize Decimal values to numbers before sending response
    const serializedEntry = convertPrismaDecimals(entry)

    return successResponse({
      ...serializedEntry,
      calculationData: { cashSettlements, walletTopupsFromCash },
    })
  } catch (error) {
    console.error('Error fetching daily entry:', error)
    return ApiErrors.serverError('Failed to fetch daily entry')
  }
}

// PUT /api/daily-entries/[date] - Update daily entry
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await getAuthenticatedUser()
  if (auth.error) return auth.error

  const { date } = await params
  const entryDate = new Date(date)
  entryDate.setUTCHours(0, 0, 0, 0)

  try {
    const existingEntry = await prisma.dailyEntry.findUnique({
      where: { date: entryDate },
      include: { categories: true, cashDrawer: true, wallet: true, notes: true },
    })

    if (!existingEntry) {
      return ApiErrors.notFound('Entry')
    }

    // Check edit permissions
    const isOwnEntry = existingEntry.createdBy === auth.user!.id
    const editCheck = canEditDailyEntry(auth.user!.role, entryDate, isOwnEntry)

    if (!editCheck.canEdit) {
      return ApiErrors.forbidden(editCheck.reason || 'Cannot edit this entry')
    }

    if (existingEntry.status === 'SUBMITTED' && auth.user!.role !== 'OWNER') {
      return ApiErrors.forbidden('Cannot edit submitted entry')
    }

    // Validate request body
    const validation = await validateRequestBody(request, updateDailyEntrySchema)
    if ("error" in validation) return validation.error
    const body = validation.data as UpdateDailyEntryDto

    // Handle submission with validation
    if (body.status === 'SUBMITTED') {
      // Apply pending changes before validation
      await applyPendingChanges(existingEntry, body)
      await recalculateEntryValues(existingEntry.id)

      const { validation } = await validateBeforeSubmit(existingEntry.id)

      if (validation.hasBlocks) {
        return NextResponse.json({
          success: false,
          error: 'Cannot submit: Validation failed',
          validation: {
            canSubmit: false,
            hasBlocks: true,
            hasWarnings: validation.hasWarnings,
            messages: validation.messages,
          },
        }, { status: 400 })
      }

      const acknowledgeWarnings = (body as UpdateDailyEntryDto & { acknowledgeWarnings?: boolean }).acknowledgeWarnings
      if (validation.hasWarnings && !acknowledgeWarnings) {
        return NextResponse.json({
          success: false,
          error: 'Warnings detected - confirmation required',
          requiresConfirmation: true,
          validation: {
            canSubmit: validation.canSubmit,
            hasBlocks: validation.hasBlocks,
            hasWarnings: validation.hasWarnings,
            creditBalanced: validation.creditBalanced,
            cashVariance: validation.cashVariance,
            walletVariance: validation.walletVariance,
            messages: validation.messages,
          },
        }, { status: 400 })
      }
    }

    // Apply all changes
    await applyPendingChanges(existingEntry, body)

    // Update main entry
    const updateData: Parameters<typeof prisma.dailyEntry.update>[0]['data'] = {
      updatedAt: new Date(),
    }

    if (body.status) {
      updateData.status = body.status as DailyEntryStatus
      if (body.status === 'SUBMITTED') {
        updateData.submittedAt = new Date()
      }
    }

    await prisma.dailyEntry.update({
      where: { id: existingEntry.id },
      data: updateData,
    })

    // Recalculate and fetch final entry
    await recalculateEntryValues(existingEntry.id)

    const finalEntry = await prisma.dailyEntry.findUnique({
      where: { id: existingEntry.id },
      include: fullEntryInclude,
    })

    // Handle audit logging and amendment closure on submission
    if (body.status === 'SUBMITTED') {
      const serializedFinal = convertPrismaDecimals(finalEntry)
      const snapshotAfter = JSON.stringify(serializedFinal)

      // Find open amendment (no resubmittedAt) for this entry
      const openAmendment = await prisma.dailyEntryAmendment.findFirst({
        where: { dailyEntryId: existingEntry.id, resubmittedAt: null },
        orderBy: { reopenedAt: 'desc' },
      })

      if (openAmendment) {
        // Close the amendment with re-submission snapshot + log DAILY_ENTRY_AMENDED
        await prisma.$transaction([
          prisma.dailyEntryAmendment.update({
            where: { id: openAmendment.id },
            data: {
              resubmittedBy: auth.user!.id,
              resubmittedAt: new Date(),
              snapshotAfter,
            },
          }),
          prisma.auditLog.create({
            data: {
              action: 'DAILY_ENTRY_AMENDED',
              userId: auth.user!.id,
              targetId: existingEntry.id,
              details: JSON.stringify({ date }),
            },
          }),
        ])
      } else {
        // First-time submission
        await prisma.auditLog.create({
          data: {
            action: 'DAILY_ENTRY_SUBMITTED',
            userId: auth.user!.id,
            targetId: existingEntry.id,
            details: JSON.stringify({ date }),
          },
        })
      }
    }

    // Sync bank deposit to bank ledger on submission (non-fatal — entry is already committed)
    if (body.status === 'SUBMITTED') {
      try {
        const depositAmount = Number(finalEntry?.cashDrawer?.bankDeposits ?? 0)
        await syncDailyEntryBankDeposit(entryDate, depositAmount, auth.user!.id)
      } catch (bankSyncError) {
        console.error('Bank sync error (non-fatal, entry remains submitted):', bankSyncError)
      }
    }

    // Refresh final entry to include updated amendments
    const refreshedEntry = await prisma.dailyEntry.findUnique({
      where: { id: existingEntry.id },
      include: fullEntryInclude,
    })

    // Serialize Decimal values to numbers before sending response
    const serializedFinalEntry = convertPrismaDecimals(refreshedEntry)

    return successResponse(serializedFinalEntry)
  } catch (error) {
    console.error('Error updating daily entry:', error)
    return ApiErrors.serverError('Failed to update daily entry')
  }
}

// Helper to apply pending changes
async function applyPendingChanges(
  existingEntry: {
    id: string
    categories: Array<{ id: string; category: string }>
    cashDrawer: { opening: unknown; bankDeposits: unknown; closingActual: unknown } | null
    wallet: { opening: unknown; openingSource: string; closingActual: unknown } | null
    notes: { content: string | null } | null
  },
  body: UpdateDailyEntryDto
): Promise<void> {
  // Update cash drawer
  if (body.cashDrawer) {
    await upsertCashDrawer(existingEntry.id, existingEntry.cashDrawer, body.cashDrawer)
  }

  // Update wallet
  if (body.wallet) {
    await upsertWallet(existingEntry.id, existingEntry.wallet, body.wallet)
  }

  // Update categories
  if (body.categories) {
    for (const cat of body.categories) {
      await upsertCategory(existingEntry.id, existingEntry.categories, cat)
    }
  }

  // Update notes
  await upsertNotes(existingEntry.id, existingEntry.notes, body.notes)
}
