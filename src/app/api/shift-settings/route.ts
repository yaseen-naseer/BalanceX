import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { requireRole } from "@/lib/api-auth"
import { UserRole } from "@prisma/client"
import {
  createShiftSettingsSchema,
  updateShiftSettingsSchema,
  validateRequestBody,
} from "@/lib/validations"
import { z } from "zod"
import { logError } from "@/lib/logger"
import { createAuditLog, getClientIpFromRequest, getUserAgentFromRequest } from "@/lib/audit"
import { ApiErrors, successResponse, successOk } from "@/lib/api-response"

// Schema for PATCH (includes id)
const patchShiftSettingsSchema = z.object({
  id: z.string().cuid("Invalid shift ID"),
}).merge(updateShiftSettingsSchema)

// GET /api/shift-settings - List all shifts (authenticated)
export async function GET() {
  const auth = await requireRole([UserRole.OWNER, UserRole.ACCOUNTANT, UserRole.SALES])
  if (auth.error) return auth.error

  try {
    const shifts = await prisma.shiftSettings.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    })

    return successResponse(shifts)
  } catch (error) {
    logError("Error fetching shift settings", error)
    return ApiErrors.serverError("Failed to fetch shift settings")
  }
}

// POST /api/shift-settings - Create new shift (Owner only)
export async function POST(request: NextRequest) {
  const auth = await requireRole([UserRole.OWNER])
  if (auth.error) return auth.error

  try {
    // Validate request body
    const validation = await validateRequestBody(request, createShiftSettingsSchema)
    if ("error" in validation) return validation.error
    const { name, startTime, endTime, isDefault = false } = validation.data

    // Get max sort order
    const maxOrder = await prisma.shiftSettings.aggregate({
      _max: { sortOrder: true },
    })

    // If this is set as default, unset other defaults
    if (isDefault) {
      await prisma.shiftSettings.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      })
    }

    const shift = await prisma.shiftSettings.create({
      data: {
        name,
        startTime,
        endTime,
        isDefault,
        sortOrder: (maxOrder._max.sortOrder || 0) + 1,
      },
    })

    await createAuditLog({ action: "SETTINGS_CHANGED", userId: auth.user!.id, targetId: shift.id, details: { setting: "shift_created", name }, ipAddress: getClientIpFromRequest(request), userAgent: getUserAgentFromRequest(request) })

    return successResponse(shift, 201)
  } catch (error) {
    logError("Error creating shift setting", error)
    return ApiErrors.serverError("Failed to create shift setting")
  }
}

// PATCH /api/shift-settings - Update shift (Owner only)
export async function PATCH(request: NextRequest) {
  const auth = await requireRole([UserRole.OWNER])
  if (auth.error) return auth.error

  try {
    // Validate request body
    const validation = await validateRequestBody(request, patchShiftSettingsSchema)
    if ("error" in validation) return validation.error
    const { id, name, startTime, endTime, isDefault, isActive, sortOrder } = validation.data

    // If setting as default, unset others
    if (isDefault) {
      await prisma.shiftSettings.updateMany({
        where: { isDefault: true, NOT: { id } },
        data: { isDefault: false },
      })
    }

    const shift = await prisma.shiftSettings.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(isDefault !== undefined && { isDefault }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    })

    await createAuditLog({ action: "SETTINGS_CHANGED", userId: auth.user!.id, targetId: id, details: { setting: "shift_updated", name, isActive }, ipAddress: getClientIpFromRequest(request), userAgent: getUserAgentFromRequest(request) })

    return successResponse(shift)
  } catch (error) {
    logError("Error updating shift setting", error)
    return ApiErrors.serverError("Failed to update shift setting")
  }
}

// DELETE /api/shift-settings - Deactivate shift (Owner only)
export async function DELETE(request: NextRequest) {
  const auth = await requireRole([UserRole.OWNER])
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return ApiErrors.badRequest("Shift ID is required")
    }

    await prisma.shiftSettings.update({
      where: { id },
      data: { isActive: false, isDefault: false },
    })

    await createAuditLog({ action: "SETTINGS_CHANGED", userId: auth.user!.id, targetId: id, details: { setting: "shift_deactivated" }, ipAddress: getClientIpFromRequest(request), userAgent: getUserAgentFromRequest(request) })

    return successOk()
  } catch (error) {
    logError("Error deactivating shift setting", error)
    return ApiErrors.serverError("Failed to deactivate shift setting")
  }
}
