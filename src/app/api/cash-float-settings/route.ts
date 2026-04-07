import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireRole } from "@/lib/api-auth"
import { UserRole } from "@prisma/client"
import {
  createCashFloatSettingsSchema,
  updateCashFloatSettingsSchema,
  validateRequestBody,
} from "@/lib/validations"
import { z } from "zod"
import { logError } from "@/lib/logger"

// Schema for PATCH (includes id)
const patchCashFloatSettingsSchema = z.object({
  id: z.string().cuid("Invalid setting ID"),
}).merge(updateCashFloatSettingsSchema)

// GET /api/cash-float-settings - List all float settings (Owner only)
export async function GET() {
  const auth = await requireRole([UserRole.OWNER])
  if (auth.error) return auth.error

  try {
    const settings = await prisma.cashFloatSettings.findMany({
      where: { isActive: true },
      orderBy: { amount: "asc" },
    })

    return NextResponse.json({
      success: true,
      data: settings.map((s) => ({
        ...s,
        amount: Number(s.amount),
      })),
    })
  } catch (error) {
    logError("Error fetching cash float settings", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch float settings" },
      { status: 500 }
    )
  }
}

// POST /api/cash-float-settings - Create new float setting (Owner only)
export async function POST(request: NextRequest) {
  const auth = await requireRole([UserRole.OWNER])
  if (auth.error) return auth.error

  try {
    // Validate request body
    const validation = await validateRequestBody(request, createCashFloatSettingsSchema)
    if ("error" in validation) return validation.error
    const { name, amount, isDefault = false } = validation.data

    // If this is set as default, unset other defaults
    if (isDefault) {
      await prisma.cashFloatSettings.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      })
    }

    const setting = await prisma.cashFloatSettings.create({
      data: {
        name,
        amount,
        isDefault,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          ...setting,
          amount: Number(setting.amount),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    logError("Error creating cash float setting", error)
    return NextResponse.json(
      { success: false, error: "Failed to create float setting" },
      { status: 500 }
    )
  }
}

// PATCH /api/cash-float-settings - Update float setting (Owner only)
export async function PATCH(request: NextRequest) {
  const auth = await requireRole([UserRole.OWNER])
  if (auth.error) return auth.error

  try {
    // Validate request body
    const validation = await validateRequestBody(request, patchCashFloatSettingsSchema)
    if ("error" in validation) return validation.error
    const { id, name, amount, isDefault, isActive } = validation.data

    // If setting as default, unset others
    if (isDefault) {
      await prisma.cashFloatSettings.updateMany({
        where: { isDefault: true, NOT: { id } },
        data: { isDefault: false },
      })
    }

    const setting = await prisma.cashFloatSettings.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(amount && { amount }),
        ...(isDefault !== undefined && { isDefault }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...setting,
        amount: Number(setting.amount),
      },
    })
  } catch (error) {
    logError("Error updating cash float setting", error)
    return NextResponse.json(
      { success: false, error: "Failed to update float setting" },
      { status: 500 }
    )
  }
}

// DELETE /api/cash-float-settings - Deactivate float setting (Owner only)
export async function DELETE(request: NextRequest) {
  const auth = await requireRole([UserRole.OWNER])
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Setting ID is required" },
        { status: 400 }
      )
    }

    await prisma.cashFloatSettings.update({
      where: { id },
      data: { isActive: false, isDefault: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logError("Error deactivating cash float setting", error)
    return NextResponse.json(
      { success: false, error: "Failed to deactivate float setting" },
      { status: 500 }
    )
  }
}
