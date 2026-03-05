"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { ClipboardList, ChevronLeft, ChevronRight, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const LIMIT = 25

const ACTION_LABELS: Record<string, string> = {
  USER_LOGIN: "Login",
  USER_LOGOUT: "Logout",
  USER_LOCKED: "Account Locked",
  PASSWORD_CHANGE: "Password Changed",
  ROLE_CHANGE: "Role Changed",
  USER_CREATED: "User Created",
  USER_DEACTIVATED: "User Deactivated",
  CREDIT_LIMIT_OVERRIDE: "Credit Limit Override",
  CUSTOMER_CREATED: "Customer Created",
  CUSTOMER_DEACTIVATED: "Customer Deactivated",
  SETTINGS_CHANGED: "Settings Changed",
  DAILY_ENTRY_CREATED: "Entry Created",
  DAILY_ENTRY_SUBMITTED: "Entry Submitted",
  DAILY_ENTRY_REOPENED: "Entry Reopened",
  DAILY_ENTRY_AMENDED: "Entry Amended",
  CREDIT_SALE_ADDED: "Credit Sale",
  CREDIT_SALE_DELETED: "Credit Sale Deleted",
  SETTLEMENT_RECORDED: "Settlement",
  BANK_TRANSACTION_ADDED: "Bank Transaction",
  BANK_TRANSACTION_DELETED: "Bank Tx Deleted",
  WALLET_TOPUP_ADDED: "Wallet Top-up",
  WALLET_TOPUP_DELETED: "Top-up Deleted",
}

const ACTION_COLORS: Record<string, string> = {
  USER_LOGIN: "bg-blue-100 text-blue-700",
  USER_LOGOUT: "bg-blue-100 text-blue-700",
  USER_LOCKED: "bg-red-100 text-red-700",
  PASSWORD_CHANGE: "bg-orange-100 text-orange-700",
  ROLE_CHANGE: "bg-orange-100 text-orange-700",
  USER_CREATED: "bg-slate-100 text-slate-700",
  USER_DEACTIVATED: "bg-red-100 text-red-700",
  CREDIT_LIMIT_OVERRIDE: "bg-amber-100 text-amber-700",
  CUSTOMER_CREATED: "bg-slate-100 text-slate-700",
  CUSTOMER_DEACTIVATED: "bg-slate-100 text-slate-700",
  SETTINGS_CHANGED: "bg-slate-100 text-slate-700",
  DAILY_ENTRY_CREATED: "bg-sky-100 text-sky-700",
  DAILY_ENTRY_SUBMITTED: "bg-green-100 text-green-700",
  DAILY_ENTRY_REOPENED: "bg-amber-100 text-amber-700",
  DAILY_ENTRY_AMENDED: "bg-teal-100 text-teal-700",
  CREDIT_SALE_ADDED: "bg-violet-100 text-violet-700",
  CREDIT_SALE_DELETED: "bg-rose-100 text-rose-700",
  SETTLEMENT_RECORDED: "bg-emerald-100 text-emerald-700",
  BANK_TRANSACTION_ADDED: "bg-indigo-100 text-indigo-700",
  BANK_TRANSACTION_DELETED: "bg-rose-100 text-rose-700",
  WALLET_TOPUP_ADDED: "bg-cyan-100 text-cyan-700",
  WALLET_TOPUP_DELETED: "bg-rose-100 text-rose-700",
}

const ALL_ACTIONS = Object.keys(ACTION_LABELS)

interface AuditLogRow {
  id: string
  action: string
  userId: string | null
  userName: string | null
  details: unknown
  ipAddress: string | null
  createdAt: string
}

function renderDetails(details: unknown): string {
  if (!details || (typeof details === "object" && Object.keys(details as object).length === 0)) {
    return "—"
  }
  if (typeof details === "string") {
    return details.length > 60 ? details.slice(0, 60) + "…" : details
  }
  if (typeof details === "object") {
    return Object.entries(details as Record<string, unknown>)
      .map(([k, v]) => {
        const val = String(v)
        return `${k}: ${val.length > 60 ? val.slice(0, 60) + "…" : val}`
      })
      .join("\n")
  }
  return "—"
}

export function AuditLogSection() {
  const [logs, setLogs] = useState<AuditLogRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [actionFilter, setActionFilter] = useState("")
  const [page, setPage] = useState(0)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    const params = new URLSearchParams({
      limit: String(LIMIT),
      offset: String(page * LIMIT),
    })
    if (actionFilter) params.set("action", actionFilter)

    fetch(`/api/audit-logs?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data.success) {
          setLogs(data.data)
          setTotal(data.pagination.total)
        }
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [actionFilter, page])

  const handleFilterChange = (value: string) => {
    setActionFilter(value === "ALL" ? "" : value)
    setPage(0)
  }

  const totalPages = Math.ceil(total / LIMIT)
  const from = total === 0 ? 0 : page * LIMIT + 1
  const to = Math.min((page + 1) * LIMIT, total)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Audit Log
            </CardTitle>
            <CardDescription>Security and activity trail — Owner only</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={actionFilter || "ALL"} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Actions</SelectItem>
                {ALL_ACTIONS.map((action) => (
                  <SelectItem key={action} value={action}>
                    {ACTION_LABELS[action]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {actionFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleFilterChange("ALL")}
                title="Clear filter"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No audit events found</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Timestamp</TableHead>
                <TableHead className="w-40">Action</TableHead>
                <TableHead className="w-32">User</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="w-28">IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.createdAt), "dd MMM yyyy, HH:mm")}
                  </TableCell>
                  <TableCell>
                    <Badge className={ACTION_COLORS[log.action] ?? "bg-slate-100 text-slate-700"}>
                      {ACTION_LABELS[log.action] ?? log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{log.userName ?? "—"}</TableCell>
                  <TableCell>
                    <pre className="text-xs whitespace-pre-wrap font-sans">
                      {renderDetails(log.details)}
                    </pre>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {log.ipAddress ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!isLoading && total > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {from}–{to} of {total} results
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
