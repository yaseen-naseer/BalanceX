import { NextResponse } from "next/server"
import { z } from "zod"
import { ApiErrors } from "@/lib/api-response"
import { dateParamSchema } from "./schemas"

/**
 * Validates request body against a Zod schema
 * Returns parsed data or NextResponse error
 */
export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ data: T } | { error: NextResponse }> {
  try {
    const body = await request.json()
    const result = schema.safeParse(body)

    if (!result.success) {
      const errorMessage = result.error.issues
        .map((e: z.ZodIssue) => {
          const path = e.path.length > 0 ? `${e.path.join(".")}: ` : ""
          return `${path}${e.message}`
        })
        .join("; ")

      return {
        error: NextResponse.json(
          { success: false, error: `Validation failed: ${errorMessage}` },
          { status: 400 }
        ),
      }
    }

    return { data: result.data }
  } catch {
    return {
      error: NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      ),
    }
  }
}

/**
 * Validates query parameters against a Zod schema
 */
export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): { data: T } | { error: NextResponse } {
  const params: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    params[key] = value
  })

  const result = schema.safeParse(params)

  if (!result.success) {
    const errorMessage = result.error.issues
      .map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`)
      .join("; ")

    return {
      error: NextResponse.json(
        { success: false, error: `Invalid query parameters: ${errorMessage}` },
        { status: 400 }
      ),
    }
  }

  return { data: result.data }
}

/**
 * Validate a YYYY-MM-DD date string from a route or query param.
 * Returns a Date pinned to UTC midnight, or an error response.
 *
 * Stricter than `new Date(dateStr)`: rejects malformed strings (e.g. "garbage",
 * "2026-13-01", "") that would otherwise become `Invalid Date` and crash Prisma.
 */
export function validateDate(
  dateStr: string | null,
  fieldName = "date"
): { date: Date } | { error: NextResponse } {
  const result = dateParamSchema.safeParse(dateStr)
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? `Invalid ${fieldName} format`
    return { error: ApiErrors.badRequest(message) }
  }
  const date = new Date(result.data)
  date.setUTCHours(0, 0, 0, 0)
  return { date }
}

/**
 * Validates a CUID string
 */
export function validateId(
  id: string | null,
  fieldName = "ID"
): { id: string } | { error: NextResponse } {
  if (!id) {
    return {
      error: NextResponse.json(
        { success: false, error: `${fieldName} is required` },
        { status: 400 }
      ),
    }
  }

  // Basic CUID validation (starts with 'c', 25 chars)
  const cuidRegex = /^c[a-z0-9]{24}$/
  if (!cuidRegex.test(id)) {
    return {
      error: NextResponse.json(
        { success: false, error: `Invalid ${fieldName} format` },
        { status: 400 }
      ),
    }
  }

  return { id }
}
