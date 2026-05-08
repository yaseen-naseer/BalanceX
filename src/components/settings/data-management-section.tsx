'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Database, Download } from 'lucide-react'
import { toast } from 'sonner'

export function DataManagementSection() {
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

      </CardContent>
    </Card>
  )
}
