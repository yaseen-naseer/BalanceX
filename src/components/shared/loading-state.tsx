"use client"

import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

/**
 * Props for the LoadingState component
 */
export interface LoadingStateProps {
  /** Loading message to display */
  message?: string
  /** Whether to show in full-page centered mode */
  fullPage?: boolean
  /** Size variant */
  size?: "sm" | "default" | "lg"
  /** Additional CSS classes */
  className?: string
  /** Minimum height (useful for preventing layout shift) */
  minHeight?: string | number
}

/**
 * A consistent loading state component.
 *
 * @example
 * ```tsx
 * // Basic usage
 * if (isLoading) {
 *   return <LoadingState message="Loading data..." />
 * }
 *
 * // Full page loading
 * <LoadingState fullPage message="Initializing..." />
 *
 * // Small inline loader
 * <LoadingState size="sm" />
 * ```
 */
export function LoadingState({
  message = "Loading...",
  fullPage = false,
  size = "default",
  className,
  minHeight,
}: LoadingStateProps) {
  const sizeConfig = {
    sm: {
      spinner: "h-4 w-4",
      text: "text-xs",
      gap: "gap-2",
    },
    default: {
      spinner: "h-8 w-8",
      text: "text-sm",
      gap: "gap-3",
    },
    lg: {
      spinner: "h-12 w-12",
      text: "text-base",
      gap: "gap-4",
    },
  }

  const config = sizeConfig[size]

  const content = (
    <div
      className={cn(
        "flex flex-col items-center justify-center",
        config.gap,
        className
      )}
      style={{ minHeight }}
    >
      <Loader2
        className={cn("animate-spin text-muted-foreground", config.spinner)}
      />
      {message && (
        <p className={cn("text-muted-foreground", config.text)}>{message}</p>
      )}
    </div>
  )

  if (fullPage) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        {content}
      </div>
    )
  }

  return content
}

/**
 * Props for the LoadingOverlay component
 */
export interface LoadingOverlayProps {
  /** Whether the overlay is visible */
  isLoading: boolean
  /** Loading message */
  message?: string
  /** Whether to blur the background */
  blur?: boolean
  /** Additional CSS classes */
  className?: string
  /** Children to render behind the overlay */
  children: React.ReactNode
}

/**
 * A loading overlay that covers its children.
 *
 * @example
 * ```tsx
 * <LoadingOverlay isLoading={isSaving} message="Saving changes...">
 *   <Form>...</Form>
 * </LoadingOverlay>
 * ```
 */
export function LoadingOverlay({
  isLoading,
  message = "Loading...",
  blur = true,
  className,
  children,
}: LoadingOverlayProps) {
  return (
    <div className={cn("relative", className)}>
      {children}
      {isLoading && (
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-background/80 z-50",
            blur && "backdrop-blur-sm"
          )}
        >
          <LoadingState message={message} />
        </div>
      )}
    </div>
  )
}

/**
 * Props for the PageLoadingSkeleton component
 */
export interface PageLoadingSkeletonProps {
  /** Type of skeleton layout */
  type?: "default" | "cards" | "table" | "form"
  /** Number of skeleton items */
  count?: number
  /** Additional CSS classes */
  className?: string
}

/**
 * A page-level loading skeleton for different layouts.
 *
 * @example
 * ```tsx
 * // For a page with cards
 * if (isLoading) {
 *   return <PageLoadingSkeleton type="cards" count={4} />
 * }
 *
 * // For a page with a table
 * if (isLoading) {
 *   return <PageLoadingSkeleton type="table" />
 * }
 * ```
 */
export function PageLoadingSkeleton({
  type = "default",
  count = 4,
  className,
}: PageLoadingSkeletonProps) {
  if (type === "cards") {
    return (
      <div className={cn("grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4", className)}>
        {Array.from({ length: count }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (type === "table") {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="rounded-md border">
          <div className="p-4 space-y-3">
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-4 w-[150px]" />
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-[80px] ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (type === "form") {
    return (
      <div className={cn("space-y-6", className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
    )
  }

  // Default skeleton
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: count }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Props for InlineLoader component
 */
export interface InlineLoaderProps {
  /** Size of the loader */
  size?: "xs" | "sm" | "default"
  /** Additional CSS classes */
  className?: string
}

/**
 * A small inline loading indicator.
 *
 * @example
 * ```tsx
 * <Button disabled={isLoading}>
 *   {isLoading && <InlineLoader size="sm" />}
 *   Save
 * </Button>
 * ```
 */
export function InlineLoader({ size = "default", className }: InlineLoaderProps) {
  const sizeClasses = {
    xs: "h-3 w-3",
    sm: "h-4 w-4",
    default: "h-5 w-5",
  }

  return (
    <Loader2
      className={cn("animate-spin", sizeClasses[size], className)}
    />
  )
}
