import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import { BUSINESS_RULES_DEFAULTS, type BusinessRules } from "./business-rules-shared"

// Re-export shared symbols so existing server-side imports keep working.
export { BUSINESS_RULES_DEFAULTS, type BusinessRules }

/**
 * Server-side reader for `BusinessRulesSettings`. Pass a `tx` (Prisma transaction
 * client) if calling from inside a transaction; otherwise the global `prisma`
 * client is used.
 *
 * Returns the defaults if the settings row hasn't been created yet — never throws.
 *
 * **Server-only.** Do not import this file from any client component or hook —
 * use `@/lib/business-rules-shared` instead. (The separate file boundary is the
 * guard against this; once we install the `server-only` package we can also add
 * `import "server-only"` here for a build-time error.)
 */
export async function getBusinessRules(
  tx?: Prisma.TransactionClient,
): Promise<BusinessRules> {
  const client = tx ?? prisma
  const row = await client.businessRulesSettings.findUnique({
    where: { id: "default" },
  })
  if (!row) return BUSINESS_RULES_DEFAULTS
  return {
    accountantEditWindowDays: row.accountantEditWindowDays,
    overdueCreditDays: row.overdueCreditDays,
  }
}
