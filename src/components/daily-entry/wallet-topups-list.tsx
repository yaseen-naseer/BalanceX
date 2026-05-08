"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react"
import { CURRENCY_CODE, fmtCurrency } from "@/lib/constants"
import type { TopupItem, TopupGroup } from "./types"

export interface WalletTopupsListProps {
  groups: TopupGroup[]
  isReadOnly: boolean
  isExpanded: (groupId: string) => boolean
  onToggle: (groupId: string) => void
  /** Receives the underlying `TopupItem` for in-place edit. Optional — hides the pencil if absent. */
  onEdit?: (item: TopupItem) => void
  /** Receives the whole `TopupGroup` for delete (split groups delete all members). */
  onDelete?: (group: TopupGroup) => void
}

/**
 * Top-up history — renders one row per single top-up and one expandable card
 * per split-group. Pure presentation; state lives in `useTopupGroups()`.
 */
export function WalletTopupsList({
  groups,
  isReadOnly,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
}: WalletTopupsListProps) {
  if (groups.length === 0) return null

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Top-up History</p>
      {groups.map((group, gi) => (
        <div key={group.splitGroupId || `single-${gi}`}>
          {group.type === "single" ? (
            <SingleTopupRow
              item={group.items[0]}
              isReadOnly={isReadOnly}
              onEdit={onEdit ? () => onEdit(group.items[0]) : undefined}
              onDelete={onDelete ? () => onDelete(group) : undefined}
            />
          ) : (
            <SplitTopupGroupRow
              group={group}
              isReadOnly={isReadOnly}
              expanded={isExpanded(group.splitGroupId!)}
              onToggle={() => onToggle(group.splitGroupId!)}
              onDelete={onDelete ? () => onDelete(group) : undefined}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function SingleTopupRow({
  item,
  isReadOnly,
  onEdit,
  onDelete,
}: {
  item: TopupItem
  isReadOnly: boolean
  onEdit?: () => void
  onDelete?: () => void
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div>
        <span className="font-mono font-medium">
          {fmtCurrency(item.amount)} {CURRENCY_CODE}
        </span>
        {item.notes && <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>}
      </div>
      <div className="flex items-center gap-1">
        <Badge variant="outline" className="text-xs">
          {item.source}
        </Badge>
        {!isReadOnly && onEdit && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
          </Button>
        )}
        {!isReadOnly && onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
}

function SplitTopupGroupRow({
  group,
  isReadOnly,
  expanded,
  onToggle,
  onDelete,
}: {
  group: TopupGroup
  isReadOnly: boolean
  expanded: boolean
  onToggle: () => void
  onDelete?: () => void
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-2 space-y-1">
      <div className="flex items-center justify-between text-sm">
        <button type="button" className="flex items-center gap-1 text-left" onClick={onToggle}>
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <span className="font-mono font-medium">
            {fmtCurrency(group.totalAmount)} {CURRENCY_CODE}
          </span>
          <Badge variant="secondary" className="text-[10px] ml-1">
            {group.items.length}-way split
          </Badge>
        </button>
        <div className="flex items-center gap-1">
          {!isReadOnly && onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="pl-5 space-y-1">
          {group.items.map((t) => (
            <div key={t.id} className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{fmtCurrency(t.amount)} MVR reload</span>
              <div className="flex items-center gap-2">
                {t.paidAmount && t.paidAmount !== t.amount && (
                  <span>paid {fmtCurrency(t.paidAmount)}</span>
                )}
                <Badge variant="outline" className="text-[10px]">
                  {t.source}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
