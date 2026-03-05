import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"
import { z } from "zod"
import { validateRequestBody } from "@/lib/validations"

const verifyScreenshotSchema = z.object({
  screenshotId: z.string().cuid("Invalid screenshot ID"),
  verified: z.boolean(),
  notes: z.string().max(500).optional().nullable(),
})

// POST - Mark screenshot as verified
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only Owner and Accountant can verify screenshots
    if (session.user.role === "SALES") {
      return NextResponse.json(
        { error: "Only Owner and Accountant can verify screenshots" },
        { status: 403 }
      )
    }

    // Validate request body
    const validation = await validateRequestBody(request, verifyScreenshotSchema)
    if ("error" in validation) return validation.error
    const { screenshotId, verified, notes } = validation.data

    const screenshot = await prisma.telcoScreenshot.update({
      where: { id: screenshotId },
      data: {
        isVerified: verified,
        verifiedBy: verified ? session.user.id : null,
        verifiedAt: verified ? new Date() : null,
        verifyNotes: notes || null,
      },
    })

    return NextResponse.json(screenshot)
  } catch (error) {
    console.error("Error verifying screenshot:", error)
    return NextResponse.json(
      { error: "Failed to verify screenshot" },
      { status: 500 }
    )
  }
}
