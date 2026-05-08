import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"
import bcrypt from "bcryptjs"
import { changePasswordSchema, validateRequestBody } from "@/lib/validations"
import { logError } from "@/lib/logger"
import { BCRYPT_ROUNDS } from "@/lib/constants"
import { createAuditLog, getClientIpFromRequest, getUserAgentFromRequest } from "@/lib/audit"
import { ApiErrors, successOk } from "@/lib/api-response"

// POST - Change current user's password
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return ApiErrors.unauthorized()
    }

    // Validate request body
    const validation = await validateRequestBody(request, changePasswordSchema)
    if ("error" in validation) return validation.error
    const { currentPassword, newPassword } = validation.data

    // Get user with password hash
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, passwordHash: true },
    })

    if (!user) {
      return ApiErrors.notFound("User")
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!isValidPassword) {
      return ApiErrors.badRequest("Current password is incorrect")
    }

    // Block same old/new password
    if (currentPassword === newPassword) {
      return ApiErrors.badRequest("New password must be different from current password")
    }

    // Hash and update new password
    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
    await prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash: newPasswordHash },
    })

    await createAuditLog({
      action: "PASSWORD_CHANGE",
      userId: session.user.id,
      targetId: session.user.id,
      ipAddress: getClientIpFromRequest(request),
      userAgent: getUserAgentFromRequest(request),
    }, { critical: true })

    return successOk()
  } catch (error) {
    logError("Error changing password", error)
    return ApiErrors.serverError("Failed to change password")
  }
}
