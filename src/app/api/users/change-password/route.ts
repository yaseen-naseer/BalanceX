import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"
import bcrypt from "bcryptjs"
import { changePasswordSchema, validateRequestBody } from "@/lib/validations"
import { logError } from "@/lib/logger"
import { createAuditLog, getClientIpFromRequest, getUserAgentFromRequest } from "@/lib/audit"

// POST - Change current user's password
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      )
    }

    // Hash and update new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10)
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
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logError("Error changing password", error)
    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 }
    )
  }
}
