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
  /** Called on every successful poll with the response data */
  onData?: (data: unknown) => void
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
  onData,
}: UseLivePollingOptions): UseLivePollingReturn {
  const [isLive, setIsLive] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const lastSnapshotRef = useRef<string | null>(null)
  // Mirror the latest callbacks into refs (post-commit) so `poll()` (which fires
  // from a setInterval started in another effect) always reads the freshest
  // versions without `poll` itself depending on them.
  const onUpdateRef = useRef(onUpdate)
  const onDataRef = useRef(onData)
  useEffect(() => {
    onUpdateRef.current = onUpdate
    onDataRef.current = onData
  })

  const poll = useCallback(async () => {
    if (!url) return

    try {
      const res = await fetch(url)
      if (!res.ok) return

      const data = await res.json()
      if (!data.success) return

      // Notify on every successful poll (for presence, etc.)
      onDataRef.current?.(data.data)

      // Build a snapshot string excluding activeEditors (presence changes shouldn't trigger full refresh)
      const { activeEditors: _, ...rest } = (data.data || {}) as Record<string, unknown>
      const snapshot = JSON.stringify(rest)
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
      // The React Compiler flags `setIsLive(false)` here as a "cascading renders"
      // risk because it's a synchronous setState in an effect — but this branch
      // only fires when polling is actually disabled, so it's idempotent and
      // doesn't cascade. Behaviour-preserved.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
