"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Wallet, Plus, Pencil, Trash2, Star } from "lucide-react"
import { toast } from "sonner"

interface FloatSetting {
  id: string
  name: string
  amount: number
  isDefault: boolean
  isActive: boolean
}

interface CashFloatSettingsSectionProps {
  isOwner: boolean
}

export function CashFloatSettingsSection({ isOwner }: CashFloatSettingsSectionProps) {
  const [floats, setFloats] = useState<FloatSetting[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingFloat, setEditingFloat] = useState<FloatSetting | null>(null)
  const [formData, setFormData] = useState({ name: "", amount: "", isDefault: false })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchFloats()
  }, [])

  const fetchFloats = async () => {
    try {
      const res = await fetch("/api/cash-float-settings")
      if (res.ok) {
        const data = await res.json()
        setFloats(data.data || [])
      }
    } catch (error) {
      console.error("Error fetching float settings:", error)
      toast.error("Failed to load float settings")
    } finally {
      setIsLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingFloat(null)
    setFormData({ name: "", amount: "", isDefault: false })
    setShowDialog(true)
  }

  const handleEdit = (float: FloatSetting) => {
    setEditingFloat(float)
    setFormData({
      name: float.name,
      amount: float.amount.toString(),
      isDefault: float.isDefault,
    })
    setShowDialog(true)
  }

  const handleSubmit = async () => {
    if (!formData.name || !formData.amount) {
      toast.error("Name and amount are required")
      return
    }

    const amount = parseFloat(formData.amount)
    if (isNaN(amount) || amount <= 0) {
      toast.error("Amount must be a positive number")
      return
    }

    setIsSubmitting(true)
    try {
      const url = "/api/cash-float-settings"
      const method = editingFloat ? "PATCH" : "POST"
      const body = editingFloat
        ? { id: editingFloat.id, name: formData.name, amount, isDefault: formData.isDefault }
        : { name: formData.name, amount, isDefault: formData.isDefault }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success(editingFloat ? "Float setting updated" : "Float setting created")
        setShowDialog(false)
        fetchFloats()
      } else {
        const error = await res.json()
        toast.error(error.error || "Failed to save float setting")
      }
    } catch (error) {
      console.error("Error saving float setting:", error)
      toast.error("Failed to save float setting")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this float setting?")) return

    try {
      const res = await fetch(`/api/cash-float-settings?id=${id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("Float setting deleted")
        fetchFloats()
      } else {
        toast.error("Failed to delete float setting")
      }
    } catch (error) {
      console.error("Error deleting float setting:", error)
      toast.error("Failed to delete float setting")
    }
  }

  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetch("/api/cash-float-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isDefault: true }),
      })

      if (res.ok) {
        toast.success("Default float setting updated")
        fetchFloats()
      } else {
        toast.error("Failed to update default setting")
      }
    } catch (error) {
      console.error("Error updating default:", error)
      toast.error("Failed to update default setting")
    }
  }

  if (!isOwner) return null

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Cash Float Settings
            </CardTitle>
            <CardDescription>Manage predefined cash float amounts</CardDescription>
          </div>
          <Button onClick={handleAdd} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Float
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading...</div>
          ) : floats.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No float settings configured
            </div>
          ) : (
            <div className="space-y-2">
              {floats.map((float) => (
                <div
                  key={float.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {float.isDefault && (
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    )}
                    <div>
                      <p className="font-medium">{float.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {float.amount.toLocaleString()} MVR
                        {float.isDefault && " (Default)"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!float.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(float.id)}
                        title="Set as default"
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(float)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(float.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFloat ? "Edit Float Setting" : "Add Float Setting"}</DialogTitle>
            <DialogDescription>
              {editingFloat
                ? "Update the cash float amount"
                : "Create a new predefined cash float amount"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Standard Float"
              />
            </div>
            <div className="space-y-2">
              <Label>Amount (MVR)</Label>
              <Input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="2000"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isDefault"
                checked={formData.isDefault}
                onCheckedChange={(checked: boolean | "indeterminate") =>
                  setFormData({ ...formData, isDefault: checked === true })
                }
              />
              <Label htmlFor="isDefault" className="cursor-pointer">Set as default</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editingFloat ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
