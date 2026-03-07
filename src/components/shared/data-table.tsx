"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Column definition for the DataTable
 */
export interface Column<T> {
  /** Unique key for the column (can be a property key or custom string) */
  key: string
  /** Column header text */
  header: string
  /** Custom render function for cell content */
  render?: (item: T, index: number) => React.ReactNode
  /** Additional CSS classes for the column */
  className?: string
  /** Header CSS classes */
  headerClassName?: string
  /** Whether this column is sortable */
  sortable?: boolean
  /** Custom sort function */
  sortFn?: (a: T, b: T) => number
  /** Text alignment */
  align?: "left" | "center" | "right"
  /** Column width */
  width?: string | number
}

/**
 * Sort direction type
 */
type SortDirection = "asc" | "desc" | null

/**
 * Sort state
 */
interface SortState {
  key: string | null
  direction: SortDirection
}

/**
 * Props for the DataTable component
 */
export interface DataTableProps<T> {
  /** Array of data items to display */
  data: T[]
  /** Column definitions */
  columns: Column<T>[]
  /** Whether data is loading */
  isLoading?: boolean
  /** Message to show when no data */
  emptyMessage?: string
  /** Callback when a row is clicked */
  onRowClick?: (item: T, index: number) => void
  /** Custom row key extractor (defaults to item.id) */
  getRowKey?: (item: T, index: number) => string
  /** Enable pagination */
  pagination?: boolean
  /** Items per page (default: 10) */
  pageSize?: number
  /** Enable client-side search */
  searchable?: boolean
  /** Search placeholder text */
  searchPlaceholder?: string
  /** Custom search filter function */
  searchFilter?: (item: T, query: string) => boolean
  /** Enable striped rows */
  striped?: boolean
  /** Enable hover effect on rows */
  hoverable?: boolean
  /** Compact/dense mode */
  compact?: boolean
  /** Additional table wrapper classes */
  className?: string
  /** Sticky header */
  stickyHeader?: boolean
  /** Maximum height for scrollable table */
  maxHeight?: string | number
  /** Number of skeleton rows to show when loading */
  skeletonRows?: number
}

/**
 * A flexible, reusable data table component.
 *
 * Features:
 * - Column definitions with custom rendering
 * - Sorting (client-side)
 * - Pagination
 * - Search filtering
 * - Loading states
 * - Empty states
 * - Row click handling
 *
 * @example
 * ```tsx
 * // Basic usage
 * <DataTable
 *   data={users}
 *   columns={[
 *     { key: "name", header: "Name" },
 *     { key: "email", header: "Email" },
 *     {
 *       key: "role",
 *       header: "Role",
 *       render: (user) => <Badge>{user.role}</Badge>
 *     }
 *   ]}
 * />
 *
 * // With pagination and search
 * <DataTable
 *   data={transactions}
 *   columns={columns}
 *   pagination
 *   pageSize={20}
 *   searchable
 *   searchFilter={(item, query) =>
 *     item.reference.toLowerCase().includes(query.toLowerCase())
 *   }
 * />
 *
 * // With sorting
 * <DataTable
 *   data={customers}
 *   columns={[
 *     { key: "name", header: "Name", sortable: true },
 *     {
 *       key: "balance",
 *       header: "Balance",
 *       sortable: true,
 *       sortFn: (a, b) => a.balance - b.balance,
 *       render: (c) => formatCurrency(c.balance)
 *     }
 *   ]}
 * />
 * ```
 */
