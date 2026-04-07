"use client"

import { useState, useEffect } from "react"
import { useApiClient } from "@/hooks/use-api-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Store, Save } from "lucide-react"
import { toast } from "sonner"
import type { WholesaleDiscountTierData } from "@/types"

interface WholesaleTiersSectionProps {
  isOwner: boolean
}

export function WholesaleTiersSection({ isOwner }: WholesaleTiersSectionProps) {
  const api = useApiClient()
  const [tiers, setTiers] = useState<WholesaleDiscountTierData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [activeStates, setActiveStates] = useState<Record<string, boolean>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    fetchTiers()
  }, [])

  const fetchTiers = async () => {
    try {
      const result = await api.get<WholesaleDiscountTierData[]>("/api/wholesale-discount-tiers")
      if (result.success && result.data) {
        const tierData = result.data
        setTiers(tierData)
        const values: Record<string, string> = {}
        const actives: Record<string, boolean> = {}
        for (const t of tierData) {
          values[t.id] = t.minCashAmount.toString()
          actives[t.id] = t.isActive
        }
        setEditValues(values)
        setActiveStates(actives)
      }
    } catch {
      toast.error("Failed to load discount tiers")
    } finally {
      setIsLoading(false)
    }
  }

  const handleValueChange = (id: string, value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setEditValues((prev) => ({ ...prev, [id]: value }))
      setHasChanges(true)
    }
  }

  const handleToggleActive = (id: string, checked: boolean) => {
    setActiveStates((prev) => ({ ...prev, [id]: checked }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    // Build tiers update payload
    const updates = tiers.map((t) => ({
      id: t.id,
      discountPercent: t.discountPercent,
      minCashAmount: parseFloat(editValues[t.id] || "0") || 0,
      isActive: activeStates[t.id] ?? t.isActive,
    }))

    // Validate ascending min amounts for active tiers only
    const sortedActive = [...updates]
      .filter((t) => t.isActive)
      .sort((a, b) => a.discountPercent - b.discountPercent)
    for (let i = 1; i < sortedActive.length; i++) {
      if (sortedActive[i].minCashAmount <= sortedActive[i - 1].minCashAmount) {
        toast.error(`Min amount for ${sortedActive[i].discountPercent}% must be higher than ${sortedActive[i - 1].discountPercent}%`)
        return
      }
    }

    setIsSaving(true)
    try {
      const result = await api.patch("/api/wholesale-discount-tiers", { tiers: updates })
      if (result.success) {
        toast.success("Discount tiers updated")
        setHasChanges(false)
        fetchTiers()
      } else {
        toast.error(result.error || "Failed to update tiers")
      }
    } catch {
      toast.error("Failed to update tiers")
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOwner) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="h-5 w-5" />
          Wholesale Discount Tiers
        </CardTitle>
        <CardDescription>
          Set minimum cash amounts for each discount tier. Higher cash amounts unlock better discounts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border">
              <div className="grid grid-cols-3 gap-4 px-4 py-2 bg-muted/50 text-sm font-medium text-muted-foreground border-b">
                <span>Discount %</span>
                <span>Min Cash Amount (MVR)</span>
                <span>Status</span>
              </div>
              {tiers
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((tier) => {
                  const isActive = activeStates[tier.id] ?? tier.isActive
                  const isLowest = tier.sortOrder === 1
                  return (
                    <div key={tier.id} className={`grid grid-cols-3 gap-4 items-center px-4 py-2 border-b last:border-b-0 ${!isActive ? "opacity-50" : ""}`}>
                      <span className="font-mono font-semibold">{tier.discountPercent}%</span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={editValues[tier.id] || ""}
                        onChange={(e) => handleValueChange(tier.id, e.target.value)}
                        className="h-8 font-mono w-32"
                        placeholder="0"
                        disabled={!isActive || isLowest}
                      />
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={isActive}
                          onCheckedChange={(checked) => handleToggleActive(tier.id, checked)}
                          disabled={isLowest}
                        />
                        <span className="text-xs text-muted-foreground">
                          {isLowest ? "Always on" : isActive ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    </div>
                  )
                })}
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
                size="sm"
              >
                <Save className="h-4 w-4 mr-1" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
