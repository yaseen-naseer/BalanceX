"use client"

import { useState, useEffect } from "react"
import { useApiClient } from "@/hooks/use-api-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { SlidersHorizontal, Save } from "lucide-react"
import { toast } from "sonner"
import { BUSINESS_RULES_DEFAULTS, type BusinessRules } from "@/lib/business-rules-shared"

interface BusinessRulesSectionProps {
  isOwner: boolean
}

/**
 * Owner-only UI for the runtime-tunable thresholds previously hardcoded in
 * `lib/permissions.ts` and `lib/calculations/dashboard.ts`. Pairs with
 * `/api/settings/business-rules` (GET = any auth, PATCH = OWNER).
 */
export function BusinessRulesSection({ isOwner }: BusinessRulesSectionProps) {
  const api = useApiClient()
  const [rules, setRules] = useState<BusinessRules>(BUSINESS_RULES_DEFAULTS)
  const [accountantDays, setAccountantDays] = useState("")
  const [overdueDays, setOverdueDays] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isOwner) {
      setIsLoading(false)
      return
    }
    fetchRules()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner])

  const fetchRules = async () => {
    setIsLoading(true)
    try {
      const result = await api.get<BusinessRules>("/api/settings/business-rules")
      if (result.success && result.data) {
        setRules(result.data)
        setAccountantDays(result.data.accountantEditWindowDays.toString())
        setOverdueDays(result.data.overdueCreditDays.toString())
      } else {
        toast.error(result.error ?? "Failed to load business rules")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const accountantNum = parseInt(accountantDays, 10)
  const overdueNum = parseInt(overdueDays, 10)
  const hasAccountantChange =
    !isNaN(accountantNum) && accountantNum !== rules.accountantEditWindowDays
  const hasOverdueChange =
    !isNaN(overdueNum) && overdueNum !== rules.overdueCreditDays
  const hasChanges = hasAccountantChange || hasOverdueChange
  const accountantValid = !isNaN(accountantNum) && accountantNum >= 1 && accountantNum <= 365
  const overdueValid = !isNaN(overdueNum) && overdueNum >= 1 && overdueNum <= 365
  const canSave = hasChanges && accountantValid && overdueValid

  const handleSave = async () => {
    if (!canSave) return
    setIsSaving(true)
    try {
      const payload: Partial<BusinessRules> = {}
      if (hasAccountantChange) payload.accountantEditWindowDays = accountantNum
      if (hasOverdueChange) payload.overdueCreditDays = overdueNum
      const result = await api.patch<BusinessRules>("/api/settings/business-rules", payload)
      if (result.success && result.data) {
        toast.success("Business rules updated")
        setRules(result.data)
        setAccountantDays(result.data.accountantEditWindowDays.toString())
        setOverdueDays(result.data.overdueCreditDays.toString())
      } else {
        toast.error(result.error ?? "Failed to update")
      }
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOwner) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5" />
          Business Rules
        </CardTitle>
        <CardDescription>
          Owner-tunable thresholds. Changes apply immediately to all users.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="accountantDays">Accountant edit / reopen window (days)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="accountantDays"
                  type="number"
                  min={1}
                  max={365}
                  value={accountantDays}
                  onChange={(e) => setAccountantDays(e.target.value)}
                  className="w-28 font-mono"
                />
                <span className="text-sm text-muted-foreground">
                  How many days back ACCOUNTANT users can edit or reopen a daily entry.
                  OWNER is unrestricted; SALES is limited to today.
                </span>
              </div>
              {!accountantValid && accountantDays.length > 0 && (
                <p className="text-xs text-rose-600">Must be a whole number between 1 and 365.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="overdueDays">Credit overdue alert threshold (days)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="overdueDays"
                  type="number"
                  min={1}
                  max={365}
                  value={overdueDays}
                  onChange={(e) => setOverdueDays(e.target.value)}
                  className="w-28 font-mono"
                />
                <span className="text-sm text-muted-foreground">
                  Customers with positive outstanding balance and no activity for longer than
                  this trigger the dashboard overdue alert.
                </span>
              </div>
              {!overdueValid && overdueDays.length > 0 && (
                <p className="text-xs text-rose-600">Must be a whole number between 1 and 365.</p>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={!canSave || isSaving} size="sm">
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
