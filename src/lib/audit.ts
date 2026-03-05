import { prisma } from "@/lib/db"
import { AuditAction } from "@prisma/client"

interface AuditLogData {
  action: AuditAction
  userId?: string | null
  targetId?: string | null
  details?: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
}

/**
 * Create an audit log entry for sensitive actions.
 * This provides a security audit trail for compliance and investigation.
 */
export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: data.action,
        userId: data.userId || null,
        targetId: data.targetId || null,
        details: data.details ? JSON.stringify(data.details) : null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
      },
    })
  } catch (error) {
    // Log error but don't fail the main operation
    console.error("Failed to create audit log:", error)
  }
}

/**
 * Extract client IP from request headers
 */
export function getClientIpFromRequest(request: Request): string | null {
  const headers = request.headers

  // Try x-forwarded-for header (most common in reverse proxy setups)
  const forwardedFor = headers.get("x-forwarded-for")
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim()
  }

  // Try x-real-ip header
  const realIp = headers.get("x-real-ip")
  if (realIp) {
    return realIp
  }

  // Try cf-connecting-ip (Cloudflare)
  const cfIp = headers.get("cf-connecting-ip")
  if (cfIp) {
    return cfIp
  }

  return null
}

/**
 * Get user agent from request
 */
export function getUserAgentFromRequest(request: Request): string | null {
  return request.headers.get("user-agent")
}
