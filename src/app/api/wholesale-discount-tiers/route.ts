import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { getAuthenticatedUser } from "@/lib/api-auth"
import { requireRole } from "@/lib/api-auth"
import { successResponse, ApiErrors } from "@/lib/api-response"
import { convertPrismaDecimals } from "@/lib/utils/serialize"

const DEFAULT_TIERS = [
  { discountPercent: 6.0, minCashAmount: 500, sortOrder: 1, isActive: true },
  { discountPercent: 6.5, minCashAmount: 1000, sortOrder: 2, isActive: true },
  { discountPercent: 7.0, minCashAmount: 2000, sortOrder: 3, isActive: true },
  { discountPercent: 7.5, minCashAmount: 3000, sortOrder: 4, isActive: true },
  { discountPercent: 8.0, minCashAmount: 5000, sortOrder: 5, isActive: true },
]

// GET /api/wholesale-discount-tiers - List all tiers (auto-seed if empty)
export async function GET() {
  const auth = await getAuthenticatedUser()
  if (!auth.authenticated) return auth.error!

  try {
    let tiers = await prisma.wholesaleDiscountTier.findMany({
      orderBy: { sortOrder: "asc" },
    })

    // Auto-seed defaults if no tiers exist
    if (tiers.length === 0) {
      await prisma.wholesaleDiscountTier.createMany({
        data: DEFAULT_TIERS,
      })
      tiers = await prisma.wholesaleDiscountTier.findMany({
        orderBy: { sortOrder: "asc" },
      })
    }

    return successResponse(convertPrismaDecimals(tiers))
  } catch (error) {
    console.error("Error fetching discount tiers:", error)
    return ApiErrors.serverError("Failed to fetch discount tiers")
  }
}

// PATCH /api/wholesale-discount-tiers - Update tier min cash amounts (owner only)
export async function PATCH(request: NextRequest) {
  const auth = await requireRole("OWNER")
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const { tiers } = body as {
      tiers: Array<{ id: string; minCashAmount: number; isActive: boolean }>
    }

    if (!Array.isArray(tiers) || tiers.length === 0) {
      return ApiErrors.badRequest("Tiers array is required")
    }

    // Validate
    const activeTiers = tiers.filter((t) => t.isActive)
    if (activeTiers.length === 0) {
      return ApiErrors.badRequest("At least one tier must be active")
    }

    // Tier 1 (6%) must always be active
    const existingTiers = await prisma.wholesaleDiscountTier.findMany({
      orderBy: { sortOrder: "asc" },
    })
    const tier1 = existingTiers.find((t) => Number(t.discountPercent) === 6.0)
    if (tier1) {
      const tier1Update = tiers.find((t) => t.id === tier1.id)
      if (tier1Update && !tier1Update.isActive) {
        return ApiErrors.badRequest("The 6% tier must always be active")
      }
    }

    // Validate min cash amounts are >= 500 and ascending for active tiers
    const sortedActive = tiers
      .map((t) => {
        const existing = existingTiers.find((e) => e.id === t.id)
        return { ...t, sortOrder: existing?.sortOrder ?? 0 }
      })
      .filter((t) => t.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)

    for (let i = 0; i < sortedActive.length; i++) {
      if (sortedActive[i].minCashAmount < 500) {
        return ApiErrors.badRequest("Minimum cash amount must be at least 500")
      }
      if (i > 0 && sortedActive[i].minCashAmount <= sortedActive[i - 1].minCashAmount) {
        return ApiErrors.badRequest("Min cash amounts must be ascending for active tiers")
      }
    }

    // Update each tier
    for (const tier of tiers) {
      await prisma.wholesaleDiscountTier.update({
        where: { id: tier.id },
        data: {
          minCashAmount: tier.minCashAmount,
          isActive: tier.isActive,
        },
      })
    }

    const updated = await prisma.wholesaleDiscountTier.findMany({
      orderBy: { sortOrder: "asc" },
    })

    return successResponse(convertPrismaDecimals(updated))
  } catch (error) {
    console.error("Error updating discount tiers:", error)
    return ApiErrors.serverError("Failed to update discount tiers")
  }
}
