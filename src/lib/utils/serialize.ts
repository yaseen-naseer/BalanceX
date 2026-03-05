/**
 * Utility to serialize Prisma Decimal values to regular JavaScript numbers
 * Prisma returns Decimal types that need to be converted before JSON serialization
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeDecimals(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj
  }

  // Handle Decimal instances (they have d and e properties)
  if (typeof obj === 'object' && obj !== null && 'd' in obj && 'e' in obj) {
    return Number(obj)
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(serializeDecimals)
  }

  // Handle objects
  if (typeof obj === 'object') {
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function convertPrismaDecimals(data: any): any {
  return serializeDecimals(data)
}
