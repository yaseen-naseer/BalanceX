/**
 * Sanitized logging utility to prevent sensitive data leakage.
 * Automatically redacts known sensitive field patterns from error messages.
 */

// Patterns that indicate sensitive data
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /apikey/i,
  /api_key/i,
  /authorization/i,
  /bearer/i,
  /credential/i,
  /passwordhash/i,
  /currentpassword/i,
  /newpassword/i,
]

// Redaction placeholder
const REDACTED = "[REDACTED]"

/**
 * Sanitize an object by redacting sensitive fields
 */
function sanitizeObject(obj: unknown, depth = 0): unknown {
  // Prevent infinite recursion
  if (depth > 10) return "[MAX_DEPTH]"

  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj === "string") {
    // Check if the string looks like it contains sensitive data
    // (e.g., base64 encoded tokens, long random strings)
    if (obj.length > 100 && /^[A-Za-z0-9+/=]+$/.test(obj)) {
      return REDACTED
    }
    return obj
  }

  if (typeof obj === "number" || typeof obj === "boolean") {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, depth + 1))
  }

  if (typeof obj === "object") {
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      // Check if key matches sensitive patterns
      if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(key))) {
        sanitized[key] = REDACTED
      } else {
        sanitized[key] = sanitizeObject(value, depth + 1)
      }
    }
    return sanitized
  }

  return obj
}

/**
 * Sanitize an error object for safe logging
 */
function sanitizeError(error: unknown): unknown {
  if (error instanceof Error) {
    const sanitized: Record<string, unknown> = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }

    // Check for additional properties on the error
    for (const key of Object.keys(error)) {
      if (!["name", "message", "stack"].includes(key)) {
        const value = (error as unknown as Record<string, unknown>)[key]
        if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(key))) {
          sanitized[key] = REDACTED
        } else {
          sanitized[key] = sanitizeObject(value)
        }
      }
    }

    return sanitized
  }

  return sanitizeObject(error)
}

/**
 * Log an error with sensitive data sanitization
 */
export function logError(context: string, error: unknown): void {
  const sanitized = sanitizeError(error)
  console.error(`${context}:`, sanitized)
}

/**
 * Log a warning with sensitive data sanitization
 */
export function logWarn(context: string, data?: unknown): void {
  if (data !== undefined) {
    const sanitized = sanitizeObject(data)
    console.warn(`${context}:`, sanitized)
  } else {
    console.warn(context)
  }
}

/**
 * Log info with sensitive data sanitization (for development)
 */
export function logInfo(context: string, data?: unknown): void {
  if (process.env.NODE_ENV === "development") {
    if (data !== undefined) {
      const sanitized = sanitizeObject(data)
      console.log(`${context}:`, sanitized)
    } else {
      console.log(context)
    }
  }
}
