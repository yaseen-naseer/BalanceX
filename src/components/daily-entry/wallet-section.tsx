"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { CheckCircle2, AlertTriangle, Info, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { CurrencyInput } from "@/components/shared"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { AddTopupDialog } from "@/components/wallet"
import { CURRENCY_CODE, fmtCurrency } from "@/lib/constants"
import type { WalletData, VarianceData } from "./types"

const OVERRIDE_REASONS = [
  "Previous day closing was incorrect",
  "System balance doesn't match actual",
  "Balance adjusted by management",
  "Starting fresh after stock count",
  "Correcting data entry error",
] as const

const DELETE_REASONS = [
  "Wrong amount entered",
  "Duplicate top-up",
  "Wrong payment method",
  "Top-up was reversed",
  "Data entry error",
] as const

interface TopupItem {
  id: string
  amount: number
  paidAmount?: number
  source: string
  notes?: string | null
  splitGroupId?: string | null
}

export interface WalletSectionProps {
  wallet: WalletData
  reloadSalesTotal: number
  variance: VarianceData
  dayTopups: TopupItem[]
  totalTopups: number
  currentDate: string
  isReadOnly: boolean
  walletOpeningSource: string
  walletOpeningReason: string | null
  onFieldChange: (field: string, value: number | string) => void
  onOverrideWalletOpening: (amount: number, reason: string) => void
  onRefreshWallet: () => void
  onDeleteTopup?: (id: string) => Promise<boolean>
  onEditTopup?: (id: string, data: { amount: number; paidAmount?: number; source: string; notes?: string }) => Promise<boolean>
}

interface TopupGroup {
  type: "single" | "split"
  items: TopupItem[]
  totalAmount: number
  totalPaid: number
  splitGroupId: string | null
}

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

/**
 * Reload Wallet section component.
 * Displays wallet balance tracking and top-up management.
 */
