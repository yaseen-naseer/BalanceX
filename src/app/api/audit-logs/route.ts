import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { requireRole } from "@/lib/api-auth"
import { paginatedResponse, ApiErrors } from "@/lib/api-response"
import { logError } from "@/lib/logger"
import { AuditAction } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole("OWNER")
    if (auth.error) return auth.error

    const { searchParams } = new URL(request.url)
    const actionParam = searchParams.get("action")
    const limitParam = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "25", 10) || 25))
    const offsetParam = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0)

    const where: { action?: AuditAction } = {}
    if (actionParam && Object.values(AuditAction).includes(actionParam as AuditAction)) {
      where.action = actionParam as AuditAction
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limitParam,
        skip: offsetParam,
      }),
      prisma.auditLog.count({ where }),
    ])

    const userIds = [...new Set(logs.map((l) => l.userId).filter((id): id is string => id !== null))]
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, username: true },
        })
      : []

    const userMap = new Map(users.map((u) => [u.id, u]))

    const rows = logs.map((log) => {
      const user = log.userId ? userMap.get(log.userId) : undefined
      return {
        ...log,
        userName: user?.name ?? null,
        userUsername: user?.username ?? null,
      }
    })

    return paginatedResponse(rows, { total, limit: limitParam, offset: offsetParam })
  } catch (error) {
    logError("Error fetching audit logs", error)
    return ApiErrors.serverError()
  }
}
