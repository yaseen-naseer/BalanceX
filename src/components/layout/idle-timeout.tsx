"use client"

import { useIdleTimeout } from "@/hooks/use-idle-timeout"
import { useAuth } from "@/hooks/use-auth"

export function IdleTimeout() {
  const { logout } = useAuth()
  useIdleTimeout(logout)
  return null
}
