"use client"

import { useState, useEffect } from "react"
import { useApiClient } from "@/hooks/use-api-client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

// Denominations in MVR
const DENOMINATIONS = [
  { value: 1000, label: "1,000 MVR", key: "Mvr1000" },
  { value: 500, label: "500 MVR", key: "Mvr500" },
  { value: 100, label: "100 MVR", key: "Mvr100" },
  { value: 50, label: "50 MVR", key: "Mvr50" },
  { value: 20, label: "20 MVR", key: "Mvr20" },
  { value: 10, label: "10 MVR", key: "Mvr10" },
  { value: 5, label: "5 MVR", key: "Mvr5" },
  { value: 2, label: "2 MVR", key: "Mvr2" },
  { value: 1, label: "1 MVR", key: "Mvr1" },
  { value: 0.5, label: "0.50 MVR (50 laari)", key: "Mvr050" },
]

interface CashFloatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dailyEntryId: string
  date: string
  type: "opening" | "closing"
  existingFloat?: CashFloatData | null
  cashExpected?: number
  onSuccess?: () => void
}

interface CashFloatData {
  id: string
  shiftName: string
  selectedFloatAmount: number
  openingTotal?: number
  closingTotal?: number
  variance?: number
  [key: string]: string | number | boolean | undefined
}

interface FloatSetting {
  id: string
  name: string
  amount: number
  isDefault: boolean
}

interface ShiftSetting {
  id: string
  name: string
  startTime: string | null
  endTime: string | null
  isDefault: boolean
}

