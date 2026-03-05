"use client"

import { useState, useCallback, useMemo } from "react"

/**
 * Return type for useDialogState hook
 */
interface UseDialogStateReturn<T> {
  /** Whether the dialog is currently open */
  isOpen: boolean
  /** Data associated with the dialog (e.g., item being edited) */
  data: T | undefined
  /** Open the dialog, optionally with initial data */
  open: (initialData?: T) => void
  /** Close the dialog and clear data */
  close: () => void
  /** Update the data without closing the dialog */
  setData: (data: T | undefined) => void
  /** Toggle the dialog open/closed */
  toggle: () => void
  /** Handle open state change (for controlled dialog components) */
  onOpenChange: (open: boolean) => void
}

/**
 * Hook for managing dialog/modal open state with optional associated data.
 *
 * Useful for dialogs that need to display or edit data, such as:
 * - Edit forms that need the item to edit
 * - Confirmation dialogs that need the item to delete
 * - Detail views that show item information
 *
 * @example
 * ```tsx
 * // Simple usage - no data
 * const addDialog = useDialogState()
 *
 * <Button onClick={() => addDialog.open()}>Add New</Button>
 * <Dialog open={addDialog.isOpen} onOpenChange={addDialog.onOpenChange}>
 *   ...
 * </Dialog>
 *
 * // With data - for edit dialogs
 * const editDialog = useDialogState<User>()
 *
 * <Button onClick={() => editDialog.open(user)}>Edit</Button>
 * <Dialog open={editDialog.isOpen} onOpenChange={editDialog.onOpenChange}>
 *   {editDialog.data && <EditForm user={editDialog.data} />}
 * </Dialog>
 *
 * // For delete confirmation
 * const deleteDialog = useDialogState<{ id: string; name: string }>()
 *
 * <Button onClick={() => deleteDialog.open({ id: item.id, name: item.name })}>
 *   Delete
 * </Button>
 * <AlertDialog open={deleteDialog.isOpen} onOpenChange={deleteDialog.onOpenChange}>
 *   <AlertDialogDescription>
 *     Are you sure you want to delete "{deleteDialog.data?.name}"?
 *   </AlertDialogDescription>
 *   <AlertDialogAction onClick={() => handleDelete(deleteDialog.data?.id)}>
 *     Delete
 *   </AlertDialogAction>
 * </AlertDialog>
 * ```
 */
export function useDialogState<T = undefined>(): UseDialogStateReturn<T> {
  const [isOpen, setIsOpen] = useState(false)
  const [data, setData] = useState<T | undefined>(undefined)

  const open = useCallback((initialData?: T) => {
    setData(initialData)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    // Clear data after a short delay to allow exit animations
    setTimeout(() => {
      setData(undefined)
    }, 150)
  }, [])

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setIsOpen(true)
      } else {
        close()
      }
    },
    [close]
  )

  return useMemo(
    () => ({
      isOpen,
      data,
      open,
      close,
      setData,
      toggle,
      onOpenChange,
    }),
    [isOpen, data, open, close, setData, toggle, onOpenChange]
  )
}

/**
 * Hook for managing multiple related dialogs.
 *
 * Useful when you have several dialogs that shouldn't be open at the same time.
 *
 * @example
 * ```tsx
 * type DialogType = "add" | "edit" | "delete" | null
 * const { activeDialog, openDialog, closeDialog, dialogData } = useMultiDialogState<DialogType, User>()
 *
 * <Button onClick={() => openDialog("add")}>Add</Button>
 * <Button onClick={() => openDialog("edit", user)}>Edit</Button>
 *
 * <AddDialog open={activeDialog === "add"} onClose={closeDialog} />
 * <EditDialog open={activeDialog === "edit"} data={dialogData} onClose={closeDialog} />
 * ```
 */
export function useMultiDialogState<
  TDialog extends string,
  TData = undefined
>() {
  const [activeDialog, setActiveDialog] = useState<TDialog | null>(null)
  const [dialogData, setDialogData] = useState<TData | undefined>(undefined)

  const openDialog = useCallback((dialog: TDialog, data?: TData) => {
    setDialogData(data)
    setActiveDialog(dialog)
  }, [])

  const closeDialog = useCallback(() => {
    setActiveDialog(null)
    setTimeout(() => {
      setDialogData(undefined)
    }, 150)
  }, [])

  const isDialogOpen = useCallback(
    (dialog: TDialog) => activeDialog === dialog,
    [activeDialog]
  )

  return useMemo(
    () => ({
      activeDialog,
      dialogData,
      openDialog,
      closeDialog,
      isDialogOpen,
      setDialogData,
    }),
    [activeDialog, dialogData, openDialog, closeDialog, isDialogOpen, setDialogData]
  )
}
