"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CheckCircle2, AlertTriangle } from "lucide-react"
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
import { useTopupGroups } from "@/hooks/use-topup-groups"
import { WalletOpeningOverride } from "./wallet-opening-override"
import { WalletTopupsList } from "./wallet-topups-list"
import { WalletExpectedClosing } from "./wallet-expected-closing"
import { EditTopupDialog } from "./edit-topup-dialog"
import type { WalletData, VarianceData, TopupItem, TopupGroup } from "./types"

const DELETE_REASONS = [
  "Wrong amount entered",
  "Duplicate top-up",
  "Wrong payment method",
  "Top-up was reversed",
  "Data entry error",
] as const

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
  onOverrideWalletOpening: (amount: number, reason: string) => Promise<boolean> | void
  onRefreshWallet: () => void
  onDeleteTopup?: (id: string) => Promise<boolean>
  onEditTopup?: (id: string, data: { amount: number; paidAmount?: number; source: string; notes?: string }) => Promise<boolean>
}

/**
 * Reload Wallet section component.
 * Orchestrates opening / top-ups list / expected-closing breakdown / actual-closing input
 * around the dialog state for editing and deleting individual top-ups.
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
  const { groups, toggleGroup, isExpanded } = useTopupGroups(dayTopups)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<TopupGroup | null>(null)
  const [deleteReason, setDeleteReason] = useState("")
  const [deleteCustomReason, setDeleteCustomReason] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  // Edit state — only the target item lives here; the dialog encapsulates the form.
  const [editTarget, setEditTarget] = useState<TopupItem | null>(null)

  const finalDeleteReason = deleteReason === "Other" ? deleteCustomReason.trim() : deleteReason

  const openDeleteDialog = (group: TopupGroup) => {
    setDeleteTarget(group)
    setDeleteReason("")
    setDeleteCustomReason("")
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !onDeleteTopup) return
    setIsDeleting(true)
    // Delete using the first item's ID — API handles group deletion.
    const success = await onDeleteTopup(deleteTarget.items[0].id)
    setIsDeleting(false)
    if (success) {
      setDeleteTarget(null)
      setDeleteReason("")
      setDeleteCustomReason("")
      onRefreshWallet()
    }
  }

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
          <WalletOpeningOverride
            opening={wallet.opening}
            walletOpeningSource={walletOpeningSource}
            walletOpeningReason={walletOpeningReason}
            isReadOnly={isReadOnly}
            onOverride={onOverrideWalletOpening}
          />
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

        <WalletTopupsList
          groups={groups}
          isReadOnly={isReadOnly}
          isExpanded={isExpanded}
          onToggle={toggleGroup}
          onEdit={onEditTopup ? setEditTarget : undefined}
          onDelete={onDeleteTopup ? openDeleteDialog : undefined}
        />

        <Separator />

        <WalletExpectedClosing
          opening={wallet.opening}
          topups={totalTopups}
          reloadSales={reloadSalesTotal}
          expected={variance.walletExpected}
        />

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

      {/* Edit Top-up Dialog — keyed on the target id so the form state resets on each open. */}
      {onEditTopup && (
        <EditTopupDialog
          key={editTarget?.id ?? "closed"}
          topup={editTarget}
          onClose={() => setEditTarget(null)}
          onSubmit={onEditTopup}
          onSuccess={onRefreshWallet}
        />
      )}
    </Card>
  )
}
