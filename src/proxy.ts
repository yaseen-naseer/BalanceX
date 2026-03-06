import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

const AUTH_LIMIT = 5
const AUTH_WINDOW = 60 * 1000
const API_LIMIT = 100
const API_WINDOW = 60 * 1000

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0].trim()
  const realIp = request.headers.get("x-real-ip")
  if (realIp) return realIp
  const cfIp = request.headers.get("cf-connecting-ip")
  if (cfIp) return cfIp
  return "unknown"
}

function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: limit - 1, resetAt: now + windowMs }
  }

  entry.count += 1
  if (entry.count > limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt }
  }

  return { success: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}

const securityHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value)
  }
  return response
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = getClientIp(request)

  // Allow public paths without authentication
  const publicPaths = ["/login", "/api/auth", "/setup", "/api/setup"]
  const isPublicPath = publicPaths.some(
    (path) => pathname === path || pathname.startsWith(path)
  )

  // Rate limit only the sign-in endpoint (brute force protection)
  // Session checks, CSRF, and signout are not rate limited
  if (pathname === "/api/auth/callback/credentials") {
    const key = `auth:${ip}`
    const result = checkRateLimit(key, AUTH_LIMIT, AUTH_WINDOW)

    if (!result.success) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000)
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: "Too many login attempts. Please try again later." },
          {
            status: 429,
            headers: {
              "Retry-After": String(retryAfter),
              "X-RateLimit-Limit": String(AUTH_LIMIT),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": String(result.resetAt),
            },
          }
        )
      )
    }

    const response = NextResponse.next()
    response.headers.set("X-RateLimit-Limit", String(AUTH_LIMIT))
    response.headers.set("X-RateLimit-Remaining", String(result.remaining))
    response.headers.set("X-RateLimit-Reset", String(result.resetAt))
    return addSecurityHeaders(response)
  }

  // Rate limit other API routes
  if (pathname.startsWith("/api")) {
    const key = `api:${ip}`
    const result = checkRateLimit(key, API_LIMIT, API_WINDOW)

    if (!result.success) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000)
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: "Too many requests. Please try again later." },
          {
            status: 429,
            headers: {
              "Retry-After": String(retryAfter),
              "X-RateLimit-Limit": String(API_LIMIT),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": String(result.resetAt),
            },
          }
        )
      )
    }

    const response = NextResponse.next()
    response.headers.set("X-RateLimit-Limit", String(API_LIMIT))
    response.headers.set("X-RateLimit-Remaining", String(result.remaining))
    response.headers.set("X-RateLimit-Reset", String(result.resetAt))
    return addSecurityHeaders(response)
  }

  // Check auth for protected routes
  if (!isPublicPath) {
    const sessionToken =
      request.cookies.get("next-auth.session-token") ||
      request.cookies.get("__Secure-next-auth.session-token")

    if (!sessionToken) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("callbackUrl", pathname)
      return addSecurityHeaders(NextResponse.redirect(loginUrl))
    }
  }

  return addSecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|uploads|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
