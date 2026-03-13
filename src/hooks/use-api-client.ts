"use client"

import { useCallback, useMemo } from "react"

/**
 * Standard API response format used across the application
 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  /** Validation-specific fields */
  validation?: {
    canSubmit: boolean
    hasBlocks: boolean
    hasWarnings: boolean
    messages: Array<{ type: "block" | "warning"; message: string }>
  }
  requiresConfirmation?: boolean
  /** Calculation data returned with some responses */
  calculationData?: Record<string, unknown>
}

/**
 * Request options for API calls
 */
interface RequestOptions extends Omit<RequestInit, "body"> {
  /** Query parameters to append to URL */
  params?: Record<string, string | number | boolean | undefined>
}

/**
 * Hook providing a unified API client with consistent error handling.
 *
 * All methods return an ApiResponse<T> object with success flag.
 * This matches the API response format used by all backend routes.
 *
 * @example
 * ```tsx
 * const api = useApiClient()
 *
 * // GET request
 * const result = await api.get<User[]>("/api/users")
 * if (result.success) {
 *   console.log(result.data)
 * }
 *
 * // POST request
 * const created = await api.post<User>("/api/users", { name: "John" })
 *
 * // DELETE with query params
 * const deleted = await api.delete("/api/users", { params: { id: "123" } })
 * ```
 */
export function useApiClient() {
  /**
   * Build URL with query parameters
   */
  const buildUrl = useCallback(
    (url: string, params?: Record<string, string | number | boolean | undefined>) => {
      if (!params) return url

      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value))
        }
      })

      const queryString = searchParams.toString()
      if (!queryString) return url

      return url.includes("?")
        ? `${url}&${queryString}`
        : `${url}?${queryString}`
    },
    []
  )

  /**
   * Make an API request with standard error handling
   */
  const request = useCallback(
    async <T>(
      url: string,
      options?: RequestOptions & { body?: unknown }
    ): Promise<ApiResponse<T>> => {
      const { params, body, ...fetchOptions } = options || {}

      try {
        const finalUrl = buildUrl(url, params)

        const response = await fetch(finalUrl, {
          headers: {
            "Content-Type": "application/json",
            ...fetchOptions.headers,
          },
          ...fetchOptions,
          body: body ? JSON.stringify(body) : undefined,
        })

        const data = await response.json()

        // Return the API response as-is (it already has success, data, error)
        return data as ApiResponse<T>
      } catch (err) {
        // Network or parsing error
        return {
          success: false,
          error: err instanceof Error ? err.message : "Network error",
        }
      }
    },
    [buildUrl]
  )

  /**
   * GET request
   */
  const get = useCallback(
    <T>(url: string, options?: RequestOptions): Promise<ApiResponse<T>> =>
      request<T>(url, { ...options, method: "GET" }),
    [request]
  )

  /**
   * POST request
   */
  const post = useCallback(
    <T>(
      url: string,
      body?: unknown,
      options?: RequestOptions
    ): Promise<ApiResponse<T>> =>
      request<T>(url, { ...options, method: "POST", body }),
    [request]
  )

  /**
   * PUT request
   */
  const put = useCallback(
    <T>(
      url: string,
      body?: unknown,
      options?: RequestOptions
    ): Promise<ApiResponse<T>> =>
      request<T>(url, { ...options, method: "PUT", body }),
    [request]
  )

  /**
   * PATCH request
   */
  const patch = useCallback(
    <T>(
      url: string,
      body?: unknown,
      options?: RequestOptions
    ): Promise<ApiResponse<T>> =>
      request<T>(url, { ...options, method: "PATCH", body }),
    [request]
  )

  /**
   * DELETE request
   */
  const del = useCallback(
    <T>(url: string, options?: RequestOptions & { body?: unknown }): Promise<ApiResponse<T>> =>
      request<T>(url, { ...options, method: "DELETE" }),
    [request]
  )

  return useMemo(
    () => ({
      get,
      post,
      put,
      patch,
      delete: del,
      request,
    }),
    [get, post, put, patch, del, request]
  )
}

/**
 * Type helper for extracting data type from ApiResponse
 */
export type ExtractApiData<T> = T extends ApiResponse<infer U> ? U : never
