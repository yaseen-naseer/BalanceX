"use client"

import { useState, useEffect } from "react"

/**
 * Returns the earliest date the system allows (system setup date).
 * Used to restrict all date pickers from going before the system was set up.
 */
export function useSystemStartDate(): Date | null {
  const [startDate, setStartDate] = useState<Date | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/system-date")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data.success || !data.data?.startDate) return
        setStartDate(new Date(data.data.startDate))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  return startDate
}
