"use client"

import { useCallback } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import { Loader2, AlertTriangle, Info, CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Props for the ConfirmDialog component
 */
export interface ConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void
  /** Dialog title */
  title: string
  /** Dialog description/message */
  description: string
  /** Text for the confirm button */
  confirmLabel?: string
  /** Text for the cancel button */
  cancelLabel?: string
  /** Visual variant for the dialog */
  variant?: "default" | "destructive" | "warning" | "info"
  /** Callback when confirm is clicked */
  onConfirm: () => void | Promise<void>
  /** Callback when cancel is clicked */
  onCancel?: () => void
  /** Whether an action is in progress */
  isLoading?: boolean
  /** Loading text to show when isLoading is true */
  loadingText?: string
  /** Whether to show an icon based on variant */
  showIcon?: boolean
  /** Disable confirm button */
  disableConfirm?: boolean
  /** Additional content to render in the dialog body */
  children?: React.ReactNode
}

/**
 * A reusable confirmation dialog component.
 *
 * Use this for:
 * - Delete confirmations
 * - Submit confirmations
 * - Warning acknowledgments
 * - Action confirmations
 *
 * @example
 * ```tsx
 * // Delete confirmation
 * const deleteDialog = useDialogState<{ id: string; name: string }>()
 *
 * <ConfirmDialog
 *   open={deleteDialog.isOpen}
 *   onOpenChange={deleteDialog.onOpenChange}
 *   title="Delete Customer"
 *   description={`Are you sure you want to delete "${deleteDialog.data?.name}"? This action cannot be undone.`}
 *   confirmLabel="Delete"
 *   variant="destructive"
 *   onConfirm={() => handleDelete(deleteDialog.data?.id)}
 *   isLoading={isDeleting}
 * />
 *
 * // Warning confirmation
 * <ConfirmDialog
 *   open={showWarning}
 *   onOpenChange={setShowWarning}
 *   title="Continue with Variance?"
 *   description="Your cash drawer has a variance of -500 MVR. Do you want to submit anyway?"
 *   confirmLabel="Submit Anyway"
 *   variant="warning"
 *   onConfirm={handleSubmit}
 * />
 * ```
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
  isLoading = false,
  loadingText = "Processing...",
  showIcon = true,
  disableConfirm = false,
  children,
}: ConfirmDialogProps) {
  // Variant-specific styling
  const variantConfig = {
    default: {
      icon: CheckCircle2,
      iconColor: "text-primary",
      buttonVariant: "default" as const,
    },
    destructive: {
      icon: XCircle,
      iconColor: "text-destructive",
      buttonVariant: "destructive" as const,
    },
    warning: {
      icon: AlertTriangle,
      iconColor: "text-amber-500",
      buttonVariant: "default" as const,
    },
    info: {
      icon: Info,
      iconColor: "text-blue-500",
      buttonVariant: "default" as const,
    },
  }

  const config = variantConfig[variant]
  const Icon = config.icon

  // Handle confirm with async support
  const handleConfirm = useCallback(async () => {
    await onConfirm()
    // Don't close automatically - let parent control this
  }, [onConfirm])

  // Handle cancel
  const handleCancel = useCallback(() => {
    onCancel?.()
    onOpenChange(false)
  }, [onCancel, onOpenChange])

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {showIcon && (
              <Icon className={cn("h-5 w-5", config.iconColor)} />
            )}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {children && <div className="py-4">{children}</div>}

        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={handleCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading || disableConfirm}
            className={cn(
              variant === "destructive" &&
                "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              variant === "warning" &&
                "bg-amber-500 text-white hover:bg-amber-600"
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {loadingText}
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * Props for the DeleteConfirmDialog component
 */
export interface DeleteConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void
  /** Name of the item being deleted */
  itemName: string
  /** Type of item (e.g., "customer", "transaction") */
  itemType?: string
  /** Callback when delete is confirmed */
  onConfirm: () => void | Promise<void>
  /** Whether deletion is in progress */
  isLoading?: boolean
}

/**
 * A specialized confirmation dialog for delete operations.
 *
 * @example
 * ```tsx
 * <DeleteConfirmDialog
 *   open={showDelete}
 *   onOpenChange={setShowDelete}
 *   itemName={customer.name}
 *   itemType="customer"
 *   onConfirm={() => deleteCustomer(customer.id)}
 *   isLoading={isDeleting}
 * />
 * ```
 */
export function DeleteConfirmDialog({
  open,
  onOpenChange,
  itemName,
  itemType = "item",
  onConfirm,
  isLoading = false,
}: DeleteConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${itemType}?`}
      description={`Are you sure you want to delete "${itemName}"? This action cannot be undone.`}
      confirmLabel="Delete"
      variant="destructive"
      onConfirm={onConfirm}
      isLoading={isLoading}
      loadingText="Deleting..."
    />
  )
}

/**
 * Props for the SubmitConfirmDialog component
 */
export interface SubmitConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void
  /** Title for the dialog */
  title?: string
  /** Description/message */
  description?: string
  /** Warnings to display */
  warnings?: string[]
  /** Callback when submit is confirmed */
  onConfirm: () => void | Promise<void>
  /** Whether submission is in progress */
  isLoading?: boolean
}

/**
 * A specialized confirmation dialog for submit operations with optional warnings.
 *
 * @example
 * ```tsx
 * <SubmitConfirmDialog
 *   open={showSubmit}
 *   onOpenChange={setShowSubmit}
 *   warnings={["Cash variance: -50 MVR", "Wallet variance: +100 MVR"]}
 *   onConfirm={handleSubmit}
 *   isLoading={isSubmitting}
 * />
 * ```
 */
export function SubmitConfirmDialog({
  open,
  onOpenChange,
  title = "Submit Entry?",
  description = "Once submitted, this entry will be locked for editing.",
  warnings = [],
  onConfirm,
  isLoading = false,
}: SubmitConfirmDialogProps) {
  const hasWarnings = warnings.length > 0

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmLabel={hasWarnings ? "Submit Anyway" : "Submit"}
      variant={hasWarnings ? "warning" : "default"}
      onConfirm={onConfirm}
      isLoading={isLoading}
      loadingText="Submitting..."
    >
      {hasWarnings && (
        <div className="rounded-md bg-amber-50 p-3 border border-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-800">
                Warnings detected:
              </p>
              <ul className="text-sm text-amber-700 list-disc list-inside">
                {warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </ConfirmDialog>
  )
}
