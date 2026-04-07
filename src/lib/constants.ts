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
