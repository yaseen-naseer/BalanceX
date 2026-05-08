"use client"

import { useState, useCallback } from "react"
import type { DailyEntryWithRelations, CreateDailyEntryDto, UpdateDailyEntryDto } from "@/types"
import type { LocalEntryData } from "@/components/daily-entry/types"
import { CATEGORIES } from "@/components/daily-entry/types"
import type { ValidationMessage, ValidationResult } from "./use-daily-entry-validation"

interface UseDailyEntrySubmissionOptions {
  date: string
  entry: DailyEntryWithRelations | null
  localData: LocalEntryData
  walletOpeningSource: string
  createEntry: (data: CreateDailyEntryDto) => Promise<DailyEntryWithRelations | null>
  updateEntry: (date: string, data: UpdateDailyEntryDto) => Promise<DailyEntryWithRelations | null>
  submitEntryApi: (date: string, acknowledgeWarnings?: boolean) => Promise<{
    success: boolean
    error?: string
    requiresConfirmation?: boolean
    validation?: ValidationResult
  }>
  reopenEntryApi: (date: string, reason: string) => Promise<boolean>
  fetchEntry: (date: string, options?: { silent?: boolean }) => Promise<void>
  refreshLineItems: () => Promise<void>
}

export function useDailyEntrySubmission({
  date,
  entry,
  localData,
  walletOpeningSource,
  createEntry,
  updateEntry,
  submitEntryApi,
  reopenEntryApi,
  fetchEntry,
  refreshLineItems,
}: UseDailyEntrySubmissionOptions) {
  const [isSaving, setIsSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Build entry DTO
  const buildEntryData = useCallback((): CreateDailyEntryDto => {
    return {
      date,
      // Dollar amounts (cash/transfer/credit) are server-managed:
      //   - Cash & transfer: synced from SaleLineItem rows by `syncCellTotal`
      //     on every line-item add/edit/delete.
      //   - Credit: derived from the linked CreditSale rows (each sale's
      //     amount is reflected in DailyEntryCategory.consumer/corporateCredit
      //     via the credit-sale create flow).
      // Cells are read-only in the UI (the line-items refactor removed direct
      // value editing), so `localData.categories[X].<dollarField>` is always
      // stale relative to the synced DB values. Sending those back here would
      // overwrite the server-managed totals with zeros — that was the
      // "day-detail shows zeros after submit" bug. Only `quantity` is
      // user-editable in the categories grid; everything else is omitted so
      // Prisma `update()` leaves the existing values untouched.
      categories: CATEGORIES.map((cat) => ({
        category: cat.key,
        quantity: localData.categories[cat.key].quantity,
      })),
      cashDrawer: {
        opening: localData.cashDrawer.opening,
        bankDeposits: localData.cashDrawer.bankDeposits,
        closingActual: localData.cashDrawer.closingActual,
      },
      wallet: {
        opening: localData.wallet.opening,
        openingSource: walletOpeningSource as "PREVIOUS_DAY" | "INITIAL_SETUP" | "MANUAL",
        closingActual: localData.wallet.closingActual,
      },
      notes: localData.notes || undefined,
    }
  }, [date, localData, walletOpeningSource])

  // Save draft
  const saveDraft = useCallback(async (
    setHasUserChanges: (v: boolean) => void
  ): Promise<string | false> => {
    setIsSaving(true)
    try {
      const data = buildEntryData()
      if (entry) {
        await updateEntry(date, data as UpdateDailyEntryDto)
        setHasUserChanges(false)
        return entry.id
      } else {
        const created = await createEntry(data)
        setHasUserChanges(false)
        return created?.id ?? false
      }
    } catch {
      return false
    } finally {
      setIsSaving(false)
    }
  }, [buildEntryData, entry, date, updateEntry, createEntry])

  // Submit entry
  const submitEntry = useCallback(
    async (acknowledgeWarnings: boolean = false): Promise<{
      success: boolean
      requiresConfirmation?: boolean
      messages?: ValidationMessage[]
    }> => {
      setIsSubmitting(true)
      try {
        const data = buildEntryData()
        if (!entry) {
          await createEntry(data)
        } else {
          await updateEntry(date, data as UpdateDailyEntryDto)
        }

        const result = await submitEntryApi(date, acknowledgeWarnings)

        if (result.success) {
          await fetchEntry(date)
          return { success: true }
        } else if (result.requiresConfirmation && result.validation) {
          const messages = result.validation.messages.filter((m) => m.type === "warning")
          return { success: false, requiresConfirmation: true, messages }
        } else if (result.validation?.hasBlocks) {
          const messages = result.validation.messages.filter((m) => m.type === "block")
          return { success: false, messages }
        } else {
          await fetchEntry(date)
          return { success: false, messages: [{ type: "block", message: result.error || "Failed to submit" }] }
        }
      } catch {
        await fetchEntry(date)
        return { success: false, messages: [{ type: "block", message: "Failed to submit entry" }] }
      } finally {
        setIsSubmitting(false)
      }
    },
    [buildEntryData, entry, date, createEntry, updateEntry, submitEntryApi, fetchEntry]
  )

  // Refresh functions
  const refreshEntry = useCallback(async () => {
    await fetchEntry(date)
    await refreshLineItems()
  }, [fetchEntry, date, refreshLineItems])

  // Reopen entry
  const reopenEntry = useCallback(async (reason: string): Promise<boolean> => {
    const success = await reopenEntryApi(date, reason)
    if (success) {
      await fetchEntry(date)
    }
    return success
  }, [reopenEntryApi, date, fetchEntry])

  return {
    isSaving,
    isSubmitting,
    saveDraft,
    submitEntry,
    refreshEntry,
    reopenEntry,
  }
}
