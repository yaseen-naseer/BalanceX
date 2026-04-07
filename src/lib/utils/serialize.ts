/**
 * Utility to serialize Prisma Decimal values to regular JavaScript numbers
 * Prisma returns Decimal types that need to be converted before JSON serialization
 */

function isDecimalLike(obj: unknown): obj is { d: unknown; e: unknown } {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "d" in obj &&
    "e" in obj
  )
}

export function serializeDecimals(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj
  }

  // Handle Decimal instances (they have d and e properties)
  if (isDecimalLike(obj)) {
    return Number(obj as never)
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(serializeDecimals)
  }

  // Handle objects
  if (typeof obj === "object") {
    // Handle Date objects
    if (obj instanceof Date) {
      return obj
    }

    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeDecimals(value)
    }
    return result
  }

  return obj
}

/**
 * Helper to convert all Decimal fields in an object to numbers
 * Use this before sending Prisma data in API responses
 */
export function convertPrismaDecimals<T>(data: T): T {
  return serializeDecimals(data) as T
}
