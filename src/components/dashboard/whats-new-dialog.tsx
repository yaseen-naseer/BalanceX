'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  Users,
  Calculator,
  SplitSquareHorizontal,
} from 'lucide-react'

// Bump this version string whenever you want to show the dialog again
const WHATS_NEW_VERSION = '2026-04-10b'
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
    version: 'v0.8-beta',
    date: 'April 10, 2026',
    items: [
      {
        icon: <CreditCard className="h-4 w-4 text-emerald-500" />,
        title: 'Credit Settlements: Cheque & Bank Auto-Deposit',
        description:
          'Credit customer settlements now support Cheque as a payment method. Transfer and Cheque settlements automatically create a bank deposit in the bank ledger — no more manual reconciliation. Cash settlements continue to flow into the daily cash drawer.',
        tag: 'New',
      },
      {
        icon: <SplitSquareHorizontal className="h-4 w-4 text-blue-500" />,
        title: 'Split Settlement Payments',
        description:
          'Customers can now settle their balance using up to 3 payment methods at once (Cash, Cheque, Transfer). Each method can be used once per settlement, and bank deposits are auto-created for the non-cash portions.',
        tag: 'New',
      },
      {
        icon: <Bug className="h-4 w-4 text-red-500" />,
        title: 'Cash Settlements Now Reflect Before Draft',
        description:
          'Cash credit settlements now show in the daily entry expected closing even before the day\'s draft has been started. Previously the calculation only ran after a draft existed, hiding pre-recorded settlements from the cash reconciliation.',
        tag: 'Fix',
      },
    ],
  },
  {
    version: 'v0.7-beta',
    date: 'April 9, 2026',
    items: [
      {
        icon: <Wallet className="h-4 w-4 text-emerald-500" />,
        title: 'Retail Reload: Two Input Modes',
        description:
          'Retail reload sales now support two modes — enter "Cash Received" to see the reload amount, or enter "Reload Amount" to see the cash to collect. Toggle between them in the popover.',
        tag: 'New',
      },
      {
        icon: <SplitSquareHorizontal className="h-4 w-4 text-blue-500" />,
        title: 'Split Payment Top-ups',
        description:
          'Wallet top-ups can now be split across up to 3 payment methods (Cash, Cheque, Transfer). All splits share a single reference number and create individual records for accurate tracking.',
        tag: 'New',
      },
      {
        icon: <ShieldCheck className="h-4 w-4 text-teal-500" />,
        title: 'Security Remediation (All Phases)',
        description:
          'CSRF origin validation, hardened rate limiting (3 attempts/min), IP spoofing fix, permission checks on all GET endpoints, atomic bank balance recalculation, CUID validation on bank lookups, wallet restricted to Owner/Accountant, month parameter validation, JWT re-verification reduced to 60s, HSTS header, stronger passwords (special character required), and critical audit logging for sensitive operations.',
        tag: 'Security',
      },
      {
        icon: <Lock className="h-4 w-4 text-amber-500" />,
        title: 'Password Requirements Shown',
        description:
          'User creation and password change forms now display the password requirements (min 8 chars, uppercase, lowercase, number, special character) inline.',
        tag: 'Improvement',
      },
      {
        icon: <Bug className="h-4 w-4 text-red-500" />,
        title: 'Screenshot Fetch Fix',
        description:
          'Fixed a crash on the Day Detail page when no daily entry or screenshot exists for the selected date.',
        tag: 'Fix',
      },
      {
        icon: <Users className="h-4 w-4 text-blue-500" />,
        title: 'User Management Fixes',
        description:
          'Fixed user reactivation showing a false error, empty email rejecting user creation, and add user form retaining old data after closing. Inactive users are now hidden by default with a toggle to show them.',
        tag: 'Fix',
      },
      {
        icon: <Calculator className="h-4 w-4 text-emerald-500" />,
        title: 'Auto Opening Cash from Previous Day',
        description:
          'When starting a new day, the opening cash is automatically filled from the previous day\'s actual closing balance. The value can still be manually adjusted.',
        tag: 'New',
      },
      {
        icon: <Pencil className="h-4 w-4 text-sky-500" />,
        title: 'Reopen Entry: Quick Reasons',
        description:
          'When reopening a submitted entry, predefined reasons are available as quick-select badges (e.g., "Incorrect sales amount", "Missing line items"). Custom reasons can still be typed.',
        tag: 'Improvement',
      },
      {
        icon: <Wallet className="h-4 w-4 text-emerald-500" />,
        title: 'Edit & Delete Wallet Top-ups',
        description:
          'Wallet top-ups can now be edited or deleted while the daily entry is still a draft. Single payments can be edited directly. Split payments are deleted as a group — all splits are removed together. A reason is required for deletions.',
        tag: 'New',
      },
      {
        icon: <Wallet className="h-4 w-4 text-blue-500" />,
        title: 'No Duplicate Methods in Splits',
        description:
          'Split payments now enforce unique payment methods — each method (Cash, Cheque, Transfer) can only be used once per split. Already-used methods are disabled.',
        tag: 'Improvement',
      },
      {
        icon: <Bug className="h-4 w-4 text-red-500" />,
        title: 'Screenshot Preview & Verification Fix',
        description:
          'Screenshot preview now auto-sizes to the image instead of a fixed width. Fixed a production error when loading screenshots and a false "failed to verify" error when saving verification.',
        tag: 'Fix',
      },
      {
        icon: <Database className="h-4 w-4 text-indigo-500" />,
        title: 'Daily Breakdown: Latest First',
        description:
          'The monthly report daily breakdown now shows the most recent date at the top, so the current day is always visible first.',
        tag: 'Improvement',
      },
      {
        icon: <Bug className="h-4 w-4 text-red-500" />,
        title: 'Screenshots Available Immediately',
        description:
          'Uploaded screenshots are now served through an API route instead of static files. Images appear immediately after upload without needing a server restart.',
        tag: 'Fix',
      },
      {
        icon: <ShieldCheck className="h-4 w-4 text-teal-500" />,
        title: 'Verified Screenshots Are Locked',
        description:
          'Once a screenshot is verified, it cannot be replaced, deleted, or unverified. The daily entry cannot be reopened either. Verification now requires a confirmation dialog and shows a "Verified" badge on the daily entry.',
        tag: 'Security',
      },
      {
        icon: <Bug className="h-4 w-4 text-red-500" />,
        title: 'Verification Save Fix',
        description:
          'Fixed the "Save Verification" button being clickable without agreeing to the verification checkbox. The button is now disabled until the checkbox is ticked, and uses an in-app confirmation dialog instead of a browser prompt for deletions.',
        tag: 'Fix',
      },
      {
        icon: <Lock className="h-4 w-4 text-amber-500" />,
        title: 'Enhanced Password Change',
        description:
          'Password change dialog now includes a strength meter, real-time requirements checklist, match/mismatch indicator, show/hide toggles, and blocks reusing the current password.',
        tag: 'Improvement',
      },
    ],
  },
  {
    version: 'v0.6',
    date: 'April 8, 2026',
    items: [
      {
        icon: <Calculator className="h-4 w-4 text-blue-500" />,
        title: 'Wallet Top-up Calculator',
        description:
          'When adding a wallet top-up, enter the amount paid to Dhiraagu and the system automatically calculates the reload value using the 8% dealer discount and 8% GST. Full breakdown shown before confirming.',
        tag: 'New',
      },
      {
        icon: <Wallet className="h-4 w-4 text-emerald-500" />,
        title: 'Retail Reload Calculator',
        description:
          'Retail reload sales now show the customer reload amount after stripping 8% GST from the cash received.',
        tag: 'New',
      },
      {
        icon: <Shield className="h-4 w-4 text-red-500" />,
        title: 'Future Date Blocked',
        description:
          'Calendar pickers and the server now reject future dates for daily entries and wallet top-ups.',
        tag: 'Fix',
      },
      {
        icon: <Store className="h-4 w-4 text-orange-500" />,
        title: 'Wholesale Shows Cash Received',
        description:
          'Wholesale sale items display cash received as the primary amount, with reload and discount shown separately.',
        tag: 'Improvement',
      },
      {
        icon: <Lock className="h-4 w-4 text-amber-500" />,
        title: 'Day Must Be Closed First',
        description:
          'The daily entry page stays on the previous day if its entry is still a draft. Staff must submit before moving on.',
        tag: 'Fix',
      },
      {
        icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
        title: 'Variance Submission Controls',
        description:
          'Wallet and cash variances over 500 MVR now block submission. Smaller variances show a warning. All submissions require confirmation.',
        tag: 'Security',
      },
      {
        icon: <Wrench className="h-4 w-4 text-orange-500" />,
        title: 'GST Centralized',
        description:
          'All GST and dealer discount rates are now defined in a single constants file. One-line change if government updates the rate.',
        tag: 'Improvement',
      },
      {
        icon: <CreditCard className="h-4 w-4 text-blue-500" />,
        title: 'Bank Deposit & Withdrawal Methods',
        description:
          'Bank transactions now require a method — Cash, Cheque, or Transfer — with contextual reference labels. Auto-created wallet top-up entries are protected from accidental deletion.',
        tag: 'New',
      },
      {
        icon: <Wrench className="h-4 w-4 text-indigo-500" />,
        title: 'Setup & UX Polish',
        description:
          'Setup wizard balance fields clear the leading zero on focus. Enter key advances through steps. Future dates blocked on all date pickers across the app.',
        tag: 'Improvement',
      },
      {
        icon: <Shield className="h-4 w-4 text-purple-500" />,
        title: 'System Date Boundaries',
        description:
          'All date pickers are now restricted between the system setup date and today. Users cannot navigate to dates before the system was set up. The Yesterday button is disabled when not applicable.',
        tag: 'Security',
      },
      {
        icon: <Wallet className="h-4 w-4 text-amber-500" />,
        title: 'Bank Balance Check on Top-up',
        description:
          'When topping up the wallet via Cheque or Transfer, the system warns if the amount exceeds the current bank balance.',
        tag: 'Improvement',
      },
      {
        icon: <ShieldCheck className="h-4 w-4 text-teal-500" />,
        title: 'Complete Audit Trail',
        description:
          'Every write operation is now logged — screenshots, imports, cash float, shift settings, discount tiers, and wholesale customer updates all have full audit trails.',
        tag: 'Security',
      },
      {
        icon: <CreditCard className="h-4 w-4 text-emerald-500" />,
        title: 'Auto Bank Deposit for Transfers',
        description:
          'Transfer sales now automatically create a bank deposit. Editing the amount updates the deposit, deleting the sale removes it. These auto-created entries are protected from manual deletion.',
        tag: 'New',
      },
      {
        icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
        title: 'Dashboard Alert Links Fixed',
        description:
          'Missing screenshot and unverified alerts now link to the correct date on the Day Detail page instead of the daily entry page.',
        tag: 'Fix',
      },
      {
        icon: <Bug className="h-4 w-4 text-red-500" />,
        title: 'Auto-Logout Redirect Fixed',
        description:
          'Fixed an issue where the idle timeout logout redirected to the wrong port. Session logout now correctly redirects to the login page.',
        tag: 'Fix',
      },
      {
        icon: <Database className="h-4 w-4 text-blue-500" />,
        title: 'Bank Ledger Fixes',
        description:
          'Transaction balance now uses server-calculated values instead of client-side recalculation. Latest transactions show at the top. Each entry shows the time it was added.',
        tag: 'Fix',
      },
      {
        icon: <Bug className="h-4 w-4 text-orange-500" />,
        title: 'Decimal Amount Fix',
        description:
          'Fixed a floating-point validation bug that rejected valid decimal amounts like 8919.13. All amount fields now accept any value up to 2 decimal places correctly.',
        tag: 'Fix',
      },
      {
        icon: <Database className="h-4 w-4 text-indigo-500" />,
        title: 'Consistent Currency Formatting',
        description:
          'Every financial value across the entire app — bank ledger, wallet, credit, sale items, cash float, reports, and all dialogs — now shows exactly 2 decimal places (e.g., 5,000.00 MVR).',
        tag: 'Improvement',
      },
      {
        icon: <Bug className="h-4 w-4 text-red-500" />,
        title: 'Credit Sales Now Visible in Grid',
        description:
          'Credit sales added to Dhiraagu Bills now correctly appear in the Sales by Category grid even before saving a draft.',
        tag: 'Fix',
      },
      {
        icon: <Bug className="h-4 w-4 text-red-500" />,
        title: 'Floating-Point Variance Fix',
        description:
          'Fixed a precision issue where balanced entries showed a tiny non-zero variance (e.g., -0.00) and triggered a false warning on submission. All variance calculations now round to 2 decimal places.',
        tag: 'Fix',
      },
    ],
  },
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
      {
        icon: <Store className="h-4 w-4 text-orange-500" />,
        title: 'Wholesale Tier Defaults',
        description:
          'Only the base 6% discount tier is enabled by default. The 6% minimum cash amount (500 MVR) is now locked and cannot be changed. Higher tiers can be enabled by the owner in settings.',
        tag: 'Improvement',
      },
      {
        icon: <Users className="h-4 w-4 text-blue-500" />,
        title: 'Live Editing Presence',
        description:
          'When multiple users have the same daily entry open, a banner shows who else is viewing. Presence updates every 10 seconds and clears automatically when users leave the page.',
        tag: 'New',
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
      <DialogContent className="sm:max-w-2xl max-h-[85vh] !grid-rows-[auto_1fr_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            What&apos;s New
          </DialogTitle>
          <DialogDescription>Latest updates and improvements</DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto -mx-6 px-6" style={{ maxHeight: 'calc(85vh - 14rem)' }}>
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
