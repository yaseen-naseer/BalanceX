import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"
import bcrypt from "bcryptjs"
import { createUserSchema, validateRequestBody } from "@/lib/validations"
import { logError } from "@/lib/logger"
import { BCRYPT_ROUNDS } from "@/lib/constants"
import { createAuditLog, getClientIpFromRequest, getUserAgentFromRequest } from "@/lib/audit"
import { ApiErrors } from "@/lib/api-response"

// GET - List all users (Owner only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return ApiErrors.unauthorized()
    }

    if (session.user.role !== "OWNER") {
      return ApiErrors.forbidden("Only Owner can view all users")
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(users)
  } catch (error) {
    logError("Error fetching users", error)
    return ApiErrors.serverError("Failed to fetch users")
  }
}

// POST - Create new user (Owner only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return ApiErrors.unauthorized()
    }

    if (session.user.role !== "OWNER") {
      return ApiErrors.forbidden("Only Owner can create users")
    }

    // Validate request body
    const validation = await validateRequestBody(request, createUserSchema)
    if ("error" in validation) return validation.error
    const { username, name, email, password, role } = validation.data

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    })

    if (existingUser) {
      return ApiErrors.badRequest("Username already exists")
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

    const user = await prisma.user.create({
      data: {
        username,
        name,
        email: email || null,
        passwordHash,
        role,
      },
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

    await createAuditLog({
      action: "USER_CREATED",
      userId: session.user.id,
      targetId: user.id,
      details: { username, name, role },
      ipAddress: getClientIpFromRequest(request),
      userAgent: getUserAgentFromRequest(request),
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    logError("Error creating user", error)
    return ApiErrors.serverError("Failed to create user")
  }
}
