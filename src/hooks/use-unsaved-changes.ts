"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"

export interface UseUnsavedChangesReturn {
  showDialog: boolean
  /** Wrap any navigation-like action (e.g. date change) to guard unsaved changes */
  guard: (action: () => void) => void
  handleLeave: () => void
  handleSaveAndLeave: () => Promise<void>
  handleStay: () => void
}

/**
 * Guards against losing unsaved changes on:
 * - Browser close / refresh (beforeunload)
 * - In-app navigation via anchor clicks (capture phase intercept)
 * - Custom actions like date changes (via guard())
 */
export function useUnsavedChanges(
  isDirty: boolean,
  onSave: () => Promise<boolean | string>
): UseUnsavedChangesReturn {
  const [showDialog, setShowDialog] = useState(false)
  const [pendingUrl, setPendingUrl] = useState<string | null>(null)
  const [pendingCallback, setPendingCallback] = useState<(() => void) | null>(null)
  const router = useRouter()

  // Browser close / refresh warning
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [isDirty])

  // Intercept in-app anchor clicks in capture phase (before Next.js handles them)
  useEffect(() => {
    if (!isDirty) return

    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest("a")
      if (!anchor) return

      const href = anchor.getAttribute("href")
      if (!href) return

      // Skip external, hash, mailto, tel links
      if (
        href.startsWith("http") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      )
        return

      // Skip same-page navigation
      const targetPath = href.split("?")[0]
      if (targetPath === window.location.pathname) return

      e.preventDefault()
      e.stopImmediatePropagation()

      setPendingUrl(href)
      setShowDialog(true)
    }

    document.addEventListener("click", handleClick, true)
    return () => document.removeEventListener("click", handleClick, true)
  }, [isDirty])

  /** Use this to guard custom actions (e.g. changing the date picker) */
  const guard = useCallback(
    (action: () => void) => {
      if (isDirty) {
        setPendingCallback(() => action)
        setShowDialog(true)
      } else {
        action()
      }
    },
    [isDirty]
  )

  const handleLeave = useCallback(() => {
    setShowDialog(false)
    if (pendingUrl) {
      const url = pendingUrl
      setPendingUrl(null)
      router.push(url)
    } else if (pendingCallback) {
      const cb = pendingCallback
      setPendingCallback(null)
      cb()
    }
  }, [pendingUrl, pendingCallback, router])

  const handleSaveAndLeave = useCallback(async () => {
    const success = await onSave()
    if (success) handleLeave()
  }, [onSave, handleLeave])

  const handleStay = useCallback(() => {
    setShowDialog(false)
    setPendingUrl(null)
    setPendingCallback(null)
  }, [])

  return { showDialog, guard, handleLeave, handleSaveAndLeave, handleStay }
}
