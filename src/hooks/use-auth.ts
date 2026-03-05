"use client"

import { useSession, signOut } from "next-auth/react"
import { useCallback, useMemo } from "react"
import type { UserRole } from "@prisma/client"

export function useAuth() {
  const { data: session, status } = useSession()

  const isLoading = status === "loading"
  const isAuthenticated = status === "authenticated"
  const user = session?.user

  const hasRole = useCallback(
    (role: UserRole | UserRole[]): boolean => {
      if (!user?.role) return false
      if (Array.isArray(role)) {
        return role.includes(user.role)
      }
      return user.role === role
    },
    [user]
  )

  const isOwner = user?.role === "OWNER"
  const isAccountant = user?.role === "ACCOUNTANT"
  const isSales = user?.role === "SALES"

  const logout = useCallback(async () => {
    await signOut({ callbackUrl: "/login" })
  }, [])

  return useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated,
      hasRole,
      isOwner,
      isAccountant,
      isSales,
      logout,
    }),
    [user, isLoading, isAuthenticated, hasRole, isOwner, isAccountant, isSales, logout]
  )
}
