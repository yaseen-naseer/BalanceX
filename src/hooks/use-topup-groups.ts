"use client"

import { useCallback, useMemo, useState } from "react"
import type { TopupItem, TopupGroup } from "@/components/daily-entry/types"

/**
 * Group raw top-ups into single + split-group buckets, and manage the
 * expand/collapse state for the split groups.
 *
 * Pure helper extracted from `wallet-section.tsx` so the section component
 * can stay focused on layout + dialogs.
 */
function groupTopups(topups: TopupItem[]): TopupGroup[] {
  const groups: TopupGroup[] = []
  const splitMap = new Map<string, TopupItem[]>()

  for (const t of topups) {
    if (t.splitGroupId) {
      const existing = splitMap.get(t.splitGroupId) || []
      existing.push(t)
      splitMap.set(t.splitGroupId, existing)
    } else {
      groups.push({
        type: "single",
        items: [t],
        totalAmount: t.amount,
        totalPaid: t.paidAmount || t.amount,
        splitGroupId: null,
      })
    }
  }

  for (const [groupId, items] of splitMap) {
    groups.push({
      type: "split",
      items,
      totalAmount: items.reduce((s, t) => s + t.amount, 0),
      totalPaid: items.reduce((s, t) => s + (t.paidAmount || t.amount), 0),
      splitGroupId: groupId,
    })
  }

  return groups
}

export interface UseTopupGroupsResult {
  groups: TopupGroup[]
  expandedGroups: Set<string>
  toggleGroup: (groupId: string) => void
  isExpanded: (groupId: string) => boolean
}

export function useTopupGroups(topups: TopupItem[]): UseTopupGroupsResult {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const groups = useMemo(() => groupTopups(topups), [topups])

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }, [])

  const isExpanded = useCallback(
    (groupId: string) => expandedGroups.has(groupId),
    [expandedGroups],
  )

  return { groups, expandedGroups, toggleGroup, isExpanded }
}
