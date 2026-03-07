"use client"

import { useEffect, useLayoutEffect, useRef } from "react"
import { toast } from "sonner"
import { autoSaveIfDirty } from "@/lib/dirty-guard"

const IDLE_TIMEOUT_MS = 60 * 60 * 1000   // 60 minutes
const WARN_BEFORE_MS  = 5  * 60 * 1000   // warn 5 minutes before logout
const CHECK_INTERVAL  = 30 * 1000         // check every 30 seconds

/**
 * Logs the user out after IDLE_TIMEOUT_MS of inactivity.
 * Shows a toast warning WARN_BEFORE_MS before logout fires.
 * Any user activity resets the timer and dismisses the warning.
 */
export function useIdleTimeout(onLogout: () => Promise<void> | void) {
  // Keep latest onLogout without re-running the effect
  const onLogoutRef = useRef(onLogout)
  useLayoutEffect(() => {
    onLogoutRef.current = onLogout
  })

  useEffect(() => {
    let lastActivity = Date.now()
    let warningToastId: string | number | null = null
    let warningShown = false

    const dismissWarning = () => {
      if (warningToastId !== null) {
        toast.dismiss(warningToastId)
        warningToastId = null
      }
      warningShown = false
    }

    const handleActivity = () => {
      lastActivity = Date.now()
      if (warningShown) dismissWarning()
    }

    const EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "click"] as const
    EVENTS.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }))

    const interval = setInterval(() => {
      void (async () => {
        const idle = Date.now() - lastActivity

        if (idle >= IDLE_TIMEOUT_MS) {
          clearInterval(interval)
          dismissWarning()
          await autoSaveIfDirty()
          toast.error("You have been logged out due to inactivity.")
          onLogoutRef.current()
          return
        }

        if (idle >= IDLE_TIMEOUT_MS - WARN_BEFORE_MS && !warningShown) {
          warningShown = true
          const minsLeft = Math.ceil((IDLE_TIMEOUT_MS - idle) / 60_000)
          warningToastId = toast.warning(
            `You will be logged out in ${minsLeft} minute${minsLeft !== 1 ? "s" : ""} due to inactivity. Any unsaved changes will be saved as a draft.`,
            {
              duration: Infinity,
              action: {
                label: "Stay logged in",
                onClick: () => {
                  lastActivity = Date.now()
                  dismissWarning()
                },
              },
            }
          )
        }
      })()
    }, CHECK_INTERVAL)

    return () => {
      clearInterval(interval)
      dismissWarning()
      EVENTS.forEach((e) => window.removeEventListener(e, handleActivity))
    }
  }, []) // runs once on mount
}