export function DataTable<T>({
  data,
  columns,
  isLoading = false,
  emptyMessage = "No data found",
  onRowClick,
  getRowKey,
  pagination = false,
  pageSize = 10,
  searchable = false,
  searchPlaceholder = "Search...",
  searchFilter,
  striped = false,
  hoverable = true,
  compact = false,
  className,
  stickyHeader = false,
  maxHeight,
  skeletonRows = 5,
}: DataTableProps<T>) {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)

  // Search state
  const [searchQuery, setSearchQuery] = useState("")

  // Sort state
  const [sortState, setSortState] = useState<SortState>({
    key: null,
    direction: null,
  })

  // Default row key extractor
  const defaultGetRowKey = useCallback(
    (item: T, index: number) => {
      if (typeof item === "object" && item !== null && "id" in item) {
        return String((item as Record<string, unknown>).id)
      }
      return String(index)
    },
    []
  )

  const rowKeyFn = getRowKey || defaultGetRowKey

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!searchable || !searchQuery.trim()) {
      return data
    }

    if (searchFilter) {
      return data.filter((item) => searchFilter(item, searchQuery))
    }

    // Default search: check all string values
    const query = searchQuery.toLowerCase()
    return data.filter((item) => {
      if (typeof item !== "object" || item === null) return false
      return Object.values(item).some(
        (value) =>
          typeof value === "string" &&
          value.toLowerCase().includes(query)
      )
    })
  }, [data, searchable, searchQuery, searchFilter])

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortState.key || !sortState.direction) {
      return filteredData
    }

    const column = columns.find((c) => c.key === sortState.key)
    if (!column) return filteredData

    return [...filteredData].sort((a, b) => {
      let result: number

      if (column.sortFn) {
        result = column.sortFn(a, b)
      } else {
        // Default sort: compare values at key
        const aVal = (a as Record<string, unknown>)[sortState.key!]
        const bVal = (b as Record<string, unknown>)[sortState.key!]

        if (typeof aVal === "number" && typeof bVal === "number") {
          result = aVal - bVal
        } else {
          result = String(aVal ?? "").localeCompare(String(bVal ?? ""))
        }
      }

      return sortState.direction === "desc" ? -result : result
    })
  }, [filteredData, sortState, columns])

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData

    const start = (currentPage - 1) * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [sortedData, pagination, currentPage, pageSize])

  // Total pages
  const totalPages = useMemo(() => {
    if (!pagination) return 1
    return Math.ceil(sortedData.length / pageSize)
  }, [sortedData.length, pagination, pageSize])

  // Reset to first page when data or search changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1)
  }, [searchQuery, data])

  // Handle sort click
  const handleSort = useCallback((key: string) => {
    setSortState((prev) => {
      if (prev.key !== key) {
        return { key, direction: "asc" }
      }
      if (prev.direction === "asc") {
        return { key, direction: "desc" }
      }
      return { key: null, direction: null }
    })
  }, [])

  // Render sort indicator
  const renderSortIndicator = (column: Column<T>) => {
    if (!column.sortable) return null

    if (sortState.key !== column.key) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
    }

    return sortState.direction === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        {searchable && (
          <Skeleton className="h-10 w-64" />
        )}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={col.headerClassName}
                    style={{ width: col.width }}
                  >
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: skeletonRows }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      <Skeleton className={cn("h-4", compact ? "w-16" : "w-24")} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  // Empty state
  if (paginatedData.length === 0) {
    return (
      <div className={cn("space-y-4", className)}>
        {searchable && (
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        )}
        <div className="rounded-md border">
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm">{emptyMessage}</p>
            {searchQuery && (
              <Button
                variant="link"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="mt-2"
              >
                Clear search
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Alignment classes
  const alignClasses = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search */}
      {searchable && (
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Table */}
      <div
        className={cn(
          "rounded-md border",
          stickyHeader && "overflow-auto"
        )}
        style={{ maxHeight: maxHeight }}
      >
        <Table>
          <TableHeader className={stickyHeader ? "sticky top-0 bg-background z-10" : ""}>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    col.headerClassName,
                    col.sortable && "cursor-pointer select-none",
                    col.align && alignClasses[col.align]
                  )}
                  style={{ width: col.width }}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="flex items-center">
                    {col.header}
                    {renderSortIndicator(col)}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((item, index) => (
              <TableRow
                key={rowKeyFn(item, index)}
                onClick={onRowClick ? () => onRowClick(item, index) : undefined}
                className={cn(
                  onRowClick && "cursor-pointer",
                  hoverable && "hover:bg-muted/50",
                  striped && index % 2 === 1 && "bg-muted/25"
                )}
              >
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={cn(
                      col.className,
                      col.align && alignClasses[col.align],
                      compact && "py-2"
                    )}
                  >
                    {col.render
                      ? col.render(item, index)
                      : String(
                          (item as Record<string, unknown>)[col.key] ?? ""
                        )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1} to{" "}
            {Math.min(currentPage * pageSize, sortedData.length)} of{" "}
            {sortedData.length} results
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => p - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
