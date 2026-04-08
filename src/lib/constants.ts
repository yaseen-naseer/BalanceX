/**
 * Application-wide named constants.
 * Centralises magic numbers so they can be changed in one place.
 */

/** Maximum cash variance (MVR) before dashboard alerts fire */
export const CASH_VARIANCE_THRESHOLD = 500

/** Maximum wallet variance (MVR) before dashboard alerts fire */
export const WALLET_VARIANCE_THRESHOLD = 500

/** Minimum amount for any financial transaction (MVR) */
export const MIN_AMOUNT_MVR = 0.01

/** bcrypt cost factor for password hashing (S7: increased from 10 to 12) */
export const BCRYPT_ROUNDS = 12

/** Currency code used throughout the application */
export const CURRENCY_CODE = "MVR"

/** GST rate (8%) — retail reload prices include GST */
export const GST_RATE = 0.08

/** GST multiplier (1.08) — divide by this to strip GST from an amount */
export const GST_MULTIPLIER = 1 + GST_RATE

/** Dealer discount rate (8%) — Dhiraagu dealer discount on wallet top-ups */
export const DEALER_DISCOUNT_RATE = 0.08

/**
 * Dhiraagu wallet top-up factor.
 * paid = reload_value × (1 - DEALER_DISCOUNT_RATE) × (1 + GST_RATE)
 * paid = reload_value × 0.9936
 * So: reload_value = paid / 0.9936
 */
export const TOPUP_FACTOR = (1 - DEALER_DISCOUNT_RATE) * (1 + GST_RATE)

/** Format a number as currency with exactly 2 decimal places */
export function fmtCurrency(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
