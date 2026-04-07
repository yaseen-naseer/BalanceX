/**
 * Safe Decimal-to-number conversion utility.
 * Replaces raw Number() casts on Prisma Decimal fields with idiomatic .toNumber().
 *
 * Handles: Prisma.Decimal, number, string, null, undefined.
 */
export function toNum(val: unknown): number {
  if (val === null || val === undefined) return 0
  if (typeof val === "number") return val
  if (
    typeof val === "object" &&
    "toNumber" in val &&
    typeof (val as Record<string, unknown>).toNumber === "function"
  ) {
    return (val as { toNumber(): number }).toNumber()
  }
  return Number(val)
}
