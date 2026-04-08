import { prisma } from "@/lib/db"
import { getAuthenticatedUser } from "@/lib/api-auth"
import { successResponse, ApiErrors } from "@/lib/api-response"
import { logError } from "@/lib/logger"

// GET /api/system-date - Returns the earliest opening date (system start date)
export async function GET() {
  const auth = await getAuthenticatedUser()
  if (auth.error) return auth.error

  try {
    const [bankSettings, walletSettings] = await Promise.all([
      prisma.bankSettings.findFirst({ orderBy: { openingDate: "desc" }, select: { openingDate: true } }),
      prisma.walletSettings.findFirst({ orderBy: { openingDate: "desc" }, select: { openingDate: true } }),
    ])

    const dates: Date[] = []
    if (bankSettings?.openingDate) dates.push(bankSettings.openingDate)
    if (walletSettings?.openingDate) dates.push(walletSettings.openingDate)

    if (dates.length === 0) {
      return successResponse({ startDate: null })
    }

    dates.sort((a, b) => a.getTime() - b.getTime())
    return successResponse({ startDate: dates[0].toISOString() })
  } catch (error) {
    logError("Error fetching system date", error)
    return ApiErrors.serverError("Failed to fetch system date")
  }
}
