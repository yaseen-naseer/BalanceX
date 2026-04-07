"use client"

import { createContext, useContext } from "react"
import type { UseDailyEntryFormReturn } from "@/hooks/use-daily-entry-form"
import type { UseWholesaleCustomersReturn } from "@/hooks/use-wholesale-customers"

interface DailyEntryContextValue {
  form: UseDailyEntryFormReturn
  wholesale: UseWholesaleCustomersReturn
}

const DailyEntryContext = createContext<DailyEntryContextValue | null>(null)

interface DailyEntryProviderProps {
  form: UseDailyEntryFormReturn
  wholesale: UseWholesaleCustomersReturn
  children: React.ReactNode
}

export function DailyEntryProvider({
  form,
  wholesale,
  children,
}: DailyEntryProviderProps) {
  return (
    <DailyEntryContext.Provider value={{ form, wholesale }}>
      {children}
    </DailyEntryContext.Provider>
  )
}

export function useDailyEntryContext(): DailyEntryContextValue {
  const context = useContext(DailyEntryContext)
  if (!context) {
    throw new Error(
      "useDailyEntryContext must be used within a DailyEntryProvider"
    )
  }
  return context
}
