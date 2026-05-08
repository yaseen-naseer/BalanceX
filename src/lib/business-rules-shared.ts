/**
 * Shared types and defaults for business-rule thresholds.
 *
 * Lives in a no-prisma module so it's safe to import from client-side code
 * (`useBusinessRules`, `BusinessRulesSection`) without dragging the `pg` driver
 * into the browser bundle. Server-only logic (DB read) lives in
 * `./business-rules.ts`.
 */

export interface BusinessRules {
  accountantEditWindowDays: number
  overdueCreditDays: number
}

/** Defaults — keep aligned with the schema's `@default(...)` values. */
export const BUSINESS_RULES_DEFAULTS: BusinessRules = {
  accountantEditWindowDays: 7,
  overdueCreditDays: 30,
}
