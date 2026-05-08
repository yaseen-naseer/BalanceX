import { getAuthenticatedUser } from "@/lib/api-auth"
import { successResponse, ApiErrors } from "@/lib/api-response"
import { logError } from "@/lib/logger"
import { getSystemStartDate } from "@/lib/system-date"

// GET /api/system-date - Returns the earliest opening date (system start date)
export async function GET() {
  const auth = await getAuthenticatedUser()
  if (auth.error) return auth.error

  try {
    const startDate = await getSystemStartDate()
    return successResponse({ startDate: startDate?.toISOString() ?? null })
  } catch (error) {
    logError("Error fetching system date", error)
    return ApiErrors.serverError("Failed to fetch system date")
  }
}