export function WalletSection({
  wallet,
  reloadSalesTotal,
  variance,
  dayTopups,
  totalTopups,
  currentDate,
  isReadOnly,
  walletOpeningSource,
  walletOpeningReason,
  onFieldChange,
  onOverrideWalletOpening,
  onRefreshWallet,
  onDeleteTopup,
  onEditTopup,
}: WalletSectionProps) {
  const [showOverride, setShowOverride] = useState(false)
  const [overrideAmount, setOverrideAmount] = useState("")
  const [overrideReason, setOverrideReason] = useState("")
  const [overrideCustomReason, setOverrideCustomReason] = useState("")

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<TopupGroup | null>(null)
  const [deleteReason, setDeleteReason] = useState("")
  const [deleteCustomReason, setDeleteCustomReason] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  // Edit state
  const [editTarget, setEditTarget] = useState<TopupItem | null>(null)
  const [editAmount, setEditAmount] = useState("")
  const [editPaidAmount, setEditPaidAmount] = useState("")
  const [editSource, setEditSource] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [isEditing, setIsEditing] = useState(false)

  // Expand split groups
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const isManual = walletOpeningSource === "MANUAL"
  const finalReason = overrideReason === "Other" ? overrideCustomReason.trim() : overrideReason
  const finalDeleteReason = deleteReason === "Other" ? deleteCustomReason.trim() : deleteReason

  const openOverrideDialog = () => {
    setOverrideAmount(wallet.opening.toString())
    setOverrideReason("")
    setOverrideCustomReason("")
    setShowOverride(true)
  }

  const handleConfirmOverride = () => {
    const amount = parseFloat(overrideAmount)
    if (isNaN(amount) || amount < 0) return
    onOverrideWalletOpening(amount, finalReason)
    setShowOverride(false)
  }

  const openEditDialog = (item: TopupItem) => {
    setEditTarget(item)
    setEditAmount(item.amount.toString())
    setEditPaidAmount(item.paidAmount?.toString() || item.amount.toString())
    setEditSource(item.source)
    setEditNotes(item.notes || "")
    setIsEditing(false)
  }

  const handleConfirmEdit = async () => {
    if (!editTarget || !onEditTopup) return
    const amount = parseFloat(editAmount)
    const paidAmount = parseFloat(editPaidAmount)
    if (isNaN(amount) || amount <= 0) return
    setIsEditing(true)
    const success = await onEditTopup(editTarget.id, {
      amount,
      paidAmount: isNaN(paidAmount) ? undefined : paidAmount,
      source: editSource,
      notes: editNotes,
    })
    setIsEditing(false)
    if (success) {
      setEditTarget(null)
      onRefreshWallet()
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !onDeleteTopup) return
    setIsDeleting(true)
    // Delete using the first item's ID — API handles group deletion
    const success = await onDeleteTopup(deleteTarget.items[0].id)
    setIsDeleting(false)
    if (success) {
      setDeleteTarget(null)
      setDeleteReason("")
      setDeleteCustomReason("")
      onRefreshWallet()
    }
  }

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const topupGroups = groupTopups(dayTopups)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Reload Wallet</CardTitle>
          <CardDescription>Track wallet balance and top-ups</CardDescription>
        </div>
        <AddTopupDialog defaultDate={currentDate} onAdd={onRefreshWallet} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="walletOpening">Opening Balance</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex h-9 items-center rounded-md border bg-muted/40 px-3 font-mono text-sm">
                {fmtCurrency(wallet.opening)} {CURRENCY_CODE}
              </div>
              {!isReadOnly && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={openOverrideDialog}
                  title="Override opening balance"
                  aria-label="Override opening balance"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
            {isManual && walletOpeningReason && (
              <p className="text-xs text-amber-600">
                Manually set — {walletOpeningReason}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Today&apos;s Top-ups</Label>
            <div className="flex items-center gap-2">
              <Input
                value={`${fmtCurrency(totalTopups)} ${CURRENCY_CODE}`}
                disabled
                className="font-mono"
              />
              {dayTopups.length > 0 && (
                <Badge variant="secondary">{dayTopups.length}</Badge>
              )}
            </div>
          </div>
        </div>

        {topupGroups.length > 0 && (
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Top-up History</p>
            {topupGroups.map((group, gi) => (
              <div key={group.splitGroupId || `single-${gi}`}>
                {group.type === "single" ? (
                  <SingleTopupRow
                    item={group.items[0]}
                    isReadOnly={isReadOnly}
                    onEdit={onEditTopup ? () => openEditDialog(group.items[0]) : undefined}
                    onDelete={onDeleteTopup ? () => { setDeleteTarget(group); setDeleteReason(""); setDeleteCustomReason("") } : undefined}
                  />
                ) : (
                  <SplitTopupGroup
                    group={group}
                    isReadOnly={isReadOnly}
                    expanded={expandedGroups.has(group.splitGroupId!)}
                    onToggle={() => toggleGroup(group.splitGroupId!)}
                    onDelete={onDeleteTopup ? () => { setDeleteTarget(group); setDeleteReason(""); setDeleteCustomReason("") } : undefined}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <Separator />

        {/* Calculation Breakdown */}
        {(() => {
          const overBalance = variance.walletExpected < 0
          return (
            <div className={cn(
              "rounded-lg border-2 p-4 space-y-3",
              overBalance ? "border-rose-300 bg-rose-50" : "border-blue-200 bg-blue-50"
            )}>
              <div className={cn(
                "flex items-center gap-2 font-medium",
                overBalance ? "text-rose-700" : "text-blue-700"
              )}>
                {overBalance ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <Info className="h-4 w-4" />
                )}
                {overBalance
                  ? "Reload sales exceed wallet balance!"
                  : "Expected Closing Calculation"}
              </div>
              <div className="grid grid-cols-4 gap-2 text-sm">
                <div className="text-center">
                  <p className="text-muted-foreground text-xs">Opening</p>
                  <p className="font-mono font-medium">{fmtCurrency(wallet.opening)}</p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground text-xs">+ Top-ups</p>
                  <p className="font-mono font-medium text-emerald-600">
                    +{fmtCurrency(totalTopups)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground text-xs">- Reload Sales</p>
                  <p className={cn("font-mono font-medium", overBalance ? "text-rose-700 font-bold" : "text-rose-600")}>
                    -{fmtCurrency(reloadSalesTotal)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground text-xs">= Balance</p>
                  <p className={cn("font-mono font-bold", overBalance ? "text-rose-700" : "text-blue-700")}>
                    {fmtCurrency(variance.walletExpected)}
                  </p>
                </div>
              </div>
              {overBalance && (
                <p className="text-xs text-rose-700">
                  Add a top-up of at least{" "}
                  <span className="font-semibold">
                    {fmtCurrency(Math.abs(variance.walletExpected))} {CURRENCY_CODE}
                  </span>{" "}
                  or reduce reload sales before submitting.
                </p>
              )}
            </div>
          )
        })()}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="walletClosing">Actual Closing</Label>
            <CurrencyInput
              id="walletClosing"
              value={wallet.closingActual}
              onChange={(v) => onFieldChange("wallet.closingActual", v)}
              disabled={isReadOnly}
            />
            <p className="text-xs text-muted-foreground">Enter your actual wallet balance</p>
          </div>
          <div className="space-y-2">
            <Label>Variance</Label>
            <div
              className={cn(
                "flex h-9 items-center rounded-md border px-3 font-mono",
                variance.walletVariance === 0
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : variance.walletVariance > 0
                    ? "bg-amber-50 border-amber-200 text-amber-700"
                    : "bg-rose-50 border-rose-200 text-rose-700"
              )}
            >
              {variance.walletVariance === 0 ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Balanced
                </>
              ) : (
                <>
                  {variance.walletVariance > 0 ? "+" : ""}
                  {fmtCurrency(variance.walletVariance)} {CURRENCY_CODE}
                  <AlertTriangle className="ml-auto h-4 w-4" />
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>

      {/* Override Opening Balance Dialog */}
      <ConfirmDialog
        open={showOverride}
        onOpenChange={setShowOverride}
        title="Override Opening Balance"
        description="The opening balance is automatically set from the previous day's closing. Provide a reason to override it."
        confirmLabel="Override"
        variant="warning"
        onConfirm={handleConfirmOverride}
        disableConfirm={!finalReason || !overrideAmount || parseFloat(overrideAmount) < 0}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>New Opening Balance (MVR) *</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={overrideAmount}
              onChange={(e) => {
                if (e.target.value === "" || /^\d*\.?\d*$/.test(e.target.value)) {
                  setOverrideAmount(e.target.value)
                }
              }}
              placeholder="0.00"
              className="font-mono"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Reason for override *</Label>
            <Select
              value={overrideReason}
              onValueChange={(v) => {
                setOverrideReason(v)
                if (v !== "Other") setOverrideCustomReason("")
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {OVERRIDE_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                ))}
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            {overrideReason === "Other" && (
              <Input
                placeholder="Enter reason..."
                value={overrideCustomReason}
                onChange={(e) => setOverrideCustomReason(e.target.value)}
              />
            )}
          </div>
        </div>
      </ConfirmDialog>

      {/* Delete Top-up Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title={deleteTarget?.type === "split" ? "Delete Split Payment?" : "Delete Top-up?"}
        description={
          deleteTarget?.type === "split"
            ? `This will remove all ${deleteTarget.items.length} splits (total ${fmtCurrency(deleteTarget.totalAmount)} MVR reload).`
            : deleteTarget
              ? `Remove the ${fmtCurrency(deleteTarget.totalAmount)} MVR reload top-up?`
              : ""
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        loadingText="Deleting..."
        disableConfirm={!finalDeleteReason}
      >
        <div className="space-y-3">
          {deleteTarget?.type === "split" && (
            <div className="rounded-lg border p-2 space-y-1 text-sm">
              {deleteTarget.items.map((t) => (
                <div key={t.id} className="flex justify-between">
                  <span>{t.source} — {fmtCurrency(t.amount)} MVR</span>
                  {t.paidAmount && t.paidAmount !== t.amount && (
                    <span className="text-muted-foreground">(paid {fmtCurrency(t.paidAmount)})</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <Label>Reason for deletion *</Label>
          <Select
            value={deleteReason}
            onValueChange={(v) => {
              setDeleteReason(v)
              if (v !== "Other") setDeleteCustomReason("")
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a reason..." />
            </SelectTrigger>
            <SelectContent>
              {DELETE_REASONS.map((reason) => (
                <SelectItem key={reason} value={reason}>{reason}</SelectItem>
              ))}
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
          {deleteReason === "Other" && (
            <Input
              placeholder="Enter reason..."
              value={deleteCustomReason}
              onChange={(e) => setDeleteCustomReason(e.target.value)}
              autoFocus
            />
          )}
        </div>
      </ConfirmDialog>

      {/* Edit Top-up Dialog */}
      <ConfirmDialog
        open={!!editTarget}
        onOpenChange={(open) => { if (!open) setEditTarget(null) }}
        title="Edit Top-up"
        description="Update the top-up details."
        confirmLabel="Save"
        variant="default"
        onConfirm={handleConfirmEdit}
        isLoading={isEditing}
        loadingText="Saving..."
        disableConfirm={!editAmount || parseFloat(editAmount) <= 0}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reload Amount (MVR) *</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={editAmount}
              onChange={(e) => {
                if (e.target.value === "" || /^\d*\.?\d*$/.test(e.target.value)) {
                  setEditAmount(e.target.value)
                }
              }}
              placeholder="0.00"
              className="font-mono"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Paid Amount (MVR)</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={editPaidAmount}
              onChange={(e) => {
                if (e.target.value === "" || /^\d*\.?\d*$/.test(e.target.value)) {
                  setEditPaidAmount(e.target.value)
                }
              }}
              placeholder="0.00"
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <div className="flex gap-2">
              {(["CASH", "BANK"] as const).map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant={editSource === s ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setEditSource(s)}
                >
                  {s === "CASH" ? "Cash" : "Bank"}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Input
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Optional notes..."
            />
          </div>
        </div>
      </ConfirmDialog>
    </Card>
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
        <span className="font-mono font-medium">{fmtCurrency(item.amount)} {CURRENCY_CODE}</span>
        {item.notes && (
          <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Badge variant="outline" className="text-xs">{item.source}</Badge>
        {!isReadOnly && onEdit && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
          </Button>
        )}
        {!isReadOnly && onDelete && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
}

function SplitTopupGroup({
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
          <span className="font-mono font-medium">{fmtCurrency(group.totalAmount)} {CURRENCY_CODE}</span>
          <Badge variant="secondary" className="text-[10px] ml-1">
            {group.items.length}-way split
          </Badge>
        </button>
        <div className="flex items-center gap-1">
          {!isReadOnly && onDelete && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
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
                <Badge variant="outline" className="text-[10px]">{t.source}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
