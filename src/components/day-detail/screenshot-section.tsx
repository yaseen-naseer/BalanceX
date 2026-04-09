'use client'

import { useState, useCallback, useEffect } from 'react'
import { useApiClient } from '@/hooks/use-api-client'
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
  DialogDescription,
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
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import type { ScreenshotData } from './types'

export interface ScreenshotSectionProps {
  currentDate: string
  canUpload: boolean
  isOwner: boolean
  onStatusChange?: (status: { uploaded: boolean; verified: boolean }) => void
}

export function ScreenshotSection({ currentDate, canUpload, isOwner, onStatusChange }: ScreenshotSectionProps) {
  const api = useApiClient()
  const [screenshot, setScreenshot] = useState<ScreenshotData | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showVerifyConfirm, setShowVerifyConfirm] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  const [verifyNotes, setVerifyNotes] = useState('')
  const [isVerified, setIsVerified] = useState(false)

  const fetchScreenshot = useCallback(async () => {
    try {
      const result = await api.get<ScreenshotData>('/api/screenshots', { params: { date: currentDate } })
      if (result?.success && result.data) {
        setScreenshot(result.data)
        setIsVerified(result.data.isVerified || false)
        setVerifyNotes(result.data.verifyNotes || '')
        onStatusChange?.({ uploaded: true, verified: result.data.isVerified || false })
      } else {
        setScreenshot(null)
        setIsVerified(false)
        setVerifyNotes('')
        onStatusChange?.({ uploaded: false, verified: false })
      }
    } catch {
      setScreenshot(null)
      setIsVerified(false)
      setVerifyNotes('')
      onStatusChange?.({ uploaded: false, verified: false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const result = await api.post('/api/screenshots/verify', {
        screenshotId: screenshot.id,
        verified: isVerified,
        notes: verifyNotes,
      })

      if (result.success) {
        toast.success('Screenshot verified. This cannot be undone.')
        setShowVerifyConfirm(false)
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

    setIsDeleting(true)
    try {
      const result = await api.delete('/api/screenshots', { params: { id: screenshot.id } })
      if (result.success) {
        toast.success('Screenshot deleted')
        setScreenshot(null)
        setIsVerified(false)
        setVerifyNotes('')
        setShowDeleteConfirm(false)
        onStatusChange?.({ uploaded: false, verified: false })
      } else {
        toast.error(result.error || 'Failed to delete screenshot')
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
                onDelete={() => setShowDeleteConfirm(true)}
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
                onVerify={() => setShowVerifyConfirm(true)}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Image Modal */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="!max-w-[90vw] !w-auto max-h-[95vh] !grid-rows-[auto_1fr] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              Telco Report - {format(new Date(currentDate), 'dd MMM yyyy')}
            </DialogTitle>
            <DialogDescription className="sr-only">Full-size telco report screenshot</DialogDescription>
          </DialogHeader>
          {screenshot && (
            <div className="overflow-auto max-h-[calc(95vh-5rem)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screenshot.filepath}
                alt="Telco report screenshot"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Verify Confirmation Dialog */}
      <ConfirmDialog
        open={showVerifyConfirm}
        onOpenChange={setShowVerifyConfirm}
        title="Confirm Verification"
        description="Once verified, this cannot be undone. The screenshot will be permanently marked as verified."
        confirmLabel="Verify"
        variant="default"
        onConfirm={handleVerify}
        isLoading={isVerifying}
        loadingText="Verifying..."
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Screenshot?"
        description="Are you sure you want to delete this screenshot? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={isDeleting}
        loadingText="Deleting..."
      />
    </>
  )
}

// Expose screenshot status for parent component
export function useScreenshotStatus(currentDate: string) {
  const api = useApiClient()
  const [screenshot, setScreenshot] = useState<ScreenshotData | null>(null)

  useEffect(() => {
    const fetchScreenshot = async () => {
      try {
        const result = await api.get<ScreenshotData>('/api/screenshots', { params: { date: currentDate } })
        if (result.success && result.data) {
          setScreenshot(result.data)
        } else {
          setScreenshot(null)
        }
      } catch {
        setScreenshot(null)
      }
    }
    fetchScreenshot()
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
          unoptimized
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity">
          <Eye className="h-8 w-8 text-white" />
        </div>
      </div>

      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Uploaded by {screenshot.uploader?.name || 'Unknown'}</span>
        <div className="flex items-center gap-2">
          {canUpload && !screenshot.isVerified && (
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
          {isOwner && !screenshot.isVerified && (
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
        screenshot.isVerified ? (
          // Already verified — show locked state
          <div className="rounded-lg p-4 bg-emerald-50">
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
              {screenshot.verifyNotes && <p className="mt-2 text-sm">{screenshot.verifyNotes}</p>}
            </div>
          </div>
        ) : (
          // Not yet verified — show form
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

            <Button onClick={onVerify} disabled={isVerifying || !isVerified} className="w-full">
              {isVerifying ? 'Saving...' : 'Verify Screenshot'}
            </Button>
          </>
        )
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
