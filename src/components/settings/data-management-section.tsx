'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { AlertTriangle, Database, Download, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export interface DataManagementSectionProps {
  isOwner: boolean
}

export function DataManagementSection({ isOwner }: DataManagementSectionProps) {
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const handleExportData = async (format: 'json' | 'csv') => {
    try {
      const response = await fetch(`/api/export?format=${format}`)
      if (!response.ok) {
        toast.error('Failed to export data')
        return
      }

      const contentType = response.headers.get('content-type')
      if (contentType?.includes('text/csv')) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `balancex-export-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        const data = await response.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `balancex-backup-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }

      toast.success(`Data exported as ${format.toUpperCase()}`)
    } catch {
      toast.error('Failed to export data')
    }
  }

  const handleClearData = async () => {
    if (confirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm')
      return
    }

    toast.error(
      'Data clear functionality requires database reset. Please contact your administrator.'
    )
    setShowClearDialog(false)
    setConfirmText('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Data Management
        </CardTitle>
        <CardDescription>Export or manage your application data</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
          <div>
            <h4 className="font-medium">Export Data (JSON)</h4>
            <p className="text-sm text-muted-foreground">
              Download a full backup of all data in JSON format
            </p>
          </div>
          <Button onClick={() => handleExportData('json')}>
            <Download className="mr-2 h-4 w-4" />
            Export JSON
          </Button>
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
          <div>
            <h4 className="font-medium">Export Report (CSV)</h4>
            <p className="text-sm text-muted-foreground">
              Download daily entries summary as CSV spreadsheet
            </p>
          </div>
          <Button variant="outline" onClick={() => handleExportData('csv')}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {isOwner && (
          <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/20 bg-destructive/5">
            <div>
              <h4 className="font-medium text-destructive">Clear All Data</h4>
              <p className="text-sm text-muted-foreground">
                Permanently delete all application data
              </p>
            </div>
            <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
              <DialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear Data
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Clear All Data
                  </DialogTitle>
                  <DialogDescription>
                    This action cannot be undone. All your daily entries, credit customers, bank
                    transactions, and wallet data will be permanently deleted.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="confirm">Type DELETE to confirm</Label>
                  <Input
                    id="confirm"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="mt-2"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowClearDialog(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleClearData}>
                    Clear All Data
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
