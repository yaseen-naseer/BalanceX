import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { getAuthenticatedUser, requireRole } from "@/lib/api-auth"
import { successResponse, ApiErrors } from "@/lib/api-response"
import { logError } from "@/lib/logger"
import { createAuditLog, getClientIpFromRequest, getUserAgentFromRequest } from "@/lib/audit"
import { updateBusinessRulesSchema, validateRequestBody } from "@/lib/validations"
import { BUSINESS_RULES_DEFAULTS } from "@/lib/business-rules"

// GET /api/settings/business-rules — current values (any authenticated user)
export async function GET() {
  const auth = await getAuthenticatedUser()
  if (!auth.authenticated) return auth.error!

  try {
    const row = await prisma.businessRulesSettings.findUnique({
      where: { id: "default" },
    })
    return successResponse({
      accountantEditWindowDays:
        row?.accountantEditWindowDays ?? BUSINESS_RULES_DEFAULTS.accountantEditWindowDays,
      overdueCreditDays:
        row?.overdueCreditDays ?? BUSINESS_RULES_DEFAULTS.overdueCreditDays,
    })
  } catch (error) {
    logError("Error reading business rules settings", error)
    return ApiErrors.serverError("Failed to read business rules")
  }
}

// PATCH /api/settings/business-rules — update values (OWNER only)
export async function PATCH(request: NextRequest) {
  const auth = await requireRole("OWNER")
  if (auth.error) return auth.error

  const validation = await validateRequestBody(request, updateBusinessRulesSchema)
  if ("error" in validation) return validation.error
  const body = validation.data

  try {
    const existing = await prisma.businessRulesSettings.findUnique({
      where: { id: "default" },
    })
    const oldValues = existing
      ? {
          accountantEditWindowDays: existing.accountantEditWindowDays,
          overdueCreditDays: existing.overdueCreditDays,
        }
      : BUSINESS_RULES_DEFAULTS

    const updated = await prisma.businessRulesSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        accountantEditWindowDays:
          body.accountantEditWindowDays ?? BUSINESS_RULES_DEFAULTS.accountantEditWindowDays,
        overdueCreditDays:
          body.overdueCreditDays ?? BUSINESS_RULES_DEFAULTS.overdueCreditDays,
        updatedBy: auth.user!.id,
      },
      update: {
        ...(body.accountantEditWindowDays !== undefined && {
          accountantEditWindowDays: body.accountantEditWindowDays,
        }),
        ...(body.overdueCreditDays !== undefined && {
          overdueCreditDays: body.overdueCreditDays,
        }),
        updatedBy: auth.user!.id,
      },
    })

    await createAuditLog({
      action: "SETTINGS_CHANGED",
      userId: auth.user!.id,
      details: {
        scope: "business_rules",
        oldValues: { ...oldValues },
        newValues: {
          accountantEditWindowDays: updated.accountantEditWindowDays,
          overdueCreditDays: updated.overdueCreditDays,
        },
      },
      ipAddress: getClientIpFromRequest(request),
      userAgent: getUserAgentFromRequest(request),
    })

    return successResponse({
      accountantEditWindowDays: updated.accountantEditWindowDays,
      overdueCreditDays: updated.overdueCreditDays,
    })
  } catch (error) {
    logError("Error updating business rules settings", error)
    return ApiErrors.serverError("Failed to update business rules")
  }
}
