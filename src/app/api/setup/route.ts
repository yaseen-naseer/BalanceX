import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"
import { BCRYPT_ROUNDS } from "@/lib/constants"
import { z } from "zod"
import { createAuditLog } from "@/lib/audit"
import { ApiErrors, successOk } from "@/lib/api-response"
import { logError } from "@/lib/logger"

// GET /api/setup — check whether setup is still needed (public)
export async function GET() {
  const count = await prisma.user.count()
  return NextResponse.json({ needsSetup: count === 0 })
}

const setupSchema = z.object({
  owner: z.object({
    name: z.string().min(1, "Name is required").max(100),
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(30)
      .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers and underscores only"),
    // Setup is the bootstrap OWNER account — stricter than the regular user-creation policy.
    password: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .max(100, "Password too long")
      .refine((p) => /[a-z]/.test(p), "Must contain a lowercase letter")
      .refine((p) => /[A-Z]/.test(p), "Must contain an uppercase letter")
      .refine((p) => /[0-9]/.test(p), "Must contain a number")
      .refine((p) => /[!@#$%^&*]/.test(p), "Must contain a special character (!@#$%^&*)"),
  }),
  bank: z.object({
    openingBalance: z.number().min(0),
    openingDate: z.string().refine((d) => !isNaN(new Date(d).getTime()), "Invalid date"),
  }),
  wallet: z.object({
    openingBalance: z.number().min(0),
    openingDate: z.string().refine((d) => !isNaN(new Date(d).getTime()), "Invalid date"),
  }),
})

// POST /api/setup — complete initial setup (only works when no users exist)
export async function POST(request: NextRequest) {
  // Guard: refuse if setup is already done
  const count = await prisma.user.count()
  if (count > 0) {
    return ApiErrors.forbidden("Setup has already been completed")
  }

  let body: z.infer<typeof setupSchema>
  try {
    const raw = await request.json()
    const result = setupSchema.safeParse(raw)
    if (!result.success) {
      const message = result.error.issues.map((i) => i.message).join(", ")
      return ApiErrors.badRequest(message)
    }
    body = result.data
  } catch {
    return ApiErrors.badRequest("Invalid request body")
  }

  const passwordHash = await bcrypt.hash(body.owner.password, BCRYPT_ROUNDS)
  const bankDate = new Date(body.bank.openingDate)
  bankDate.setUTCHours(0, 0, 0, 0)
  const walletDate = new Date(body.wallet.openingDate)
  walletDate.setUTCHours(0, 0, 0, 0)

  try {
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: body.owner.name,
          username: body.owner.username,
          passwordHash,
          role: "OWNER",
        },
      })

      // Use id "default" to match the upsert pattern in bank/wallet settings PATCH routes,
      // so future updates to opening balances update this record rather than creating duplicates.
      await tx.bankSettings.create({
        data: {
          id: "default",
          openingBalance: body.bank.openingBalance,
          openingDate: bankDate,
        },
      })

      await tx.walletSettings.create({
        data: {
          id: "default",
          openingBalance: body.wallet.openingBalance,
          openingDate: walletDate,
        },
      })

      return newUser
    })

    await createAuditLog({
      action: "USER_CREATED",
      userId: user.id,
      targetId: user.id,
      details: { username: user.username, name: user.name, role: "OWNER", setupWizard: true },
    })

    return successOk()
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return ApiErrors.conflict("Username already taken")
    }
    logError("Setup error", error)
    return ApiErrors.serverError("Failed to complete setup")
  }
}
