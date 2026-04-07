import { NextResponse } from "next/server"

/**
 * In-memory rate limiter — suitable for single-server deployments.
 *
 * Current implementation:
 *   - Uses an in-memory Map<string, RateLimitEntry> to track request counts.
 *   - Expired entries are cleaned up every 5 minutes.
 *   - State resets on server restart and is NOT shared across instances.
 *
 * Limitations:
 *   - Does not work across multiple server instances, containers, or serverless
 *     function invocations because each process has its own Map.
 *   - Unbounded growth between cleanup cycles if hit by many unique IPs.
 *
 * Production migration path:
 *   1. Replace the in-memory Map with a Redis-backed store.
 *   2. Recommended packages: @upstash/ratelimit (serverless-friendly) or
 *      ioredis + a sliding-window algorithm for traditional deployments.
 *   3. Keep the same RateLimitConfig / RateLimitResult interfaces so callers
 *      (middleware, API routes) require zero changes.
 *
 * // TODO(production): Replace with Redis-backed rate limiter for multi-instance deployments
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory store for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanupExpiredEntries() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
  lastCleanup = now
}

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number
  /** Time window in milliseconds */
  windowMs: number
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

/**
 * Check if a request should be rate limited
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupExpiredEntries()

  const now = Date.now()
  const key = identifier
  const entry = rateLimitStore.get(key)

  if (!entry || entry.resetAt < now) {
    // First request or window expired - start fresh
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    }
    rateLimitStore.set(key, newEntry)
    return {
      success: true,
      remaining: config.limit - 1,
      resetAt: newEntry.resetAt,
    }
  }

  // Increment counter
  entry.count += 1

  if (entry.count > config.limit) {
    // Rate limit exceeded
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
    }
  }

  return {
    success: true,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
  }
}

/**
 * Get client IP address from request
 */
export function getClientIp(request: Request): string {
  // Check standard headers first
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    // x-forwarded-for can be a comma-separated list, take the first one
    return forwardedFor.split(",")[0].trim()
  }

  const realIp = request.headers.get("x-real-ip")
  if (realIp) {
    return realIp
  }

  // Fallback to a default identifier
  return "unknown"
}

// Pre-configured rate limiters

/** Strict rate limit for authentication endpoints (5 requests per minute) */
export const authRateLimit: RateLimitConfig = {
  limit: 5,
  windowMs: 60 * 1000, // 1 minute
}

/** Standard rate limit for API endpoints (100 requests per minute) */
export const apiRateLimit: RateLimitConfig = {
  limit: 100,
  windowMs: 60 * 1000, // 1 minute
}

/** Relaxed rate limit for read operations (200 requests per minute) */
export const readRateLimit: RateLimitConfig = {
  limit: 200,
  windowMs: 60 * 1000, // 1 minute
}

/**
 * Rate limiting middleware response
 */
export function rateLimitExceeded(resetAt: number): NextResponse {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
  return NextResponse.json(
    {
      success: false,
      error: "Too many requests. Please try again later.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Reset": String(resetAt),
      },
    }
  )
}

/**
 * Apply rate limiting to a request
 * Returns NextResponse error if rate limited, null if allowed
 */
export function applyRateLimit(
  request: Request,
  config: RateLimitConfig,
  identifierPrefix = ""
): NextResponse | null {
  const ip = getClientIp(request)
  const identifier = identifierPrefix ? `${identifierPrefix}:${ip}` : ip
  const result = checkRateLimit(identifier, config)

  if (!result.success) {
    return rateLimitExceeded(result.resetAt)
  }

  return null
}
