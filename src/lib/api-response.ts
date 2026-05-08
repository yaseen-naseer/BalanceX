import { NextResponse } from "next/server"

/**
 * Standardized API response helpers.
 * All API routes should use these for consistent response format.
 */

interface SuccessResponse<T> {
  success: true
  data: T
}

interface OkResponse {
  success: true
}

interface ErrorResponse {
  success: false
  error: string
}

interface PaginatedResponse<T> {
  success: true
  data: T[]
  pagination: {
    total: number
    limit: number
    offset: number
  }
}

/**
 * Create a success response with payload data.
 */
export function successResponse<T>(data: T, status = 200): NextResponse<SuccessResponse<T>> {
  return NextResponse.json({ success: true, data }, { status })
}

/**
 * Create a success response with no payload.
 * Use for DELETE confirmations, settings updates, and other "operation succeeded" responses.
 */
export function successOk(status = 200): NextResponse<OkResponse> {
  return NextResponse.json({ success: true }, { status })
}

/**
 * Create an error response
 */
export function errorResponse(
  error: string,
  status = 500
): NextResponse<ErrorResponse> {
  return NextResponse.json({ success: false, error }, { status })
}

/**
 * Create a paginated response
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: { total: number; limit: number; offset: number },
  status = 200
): NextResponse<PaginatedResponse<T>> {
  return NextResponse.json({ success: true, data, pagination }, { status })
}

/**
 * Common error responses
 */
export const ApiErrors = {
  unauthorized: () => errorResponse("Unauthorized", 401),
  forbidden: (message = "Access denied") => errorResponse(message, 403),
  notFound: (resource = "Resource") => errorResponse(`${resource} not found`, 404),
  badRequest: (message: string) => errorResponse(message, 400),
  conflict: (message: string) => errorResponse(message, 409),
  serverError: (message = "Internal server error") => errorResponse(message, 500),
  sessionExpired: () => errorResponse("Session expired. Please logout and login again.", 401),
} as const