export function CashFloatDialog({
  open,
  onOpenChange,
  dailyEntryId,
  date,
  type,
  existingFloat,
  cashExpected = 0,
  onSuccess,
}: CashFloatDialogProps) {
  const api = useApiClient()
  const [isLoading, setIsLoading] = useState(false)
  const [floatSettings, setFloatSettings] = useState<FloatSetting[]>([])
  const [shiftSettings, setShiftSettings] = useState<ShiftSetting[]>([])
  const [selectedFloatId, setSelectedFloatId] = useState<string>("")
  const [selectedShiftId, setSelectedShiftId] = useState<string>("")
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [verified, setVerified] = useState(false)
  const [notes, setNotes] = useState("")
  const [calculatedTotal, setCalculatedTotal] = useState(0)

  // Load settings
  useEffect(() => {
    if (open) {
      loadSettings()
      if (existingFloat && type === "closing") {
        // Pre-fill closing counts from existing data
        const closingCounts: Record<string, number> = {}
        DENOMINATIONS.forEach((denom) => {
          const key = `closing${denom.key}`
          if (existingFloat[key] !== undefined) {
            closingCounts[denom.key] = Number(existingFloat[key]) || 0
          }
        })
        setCounts(closingCounts)
        setNotes(typeof existingFloat.closingFloatNotes === 'string' ? existingFloat.closingFloatNotes : "")
        setVerified(Boolean(existingFloat.closingFloatVerified))
        setSelectedFloatId(typeof existingFloat.selectedFloatId === 'string' ? existingFloat.selectedFloatId : "")
      } else if (type === "opening") {
        // Clear for opening
        setCounts({})
        setNotes("")
        setVerified(false)
      }
    }
  }, [open, existingFloat, type])

  // Calculate total when counts change
  useEffect(() => {
    const total = DENOMINATIONS.reduce((sum, denom) => {
      const count = counts[denom.key] || 0
      return sum + count * denom.value
    }, 0)
    setCalculatedTotal(total)
  }, [counts])

  const loadSettings = async () => {
    try {
      const floatResult = await api.get<FloatSetting[]>("/api/cash-float-settings")
      if (floatResult.data) {
        setFloatSettings(floatResult.data)
        const defaultFloat = floatResult.data.find((f) => f.isDefault)
        if (defaultFloat && !existingFloat) {
          setSelectedFloatId(defaultFloat.id)
        }
      }

      const shiftResult = await api.get<ShiftSetting[]>("/api/shift-settings")
      if (shiftResult.data) {
        setShiftSettings(shiftResult.data)
        const defaultShift = shiftResult.data.find((s) => s.isDefault)
        if (defaultShift && !existingFloat) {
          setSelectedShiftId(defaultShift.id)
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error)
      toast.error("Failed to load cash float settings")
    }
  }

  const handleCountChange = (key: string, value: string) => {
    const numValue = parseInt(value) || 0
    setCounts((prev) => ({ ...prev, [key]: numValue }))
  }

  const handleSubmit = async () => {
    if (!verified) {
      toast.error("Please verify the count by checking the acknowledgment box")
      return
    }

    setIsLoading(true)
    try {
      const selectedFloat = floatSettings.find((f) => f.id === selectedFloatId)
      const selectedShift = shiftSettings.find((s) => s.id === selectedShiftId)

      // Prepare denomination data
      const denomData: Record<string, number> = {}
      DENOMINATIONS.forEach((denom) => {
        const prefix = type === "opening" ? "opening" : "closing"
        denomData[`${prefix}${denom.key}`] = counts[denom.key] || 0
      })

      if (type === "opening") {
        const createResult = await api.post<{ id: string }>("/api/cash-float", {
          dailyEntryId,
          selectedFloatId,
          shiftId: selectedShiftId,
        })

        if (!createResult.success) {
          throw new Error(createResult.error || "Failed to create cash float")
        }

        const updateResult = await api.patch("/api/cash-float", {
          id: createResult.data!.id,
          type: "opening",
          ...denomData,
          verified,
          notes,
        })

        if (!updateResult.success) {
          throw new Error(updateResult.error || "Failed to update opening float")
        }
      } else {
        const updateResult = await api.patch("/api/cash-float", {
          id: existingFloat?.id,
          type: "closing",
          ...denomData,
          verified,
          notes,
        })

        if (!updateResult.success) {
          throw new Error(updateResult.error || "Failed to update closing float")
        }
      }

      toast.success(
        type === "opening"
          ? "Opening float recorded successfully"
          : "Closing float recorded successfully"
      )
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error("Error saving cash float:", error)
      toast.error(error instanceof Error ? error.message : "Failed to save cash float")
    } finally {
      setIsLoading(false)
    }
  }

  const selectedFloatAmount = floatSettings.find((f) => f.id === selectedFloatId)?.amount || 0
  const expectedTotal = type === "closing" ? cashExpected : selectedFloatAmount
  const variance = calculatedTotal - expectedTotal

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {type === "opening" ? "Record Opening Float" : "Record Closing Float"}
          </DialogTitle>
          <DialogDescription>
            {type === "opening"
              ? "Count and record the starting cash float for this shift"
              : "Count and record the ending cash float for this shift"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Float Amount Selection */}
          <div className="space-y-2">
            <Label>Float Amount</Label>
            <Select value={selectedFloatId} onValueChange={setSelectedFloatId}>
              <SelectTrigger>
                <SelectValue placeholder="Select float amount" />
              </SelectTrigger>
              <SelectContent>
                {floatSettings.map((setting) => (
                  <SelectItem key={setting.id} value={setting.id}>
                    {setting.name} ({setting.amount.toLocaleString()} MVR)
                    {setting.isDefault && " - Default"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Shift Selection */}
          <div className="space-y-2">
            <Label>Shift</Label>
            <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
              <SelectTrigger>
                <SelectValue placeholder="Select shift" />
              </SelectTrigger>
              <SelectContent>
                {shiftSettings.map((shift) => (
                  <SelectItem key={shift.id} value={shift.id}>
                    {shift.name}
                    {shift.startTime && shift.endTime && ` (${shift.startTime} - ${shift.endTime})`}
                    {shift.isDefault && " - Default"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Denomination Counts */}
          <div className="space-y-3">
            <Label>Denomination Count</Label>
            <div className="grid grid-cols-2 gap-4">
              {DENOMINATIONS.map((denom) => (
                <div key={denom.key} className="flex items-center gap-3">
                  <Label className="w-32 text-sm text-muted-foreground">{denom.label}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={counts[denom.key] || ""}
                    onChange={(e) => handleCountChange(denom.key, e.target.value)}
                    className="w-24 text-right"
                    placeholder="0"
                  />
                  <span className="text-sm text-muted-foreground w-20 text-right">
                    = {((counts[denom.key] || 0) * denom.value).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {type === "closing" ? "Expected Closing (Cash Reconciliation):" : "Float Amount:"}
              </span>
              <span className="font-medium">{expectedTotal.toLocaleString()} MVR</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Counted Total:</span>
              <span className="font-medium">{calculatedTotal.toLocaleString()} MVR</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-muted-foreground">Variance:</span>
              <span
                className={`font-bold ${
                  variance === 0
                    ? "text-emerald-600"
                    : variance > 0
                    ? "text-amber-600"
                    : "text-red-600"
                }`}
              >
                {variance >= 0 ? "+" : ""}
                {variance.toLocaleString()} MVR
              </span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any discrepancies or notes..."
            />
          </div>

          {/* Verification Checkbox */}
          <div className="flex items-start space-x-3 bg-amber-50 p-4 rounded-lg border border-amber-200">
            <Checkbox
              id="verified"
              checked={verified}
              onCheckedChange={(checked) => setVerified(checked as boolean)}
              className="mt-1"
            />
            <div className="space-y-1">
              <Label
                htmlFor="verified"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                I have verified this count
              </Label>
              <p className="text-xs text-muted-foreground">
                By checking this box, I confirm that I have personally counted all cash and the
                amounts are accurate.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !verified}>
            {isLoading ? "Saving..." : type === "opening" ? "Record Opening" : "Record Closing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
