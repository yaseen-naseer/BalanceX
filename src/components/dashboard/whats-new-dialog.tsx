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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Sparkles,
  Store,
  Shield,
  Wallet,
  CreditCard,
  Pencil,
  Bug,
  Radio,
  Type,
  ShieldCheck,
  Database,
  Wrench,
  Lock,
  AlertTriangle,
  Layers,
  FileSearch,
} from 'lucide-react'

// Bump this version string whenever you want to show the dialog again
const WHATS_NEW_VERSION = '2026-04-07b'
const STORAGE_KEY = 'balancex_whats_new_seen'

interface ChangeItem {
  icon: React.ReactNode
  title: string
  description: string
  tag?: string
}

interface ChangeGroup {
  version: string
  date: string
  items: ChangeItem[]
}

const CHANGELOG: ChangeGroup[] = [
  {
    version: 'v0.5',
    date: 'April 7, 2026',
    items: [
      {
        icon: <Lock className="h-4 w-4 text-red-500" />,
        title: 'Atomic Transactions Everywhere',
        description:
          'Credit sales, bank transfers, wallet reloads, and settlements are now wrapped in serializable transactions. Concurrent operations can no longer cause double-spending, over-settlement, or orphaned records.',
        tag: 'Security',
      },
      {
        icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
        title: 'Error Boundaries & Graceful Recovery',
        description:
          'Every dashboard section now has a dedicated error page with a retry button. Component crashes show a helpful message instead of a blank screen.',
        tag: 'New',
      },
      {
        icon: <Layers className="h-4 w-4 text-indigo-500" />,
        title: 'Daily Entry Refactored',
        description:
          'The daily entry form has been split into focused hooks for line items, calculations, validation, and submission. Line item add/edit/delete are now dedicated dialogs with audit-trail reasons.',
        tag: 'Improvement',
      },
      {
        icon: <Shield className="h-4 w-4 text-purple-500" />,
        title: 'Stricter Validation & Access Control',
        description:
          'Minimum amount enforcement (0.01 MVR), future date rejection, and line item field-size limits. Exports now respect role permissions — SALES users see less sensitive data.',
        tag: 'Security',
      },
      {
        icon: <FileSearch className="h-4 w-4 text-sky-500" />,
        title: 'Import Preview',
        description:
          'CSV imports now show a summary and table preview before confirming. See exactly what will be imported before it happens.',
        tag: 'New',
      },
      {
        icon: <Database className="h-4 w-4 text-emerald-500" />,
        title: 'Performance & Precision',
        description:
          'Added database indexes on key columns for faster queries at scale. Financial arithmetic now uses Decimal.js to eliminate floating-point rounding errors. Large exports are capped to prevent memory issues.',
        tag: 'Improvement',
      },
      {
        icon: <ShieldCheck className="h-4 w-4 text-teal-500" />,
        title: 'Stale Session Recovery',
        description:
          'Sessions are now verified against the database periodically. If the database is reset or your account is removed, you are automatically redirected to the setup or login page instead of seeing a broken dashboard.',
        tag: 'Fix',
      },
    ],
  },
  {
    version: 'v0.4',
    date: 'March 17, 2026',
    items: [
      {
        icon: <ShieldCheck className="h-4 w-4 text-emerald-500" />,
        title: 'Security Hardening',
        description:
          'Added Content-Security-Policy header, explicit session cookie flags, 8-hour session timeout, timing-attack mitigation on login, and atomic account lockout. Passwords now use stronger hashing.',
        tag: 'Security',
      },
      {
        icon: <Database className="h-4 w-4 text-blue-500" />,
        title: 'Financial Calculation Accuracy',
        description:
          'All financial calculations now use safe Decimal-to-number conversion instead of raw Number() casts. Wallet opening balance derivation is wrapped in a serializable transaction to prevent race conditions.',
        tag: 'Fix',
      },
      {
        icon: <Wrench className="h-4 w-4 text-orange-500" />,
        title: 'Performance & Reliability',
        description:
          'Added database indexes on frequently queried date and foreign key columns. Dashboard alerts now use batched queries instead of N+1 loops. Financial rounding uses proper half-up precision.',
        tag: 'Improvement',
      },
      {
        icon: <Shield className="h-4 w-4 text-purple-500" />,
        title: 'Code Quality Overhaul',
        description:
          'Settings page migrated to standard API client. Race conditions fixed in wallet auto-load and sale line items. All API error logging now uses sanitized logger. Removed dead code.',
        tag: 'Improvement',
      },
    ],
  },
  {
    version: 'v0.3',
    date: 'March 16, 2026',
    items: [
      {
        icon: <Radio className="h-4 w-4 text-emerald-500" />,
        title: 'Live Updates',
        description:
          'Daily entry page auto-refreshes every 10 seconds on all open tabs. Both editors and viewers stay in sync — line items and wallet update instantly while manual grid edits are protected.',
        tag: 'New',
      },
      {
        icon: <Type className="h-4 w-4 text-indigo-500" />,
        title: 'Smaller UI',
        description:
          'Reduced the base font size across the entire app for a more compact, information-dense layout.',
        tag: 'UI',
      },
      {
        icon: <Bug className="h-4 w-4 text-red-500" />,
        title: 'Page Reload Fix',
        description:
          'Fixed an issue where daily entry sales data would show as 0 after a page reload, even though the data was saved correctly.',
        tag: 'Fix',
      },
    ],
  },
  {
    version: 'v0.2',
    date: 'March 15, 2026',
    items: [
      {
        icon: <Store className="h-4 w-4 text-orange-500" />,
        title: 'Wholesale Reload System',
        description:
          'Full wholesale customer management with automatic discount tiers (6%\u20138%). Track cash received vs reload given, with per-customer margin tracking.',
        tag: 'New',
      },
      {
        icon: <CreditCard className="h-4 w-4 text-blue-500" />,
        title: 'Wholesale Credit Sales',
        description:
          'Credit sales for wholesale reload now pick from wholesale customers. Credit balance tracks what they owe (cash), wallet deducts the reload amount.',
        tag: 'New',
      },
      {
        icon: <Wallet className="h-4 w-4 text-emerald-500" />,
        title: 'Wallet Balance Protection',
        description:
          'All reload sales (retail, wholesale, credit) are blocked if the wallet balance is insufficient. Shows current balance and required amount.',
        tag: 'New',
      },
      {
        icon: <Shield className="h-4 w-4 text-purple-500" />,
        title: 'Discount Tier Settings',
        description:
          'Owners can enable/disable discount tiers and set per-customer fixed discounts that override the global tier thresholds.',
        tag: 'Settings',
      },
      {
        icon: <Pencil className="h-4 w-4 text-sky-500" />,
        title: 'Sale Line Item Editing',
        description:
          'Edit or delete individual sale line items with a required reason. Full audit trail for every change.',
        tag: 'New',
      },
    ],
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
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            What&apos;s New
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 -mx-6 px-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 10rem)' }}>
          <div className="space-y-6 py-2">
            {CHANGELOG.map((group, gi) => (
              <div key={gi}>
                {gi > 0 && <Separator className="mb-6" />}
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant={gi === 0 ? 'default' : 'outline'} className="text-xs font-bold">
                    {group.version}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{group.date}</span>
                </div>
                <div className="space-y-3">
                  {group.items.map((item, i) => (
                    <div key={i} className="flex gap-2.5">
                      <div className="mt-0.5 shrink-0">{item.icon}</div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-xs">{item.title}</p>
                          {item.tag && (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                              {item.tag}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="shrink-0">
          <Button onClick={handleDismiss} className="w-full sm:w-auto">
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
