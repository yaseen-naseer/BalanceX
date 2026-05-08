import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

// NextAuth session-token cookie names (dev vs prod). Defined once so the
// invalidation cleanup below clears both consistently.
const SESSION_COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
] as const

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Issue #4: Reduced auth limit from 5 to 3 for financial app
const AUTH_LIMIT = 3
const AUTH_WINDOW = 60 * 1000
const API_LIMIT = 100
const API_WINDOW = 60 * 1000
// Setup is a one-time bootstrap; abuse is unlikely but cheap to harden (S6).
const SETUP_LIMIT = 5
const SETUP_WINDOW = 15 * 60 * 1000

// Issue #3: Prefer Cloudflare's trusted header over spoofable x-forwarded-for
function getClientIp(request: NextRequest): string {
  // cf-connecting-ip is set by Cloudflare Tunnel — cannot be spoofed by the client
  const cfIp = request.headers.get("cf-connecting-ip")
  if (cfIp) return cfIp
  // Fallback for local development
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0].trim()
  const realIp = request.headers.get("x-real-ip")
  if (realIp) return realIp
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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = getClientIp(request)

  // Allow public paths without authentication
  const publicPaths = ["/login", "/api/auth", "/setup", "/api/setup"]
  const isPublicPath = publicPaths.some(
    (path) => pathname === path || pathname.startsWith(path)
  )

  // Issue #2: CSRF — reject cross-origin state-changing requests
  const mutatingMethods = ["POST", "PUT", "PATCH", "DELETE"]
  if (mutatingMethods.includes(request.method) && pathname.startsWith("/api") && !pathname.startsWith("/api/auth")) {
    const origin = request.headers.get("origin")
    const host = request.headers.get("host")
    if (origin && host && !origin.includes(host)) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: "Cross-origin request rejected" },
          { status: 403 }
        )
      )
    }
  }

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

  // Stricter limit for /api/setup POST (bootstrap endpoint; should rarely be called).
  // Falls through to the generic API limit afterwards.
  if (pathname === "/api/setup" && request.method === "POST") {
    const key = `setup:${ip}`
    const result = checkRateLimit(key, SETUP_LIMIT, SETUP_WINDOW)
    if (!result.success) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000)
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: "Too many setup attempts. Please try again later." },
          {
            status: 429,
            headers: {
              "Retry-After": String(retryAfter),
              "X-RateLimit-Limit": String(SETUP_LIMIT),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": String(result.resetAt),
            },
          }
        )
      )
    }
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

  // Check auth for protected routes. Two layers:
  //   (1) No cookie → redirect to /login (existing behaviour).
  //   (2) Cookie present but JWT decodes as `invalidated` (set by the jwt callback
  //       when the user was deactivated/deleted server-side) → redirect AND
  //       actively clear the cookie. Closes S16 — without this, the cookie
  //       persists in the browser until manual signOut or 8-hour maxAge expiry.
  if (!isPublicPath) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

    if (!token || token.invalidated) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("callbackUrl", pathname)
      const response = NextResponse.redirect(loginUrl)
      // Clear both cookie names so dev and prod cookies are both wiped.
      for (const name of SESSION_COOKIE_NAMES) {
        response.cookies.delete(name)
      }
      return addSecurityHeaders(response)
    }
  }

  return addSecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|uploads|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
