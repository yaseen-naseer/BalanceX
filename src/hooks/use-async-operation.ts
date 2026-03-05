"use client"

import { useState, useCallback, useMemo } from "react"

/**
 * Options for executing an async operation
 */
interface ExecuteOptions<T> {
  /** Callback when operation succeeds */
  onSuccess?: (data: T) => void
  /** Callback when operation fails */
  onError?: (error: string) => void
}

/**
 * Return type for useAsyncOperation hook
 */
interface UseAsyncOperationReturn<T> {
  /** Whether an operation is currently in progress */
  isLoading: boolean
  /** Error message if the last operation failed */
  error: string | null
  /** Data from the last successful operation */
  data: T | null
  /** Execute an async operation with automatic loading/error handling */
  execute: (
    operation: () => Promise<T>,
    options?: ExecuteOptions<T>
  ) => Promise<T | null>
  /** Reset all state to initial values */
  reset: () => void
  /** Clear just the error state */
  clearError: () => void
  /** Manually set the data */
  setData: (data: T | null) => void
}

/**
 * Hook for handling async operations with loading and error states.
 *
 * Eliminates the common boilerplate pattern:
 * ```
 * setIsLoading(true)
 * setError(null)
 * try {
 *   // operation
 * } catch (err) {
 *   setError("message")
 * } finally {
 *   setIsLoading(false)
 * }
 * ```
 *
 * @example
 * ```tsx
 * const { isLoading, error, data, execute } = useAsyncOperation<User[]>()
 *
 * const fetchUsers = async () => {
 *   await execute(
 *     () => api.getUsers(),
 *     { onSuccess: (users) => console.log("Fetched", users.length) }
 *   )
 * }
 * ```
 */
export function useAsyncOperation<T>(): UseAsyncOperationReturn<T> {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<T | null>(null)

  const execute = useCallback(
    async (
      operation: () => Promise<T>,
      options?: ExecuteOptions<T>
    ): Promise<T | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await operation()
        setData(result)
        options?.onSuccess?.(result)
        return result
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An error occurred"
        setError(message)
        options?.onError?.(message)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const reset = useCallback(() => {
    setIsLoading(false)
    setError(null)
    setData(null)
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return useMemo(
    () => ({
      isLoading,
      error,
      data,
      execute,
      reset,
      clearError,
      setData,
    }),
    [isLoading, error, data, execute, reset, clearError, setData]
  )
}
