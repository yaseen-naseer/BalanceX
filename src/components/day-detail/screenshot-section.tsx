'use client'

import { useState, useCallback, useEffect } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  Eye,
  AlertTriangle,
  Trash2,
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { ScreenshotData } from './types'

export interface ScreenshotSectionProps {
  currentDate: string
  canUpload: boolean
  isOwner: boolean
}

export function ScreenshotSection({ currentDate, canUpload, isOwner }: ScreenshotSectionProps) {
  const [screenshot, setScreenshot] = useState<ScreenshotData | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  const [verifyNotes, setVerifyNotes] = useState('')
  const [isVerified, setIsVerified] = useState(false)

  const fetchScreenshot = useCallback(async () => {
    try {
      const response = await fetch(`/api/screenshots?date=${currentDate}`)
      if (response.ok) {
        const data = await response.json()
        setScreenshot(data)
        setIsVerified(data?.isVerified || false)
        setVerifyNotes(data?.verifyNotes || '')
      } else if (response.status === 404) {
        setScreenshot(null)
        setIsVerified(false)
        setVerifyNotes('')
      }
    } catch (err) {
      console.error('Error fetching screenshot:', err)
    }
  }, [currentDate])

  useEffect(() => {
    fetchScreenshot()
  }, [fetchScreenshot])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      toast.error('Only JPG and PNG files are allowed')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB')
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('date', currentDate)

      const response = await fetch('/api/screenshots', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        toast.success('Screenshot uploaded successfully')
        fetchScreenshot()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to upload screenshot')
      }
    } catch (_err) {
      toast.error('Failed to upload screenshot')
    } finally {
      setIsUploading(false)
    }
  }

  const handleVerify = async () => {
    if (!screenshot) return

    setIsVerifying(true)
    try {
      const response = await fetch('/api/screenshots/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshotId: screenshot.id,
          verified: isVerified,
          notes: verifyNotes,
        }),
      })

      if (response.ok) {
        toast.success(isVerified ? 'Screenshot verified' : 'Verification updated')
        fetchScreenshot()
      } else {
        toast.error('Failed to update verification')
      }
    } catch (_err) {
      toast.error('Failed to update verification')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleDelete = async () => {
    if (!screenshot) return

    if (!confirm('Are you sure you want to delete this screenshot? This action cannot be undone.')) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/screenshots?id=${screenshot.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Screenshot deleted')
        setScreenshot(null)
        setIsVerified(false)
        setVerifyNotes('')
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to delete screenshot')
      }
    } catch (_err) {
      toast.error('Failed to delete screenshot')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Telco Report Screenshot
          </CardTitle>
          <CardDescription>Upload and verify telco system report</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!screenshot ? (
            <UploadPlaceholder
              canUpload={canUpload}
              isUploading={isUploading}
              onFileUpload={handleFileUpload}
            />
          ) : (
            <>
              <ScreenshotPreview
                screenshot={screenshot}
                canUpload={canUpload}
                isOwner={isOwner}
                isUploading={isUploading}
                isDeleting={isDeleting}
                onView={() => setShowImageModal(true)}
                onFileUpload={handleFileUpload}
                onDelete={handleDelete}
              />

              <Separator />

              <VerificationSection
                screenshot={screenshot}
                canUpload={canUpload}
                isVerified={isVerified}
                verifyNotes={verifyNotes}
                isVerifying={isVerifying}
                onVerifiedChange={setIsVerified}
                onNotesChange={setVerifyNotes}
                onVerify={handleVerify}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Image Modal */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Telco Report - {format(new Date(currentDate), 'dd MMM yyyy')}
            </DialogTitle>
          </DialogHeader>
          {screenshot && (
            <div className="relative">
              <Image
                src={screenshot.filepath}
                alt="Telco report screenshot"
                width={1200}
                height={900}
                className="w-full h-auto"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// Expose screenshot status for parent component
export function useScreenshotStatus(currentDate: string) {
  const [screenshot, setScreenshot] = useState<ScreenshotData | null>(null)

  useEffect(() => {
    const fetchScreenshot = async () => {
      try {
        const response = await fetch(`/api/screenshots?date=${currentDate}`)
        if (response.ok) {
          const data = await response.json()
          setScreenshot(data)
        } else {
          setScreenshot(null)
        }
      } catch {
        setScreenshot(null)
      }
    }
    fetchScreenshot()
  }, [currentDate])

  return {
    screenshotUploaded: !!screenshot,
    screenshotVerified: screenshot?.isVerified || false,
  }
}

interface UploadPlaceholderProps {
  canUpload: boolean
  isUploading: boolean
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}

function UploadPlaceholder({ canUpload, isUploading, onFileUpload }: UploadPlaceholderProps) {
  return (
    <div className="rounded-lg border-2 border-dashed p-8 text-center">
      <ImageIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
      <p className="mb-2 font-medium">No screenshot uploaded</p>
      <p className="mb-4 text-sm text-muted-foreground">
        Upload a screenshot of the telco report for verification
      </p>
      {canUpload ? (
        <div className="relative inline-block">
          <Input
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            onChange={onFileUpload}
            className="absolute inset-0 opacity-0 cursor-pointer"
            disabled={isUploading}
          />
          <Button disabled={isUploading}>
            <Upload className="mr-2 h-4 w-4" />
            {isUploading ? 'Uploading...' : 'Upload Screenshot'}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-amber-600">Only Owner/Accountant can upload screenshots</p>
      )}
    </div>
  )
}

interface ScreenshotPreviewProps {
  screenshot: ScreenshotData
  canUpload: boolean
  isOwner: boolean
  isUploading: boolean
  isDeleting: boolean
  onView: () => void
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDelete: () => void
}

function ScreenshotPreview({
  screenshot,
  canUpload,
  isOwner,
  isUploading,
  isDeleting,
  onView,
  onFileUpload,
  onDelete,
}: ScreenshotPreviewProps) {
  return (
    <>
      <div
        className="relative cursor-pointer rounded-lg border overflow-hidden"
        onClick={onView}
      >
        <Image
          src={screenshot.filepath}
          alt="Telco report screenshot"
          width={400}
          height={300}
          className="w-full h-auto object-contain max-h-64"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity">
          <Eye className="h-8 w-8 text-white" />
        </div>
      </div>

      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Uploaded by {screenshot.uploader?.name || 'Unknown'}</span>
        <div className="flex items-center gap-2">
          {canUpload && (
            <div className="relative">
              <Input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={onFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-20"
                disabled={isUploading}
              />
              <Button variant="link" size="sm" disabled={isUploading}>
                Replace
              </Button>
            </div>
          )}
          {isOwner && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              disabled={isDeleting}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </>
  )
}

interface VerificationSectionProps {
  screenshot: ScreenshotData
  canUpload: boolean
  isVerified: boolean
  verifyNotes: string
  isVerifying: boolean
  onVerifiedChange: (verified: boolean) => void
  onNotesChange: (notes: string) => void
  onVerify: () => void
}

function VerificationSection({
  screenshot,
  canUpload,
  isVerified,
  verifyNotes,
  isVerifying,
  onVerifiedChange,
  onNotesChange,
  onVerify,
}: VerificationSectionProps) {
  return (
    <div className="space-y-4">
      <h4 className="font-medium">Verification</h4>

      {canUpload ? (
        <>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="verified"
              checked={isVerified}
              onCheckedChange={(checked) => onVerifiedChange(checked as boolean)}
            />
            <Label htmlFor="verified">
              I have verified the manual entry matches the telco report screenshot
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Verification Notes (optional)</Label>
            <Textarea
              id="notes"
              value={verifyNotes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Add any notes about discrepancies or observations..."
              rows={2}
            />
          </div>

          <Button onClick={onVerify} disabled={isVerifying} className="w-full">
            {isVerifying ? 'Saving...' : 'Save Verification'}
          </Button>
        </>
      ) : (
        <div
          className={cn(
            'rounded-lg p-4',
            screenshot.isVerified ? 'bg-emerald-50' : 'bg-amber-50'
          )}
        >
          {screenshot.isVerified ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Verified</span>
              </div>
              {(screenshot.verifiedBy || screenshot.verifiedAt) && (
                <p className="text-xs text-emerald-600">
                  {screenshot.verifiedBy && `By ${screenshot.verifiedBy}`}
                  {screenshot.verifiedBy && screenshot.verifiedAt && ' on '}
                  {screenshot.verifiedAt &&
                    format(new Date(screenshot.verifiedAt), 'dd MMM yyyy, h:mm a')}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">Pending verification</span>
            </div>
          )}
          {screenshot.verifyNotes && <p className="mt-2 text-sm">{screenshot.verifyNotes}</p>}
        </div>
      )}
    </div>
  )
}
