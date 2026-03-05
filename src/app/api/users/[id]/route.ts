import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"
import bcrypt from "bcryptjs"
import { updateUserSchema, validateRequestBody } from "@/lib/validations"
import { logError } from "@/lib/logger"
import { createAuditLog, getClientIpFromRequest, getUserAgentFromRequest } from "@/lib/audit"

// GET - Get single user (Owner only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Users can view their own profile, Owner can view all
    if (session.user.role !== "OWNER" && session.user.id !== id) {
      return NextResponse.json(
        { error: "Not authorized to view this user" },
        { status: 403 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    logError("Error fetching user", error)
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    )
  }
}

// PUT - Update user (Owner only, or own profile)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Validate request body
    const validation = await validateRequestBody(request, updateUserSchema)
    if ("error" in validation) return validation.error
    const { name, email, password, role, isActive } = validation.data

    // Only Owner can update other users or change roles
    const isUpdatingSelf = session.user.id === id
    if (!isUpdatingSelf && session.user.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only Owner can update other users" },
        { status: 403 }
      )
    }

    // Non-owners can only update name and email for themselves
    if (!isUpdatingSelf || session.user.role !== "OWNER") {
      if (role !== undefined || isActive !== undefined) {
        return NextResponse.json(
          { error: "Only Owner can change role or status" },
          { status: 403 }
        )
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email || null
    if (password) updateData.passwordHash = await bcrypt.hash(password, 10)
    if (role !== undefined && session.user.role === "OWNER") updateData.role = role
    if (isActive !== undefined && session.user.role === "OWNER") updateData.isActive = isActive

    // Fetch existing user for audit context
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { username: true, role: true, isActive: true },
    })

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    })

    if (role !== undefined && existingUser && role !== existingUser.role) {
      await createAuditLog({
        action: "ROLE_CHANGE",
        userId: session.user.id,
        targetId: id,
        details: { username: existingUser.username, from: existingUser.role, to: role },
        ipAddress: getClientIpFromRequest(request),
        userAgent: getUserAgentFromRequest(request),
      })
    }

    if (isActive === false && existingUser?.isActive) {
      await createAuditLog({
        action: "USER_DEACTIVATED",
        userId: session.user.id,
        targetId: id,
        details: { username: existingUser.username },
        ipAddress: getClientIpFromRequest(request),
        userAgent: getUserAgentFromRequest(request),
      })
    }

    return NextResponse.json(user)
  } catch (error) {
    logError("Error updating user", error)
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    )
  }
}

// DELETE - Delete/deactivate user (Owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only Owner can delete users" },
        { status: 403 }
      )
    }

    const { id } = await params

    // Prevent deleting yourself
    if (session.user.id === id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      )
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { username: true },
    })

    // Soft delete - just deactivate
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    })

    await createAuditLog({
      action: "USER_DEACTIVATED",
      userId: session.user.id,
      targetId: id,
      details: { username: targetUser?.username },
      ipAddress: getClientIpFromRequest(request),
      userAgent: getUserAgentFromRequest(request),
    })

    return NextResponse.json({ success: true, message: "User deactivated" })
  } catch (error) {
    logError("Error deleting user", error)
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    )
  }
}
