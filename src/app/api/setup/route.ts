import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { createAuditLog } from "@/lib/audit"

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
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .refine((p) => /[a-z]/.test(p), "Must contain a lowercase letter")
      .refine((p) => /[A-Z]/.test(p), "Must contain an uppercase letter")
      .refine((p) => /[0-9]/.test(p), "Must contain a number"),
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
    return NextResponse.json(
      { success: false, error: "Setup has already been completed" },
      { status: 403 }
    )
  }

  let body: z.infer<typeof setupSchema>
  try {
    const raw = await request.json()
    const result = setupSchema.safeParse(raw)
    if (!result.success) {
      const message = result.error.issues.map((i) => i.message).join(", ")
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }
    body = result.data
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(body.owner.password, 10)
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

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ""
    if (msg.includes("Unique constraint") || msg.includes("username")) {
      return NextResponse.json(
        { success: false, error: "Username already taken" },
        { status: 409 }
      )
    }
    console.error("Setup error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to complete setup" },
      { status: 500 }
    )
  }
}
