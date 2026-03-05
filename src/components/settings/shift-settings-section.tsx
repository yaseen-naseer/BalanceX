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
import { Clock, Plus, Pencil, Trash2, Star, ArrowUp, ArrowDown } from "lucide-react"
import { toast } from "sonner"

interface ShiftSetting {
  id: string
  name: string
  startTime: string | null
  endTime: string | null
  isDefault: boolean
  isActive: boolean
  sortOrder: number
}

interface ShiftSettingsSectionProps {
  isOwner: boolean
}

export function ShiftSettingsSection({ isOwner }: ShiftSettingsSectionProps) {
  const [shifts, setShifts] = useState<ShiftSetting[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingShift, setEditingShift] = useState<ShiftSetting | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    startTime: "",
    endTime: "",
    isDefault: false,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchShifts()
  }, [])

  const fetchShifts = async () => {
    try {
      const res = await fetch("/api/shift-settings")
      if (res.ok) {
        const data = await res.json()
        setShifts(data.data || [])
      }
    } catch (error) {
      console.error("Error fetching shift settings:", error)
      toast.error("Failed to load shift settings")
    } finally {
      setIsLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingShift(null)
    setFormData({ name: "", startTime: "", endTime: "", isDefault: false })
    setShowDialog(true)
  }

  const handleEdit = (shift: ShiftSetting) => {
    setEditingShift(shift)
    setFormData({
      name: shift.name,
      startTime: shift.startTime || "",
      endTime: shift.endTime || "",
      isDefault: shift.isDefault,
    })
    setShowDialog(true)
  }

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error("Shift name is required")
      return
    }

    setIsSubmitting(true)
    try {
      const url = "/api/shift-settings"
      const method = editingShift ? "PATCH" : "POST"
      const body = editingShift
        ? {
            id: editingShift.id,
            name: formData.name,
            startTime: formData.startTime || null,
            endTime: formData.endTime || null,
            isDefault: formData.isDefault,
          }
        : {
            name: formData.name,
            startTime: formData.startTime || null,
            endTime: formData.endTime || null,
            isDefault: formData.isDefault,
          }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success(editingShift ? "Shift updated" : "Shift created")
        setShowDialog(false)
        fetchShifts()
      } else {
        const error = await res.json()
        toast.error(error.error || "Failed to save shift")
      }
    } catch (error) {
      console.error("Error saving shift:", error)
      toast.error("Failed to save shift")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this shift?")) return

    try {
      const res = await fetch(`/api/shift-settings?id=${id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("Shift deleted")
        fetchShifts()
      } else {
        toast.error("Failed to delete shift")
      }
    } catch (error) {
      console.error("Error deleting shift:", error)
      toast.error("Failed to delete shift")
    }
  }

  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetch("/api/shift-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isDefault: true }),
      })

      if (res.ok) {
        toast.success("Default shift updated")
        fetchShifts()
      } else {
        toast.error("Failed to update default shift")
      }
    } catch (error) {
      console.error("Error updating default:", error)
      toast.error("Failed to update default shift")
    }
  }

  const handleMoveOrder = async (id: string, direction: "up" | "down") => {
    const index = shifts.findIndex((s) => s.id === id)
    if (index === -1) return

    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= shifts.length) return

    const newShifts = [...shifts]
    const temp = newShifts[index]
    newShifts[index] = newShifts[newIndex]
    newShifts[newIndex] = temp

    // Update sort orders
    try {
      await Promise.all(
        newShifts.map((shift, idx) =>
          fetch("/api/shift-settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: shift.id, sortOrder: idx }),
          })
        )
      )
      fetchShifts()
    } catch (error) {
      console.error("Error reordering shifts:", error)
      toast.error("Failed to reorder shifts")
    }
  }

  if (!isOwner) return null

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Shift Settings
            </CardTitle>
            <CardDescription>Manage work shifts for cash float tracking</CardDescription>
          </div>
          <Button onClick={handleAdd} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Shift
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading...</div>
          ) : shifts.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">No shifts configured</div>
          ) : (
            <div className="space-y-2">
              {shifts.map((shift, index) => (
                <div
                  key={shift.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {shift.isDefault && (
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    )}
                    <div>
                      <p className="font-medium">{shift.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {shift.startTime && shift.endTime
                          ? `${shift.startTime} - ${shift.endTime}`
                          : "No time set"}
                        {shift.isDefault && " (Default)"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMoveOrder(shift.id, "up")}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMoveOrder(shift.id, "down")}
                      disabled={index === shifts.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    {!shift.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(shift.id)}
                        title="Set as default"
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(shift)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(shift.id)}
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
            <DialogTitle>{editingShift ? "Edit Shift" : "Add Shift"}</DialogTitle>
            <DialogDescription>
              {editingShift
                ? "Update the shift details"
                : "Create a new work shift"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Shift Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Morning Shift"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isDefaultShift"
                checked={formData.isDefault}
                onCheckedChange={(checked: boolean | "indeterminate") =>
                  setFormData({ ...formData, isDefault: checked === true })
                }
              />
              <Label htmlFor="isDefaultShift" className="cursor-pointer">Set as default</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editingShift ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
