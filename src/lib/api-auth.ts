import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { hasPermission, type Permission } from "@/lib/permissions"
import type { UserRole } from "@prisma/client"

export interface AuthenticatedUser {
  id: string
  username: string
  name: string
  email?: string | null
  role: UserRole
}

export interface AuthResult {
  authenticated: boolean
  user: AuthenticatedUser | null
  error?: NextResponse
}

// Get authenticated user from session
export async function getAuthenticatedUser(): Promise<AuthResult> {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return {
      authenticated: false,
      user: null,
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    }
  }

  return {
    authenticated: true,
    user: session.user as AuthenticatedUser,
  }
}

// Check if user has required permission
export async function requirePermission(permission: Permission): Promise<AuthResult> {
  const authResult = await getAuthenticatedUser()

  if (!authResult.authenticated || !authResult.user) {
    return authResult
  }

  if (!hasPermission(authResult.user.role, permission)) {
    return {
      authenticated: true,
      user: authResult.user,
      error: NextResponse.json(
        { error: "Forbidden", message: "You don't have permission to perform this action" },
        { status: 403 }
      ),
    }
  }

  return authResult
}

// Check if user has any of the required permissions
export async function requireAnyPermission(permissions: Permission[]): Promise<AuthResult> {
  const authResult = await getAuthenticatedUser()

  if (!authResult.authenticated || !authResult.user) {
    return authResult
  }

  const hasAny = permissions.some((permission) =>
    hasPermission(authResult.user!.role, permission)
  )

  if (!hasAny) {
    return {
      authenticated: true,
      user: authResult.user,
      error: NextResponse.json(
        { error: "Forbidden", message: "You don't have permission to perform this action" },
        { status: 403 }
      ),
    }
  }

  return authResult
}

// Check if user has one of the allowed roles
export async function requireRole(roles: UserRole | UserRole[]): Promise<AuthResult> {
  const authResult = await getAuthenticatedUser()

  if (!authResult.authenticated || !authResult.user) {
    return authResult
  }

  const allowedRoles = Array.isArray(roles) ? roles : [roles]

  if (!allowedRoles.includes(authResult.user.role)) {
    return {
      authenticated: true,
      user: authResult.user,
      error: NextResponse.json(
        { error: "Forbidden", message: "You don't have the required role to perform this action" },
        { status: 403 }
      ),
    }
  }

  return authResult
}
