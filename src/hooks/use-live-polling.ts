"use client"

import { useEffect, useRef, useState, useCallback } from "react"

interface UseLivePollingOptions {
  /** URL to poll — null disables polling */
  url: string | null
  /** Poll interval in ms (default 10000) */
  intervalMs?: number
  /** Master switch to enable/disable */
  enabled?: boolean
  /** Called when remote data has changed */
  onUpdate: () => void
}

interface UseLivePollingReturn {
  /** True when actively polling */
  isLive: boolean
  /** Timestamp of last successful poll */
  lastChecked: Date | null
}

export function useLivePolling({
  url,
  intervalMs = 10_000,
  enabled = true,
  onUpdate,
}: UseLivePollingOptions): UseLivePollingReturn {
  const [isLive, setIsLive] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const lastSnapshotRef = useRef<string | null>(null)
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  const poll = useCallback(async () => {
    if (!url) return

    try {
      const res = await fetch(url)
      if (!res.ok) return

      const data = await res.json()
      if (!data.success) return

      // Build a snapshot string from the response to detect changes
      const snapshot = JSON.stringify(data.data)
      setLastChecked(new Date())

      if (lastSnapshotRef.current !== null && lastSnapshotRef.current !== snapshot) {
        // Remote data changed — trigger update
        onUpdateRef.current()
      }
      lastSnapshotRef.current = snapshot
      setIsLive(true)
    } catch {
      // Network error — silently skip this poll
    }
  }, [url])

  useEffect(() => {
    if (!url || !enabled) {
      setIsLive(false)
      return
    }

    // Poll immediately on start
    poll()

    // Set up interval
    const id = setInterval(poll, intervalMs)

    // Pause when tab hidden, resume + immediate poll on focus
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        poll()
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", handleVisibility)
      setIsLive(false)
    }
  }, [url, enabled, intervalMs, poll])

  // Reset snapshot when URL changes (e.g. date change)
  useEffect(() => {
    lastSnapshotRef.current = null
  }, [url])

  return { isLive, lastChecked }
}
