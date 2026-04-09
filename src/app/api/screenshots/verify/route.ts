import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"
import { z } from "zod"
import { validateRequestBody } from "@/lib/validations"
import { ApiErrors } from "@/lib/api-response"
import { logError } from "@/lib/logger"
import { createAuditLog } from "@/lib/audit"

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
      return ApiErrors.unauthorized()
    }

    // Only Owner and Accountant can verify screenshots
    if (session.user.role === "SALES") {
      return ApiErrors.forbidden("Only Owner and Accountant can verify screenshots")
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

    await createAuditLog({
      action: "SCREENSHOT_VERIFIED",
      userId: session.user.id,
      targetId: screenshotId,
      details: { verified, notes },
    })

    return NextResponse.json({ success: true, data: screenshot })
  } catch (error) {
    logError("Error verifying screenshot", error)
    return ApiErrors.serverError("Failed to verify screenshot")
  }
}
