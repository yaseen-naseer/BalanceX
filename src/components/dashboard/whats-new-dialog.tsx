'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Store, Shield, Wallet, CreditCard, Pencil, Bug } from 'lucide-react'

// Bump this version string whenever you want to show the dialog again
const WHATS_NEW_VERSION = '2026-03-16'
const STORAGE_KEY = 'balancex_whats_new_seen'

interface ChangeItem {
  icon: React.ReactNode
  title: string
  description: string
  tag?: string
}

const CHANGES: ChangeItem[] = [
  {
    icon: <Store className="h-5 w-5 text-orange-500" />,
    title: 'Wholesale Reload System',
    description:
      'Full wholesale customer management with automatic discount tiers (6%–8%). Track cash received vs reload given, with per-customer margin tracking.',
    tag: 'New',
  },
  {
    icon: <CreditCard className="h-5 w-5 text-blue-500" />,
    title: 'Wholesale Credit Sales',
    description:
      'Credit sales for wholesale reload now pick from wholesale customers. Credit balance tracks what they owe (cash), wallet deducts the reload amount.',
    tag: 'New',
  },
  {
    icon: <Wallet className="h-5 w-5 text-emerald-500" />,
    title: 'Wallet Balance Protection',
    description:
      'All reload sales (retail, wholesale, credit) are blocked if the wallet balance is insufficient. Shows current balance and required amount.',
    tag: 'New',
  },
  {
    icon: <Shield className="h-5 w-5 text-purple-500" />,
    title: 'Discount Tier Settings',
    description:
      'Owners can enable/disable discount tiers and set per-customer fixed discounts that override the global tier thresholds.',
    tag: 'Settings',
  },
  {
    icon: <Pencil className="h-5 w-5 text-sky-500" />,
    title: 'Sale Line Item Editing',
    description:
      'Edit or delete individual sale line items with a required reason. Full audit trail for every change.',
    tag: 'New',
  },
  {
    icon: <Bug className="h-5 w-5 text-red-500" />,
    title: 'Page Reload Fix',
    description:
      'Fixed an issue where daily entry sales data would show as 0 after a page reload, even though the data was saved correctly.',
    tag: 'Fix',
  },
]

// Global event to open the dialog from anywhere
const OPEN_EVENT = 'balancex:whats-new-open'

/** Call this to open the What's New dialog from anywhere */
export function openWhatsNew() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

export function WhatsNewDialog() {
  const [open, setOpen] = useState(false)

  const handleOpen = useCallback(() => setOpen(true), [])

  // Auto-show on first visit for this version
  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY)
    if (seen !== WHATS_NEW_VERSION) {
      const timer = setTimeout(() => setOpen(true), 800)
      return () => clearTimeout(timer)
    }
  }, [])

  // Listen for manual open events
  useEffect(() => {
    window.addEventListener(OPEN_EVENT, handleOpen)
    return () => window.removeEventListener(OPEN_EVENT, handleOpen)
  }, [handleOpen])

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, WHATS_NEW_VERSION)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            What&apos;s New
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {CHANGES.map((item, i) => (
            <div key={i} className="flex gap-3">
              <div className="mt-0.5 shrink-0">{item.icon}</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{item.title}</p>
                  {item.tag && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {item.tag}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button onClick={handleDismiss} className="w-full sm:w-auto">
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
