import type { NextAuthOptions, User } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { prisma } from "@/lib/db"
import type { UserRole } from "@prisma/client"
import { createAuditLog } from "@/lib/audit"
import { logError, logInfo } from "@/lib/logger"

// Account lockout configuration
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MINUTES = 15

// Extend the built-in types
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      username: string
      name: string
      email?: string | null
      role: UserRole
    }
  }

  interface User {
    id: string
    username: string
    name: string
    email?: string | null
    role: UserRole
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    username: string
    role: UserRole
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials): Promise<User | null> {
        if (!credentials?.username || !credentials?.password) {
          return null
        }

        try {
          const user = await prisma.user.findUnique({
            where: { username: credentials.username },
          })

          if (!user || !user.isActive) {
            return null
          }

          // Check if account is locked
          if (user.lockedUntil && user.lockedUntil > new Date()) {
            // Account is still locked
            logInfo("Account locked - login attempt rejected", { username: user.username })
            return null
          }

          // If lockout has expired, reset the counter
          if (user.lockedUntil && user.lockedUntil <= new Date()) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                failedLoginAttempts: 0,
                lockedUntil: null,
              },
            })
          }

          const isPasswordValid = await compare(credentials.password, user.passwordHash)

          if (!isPasswordValid) {
            // Increment failed attempts
            const newFailedAttempts = (user.failedLoginAttempts || 0) + 1

            const updateData: { failedLoginAttempts: number; lockedUntil?: Date } = {
              failedLoginAttempts: newFailedAttempts,
            }

            // Lock account if max attempts reached
            if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
              updateData.lockedUntil = new Date(
                Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000
              )
              logInfo("Account locked due to failed attempts", { username: user.username })

              // Log account lockout in audit trail
              await createAuditLog({
                action: "USER_LOCKED",
                userId: user.id,
                targetId: user.id,
                details: {
                  username: user.username,
                  failedAttempts: newFailedAttempts,
                  lockedUntil: updateData.lockedUntil.toISOString(),
                  reason: "Max failed login attempts exceeded",
                },
              })
            }

            await prisma.user.update({
              where: { id: user.id },
              data: updateData,
            })

            return null
          }

          // Successful login - reset failed attempts
          if (user.failedLoginAttempts > 0 || user.lockedUntil) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                failedLoginAttempts: 0,
                lockedUntil: null,
              },
            })
          }

          return {
            id: user.id,
            username: user.username,
            name: user.name,
            email: user.email,
            role: user.role,
          }
        } catch (error) {
          logError("Auth error", error)
          return null
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.username = user.username
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id
        session.user.username = token.username
        session.user.role = token.role
      }
      return session
    },
  },
  events: {
    async signIn({ user }) {
      // Log successful login in audit trail
      await createAuditLog({
        action: "USER_LOGIN",
        userId: user.id,
        targetId: user.id,
        details: {
          username: (user as User).username,
        },
      })
    },
    async signOut({ token }) {
      // Log logout in audit trail
      if (token?.id) {
        await createAuditLog({
          action: "USER_LOGOUT",
          userId: token.id as string,
          targetId: token.id as string,
          details: {
            username: token.username as string,
          },
        })
      }
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
}
