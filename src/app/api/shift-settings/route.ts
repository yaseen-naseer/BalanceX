import { NextRequest, NextResponse } from "next/server"
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

    return NextResponse.json({
      success: true,
      data: shifts,
    })
  } catch (error) {
    logError("Error fetching shift settings", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch shift settings" },
      { status: 500 }
    )
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

    return NextResponse.json(
      {
        success: true,
        data: shift,
      },
      { status: 201 }
    )
  } catch (error) {
    logError("Error creating shift setting", error)
    return NextResponse.json(
      { success: false, error: "Failed to create shift setting" },
      { status: 500 }
    )
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

    return NextResponse.json({
      success: true,
      data: shift,
    })
  } catch (error) {
    logError("Error updating shift setting", error)
    return NextResponse.json(
      { success: false, error: "Failed to update shift setting" },
      { status: 500 }
    )
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
      return NextResponse.json(
        { success: false, error: "Shift ID is required" },
        { status: 400 }
      )
    }

    await prisma.shiftSettings.update({
      where: { id },
      data: { isActive: false, isDefault: false },
    })

    await createAuditLog({ action: "SETTINGS_CHANGED", userId: auth.user!.id, targetId: id, details: { setting: "shift_deactivated" }, ipAddress: getClientIpFromRequest(request), userAgent: getUserAgentFromRequest(request) })

    return NextResponse.json({ success: true })
  } catch (error) {
    logError("Error deactivating shift setting", error)
    return NextResponse.json(
      { success: false, error: "Failed to deactivate shift setting" },
      { status: 500 }
    )
  }
}
