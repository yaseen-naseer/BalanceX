import { z } from "zod"

// ============================================
// Common Schemas
// ============================================

export const dateStringSchema = z.string().refine(
  (val) => {
    const date = new Date(val)
    return !isNaN(date.getTime())
  },
  { message: "Invalid date format" }
).refine(
  (val) => {
    // Compare date strings directly to avoid timezone issues
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    return val <= todayStr
  },
  { message: "Date cannot be in the future" }
)

export const positiveNumberSchema = z.number()
  .positive("Must be a positive number")
  .min(0.01, "Minimum amount is 0.01 MVR")
  .refine((v) => {
    const str = String(v)
    const decimal = str.split('.')[1]
    return !decimal || decimal.length <= 2
  }, { message: "Maximum 2 decimal places" })
export const nonNegativeNumberSchema = z.number().min(0, "Cannot be negative")

export const customerTypeSchema = z.enum(["CONSUMER", "CORPORATE"])
export const categoryTypeSchema = z.enum(["DHIRAAGU_BILLS", "RETAIL_RELOAD", "WHOLESALE_RELOAD", "SIM", "USIM"])
export const paymentMethodSchema = z.enum(["CASH", "TRANSFER"])
export const settlementPaymentMethodSchema = z.enum(["CASH", "TRANSFER", "CHEQUE"])
export const bankTransactionTypeSchema = z.enum(["DEPOSIT", "WITHDRAWAL"])
export const walletSourceSchema = z.enum(["CASH", "BANK"])
export const walletOpeningSourceSchema = z.enum(["PREVIOUS_DAY", "INITIAL_SETUP", "MANUAL"])
export const dailyEntryStatusSchema = z.enum(["DRAFT", "SUBMITTED"])
export const userRoleSchema = z.enum(["OWNER", "ACCOUNTANT", "SALES"])

// ============================================
// Daily Entry Schemas
// ============================================

export const categoryInputSchema = z.object({
  category: categoryTypeSchema,
  // Dollar amounts are server-managed: cash/transfer fields are synced from
  // SaleLineItem rows on every line-item add/delete, and credit fields come
  // from the linked CreditSale rows. The client should not echo these back —
  // they parse as `undefined` here on purpose so Prisma `update()` leaves the
  // existing DB values untouched. (`upsertCategory` for new rows still defaults
  // missing fields to 0 via `|| 0`, so create flows are unaffected.)
  consumerCash: nonNegativeNumberSchema.optional(),
  consumerTransfer: nonNegativeNumberSchema.optional(),
  consumerCredit: nonNegativeNumberSchema.optional(),
  corporateCash: nonNegativeNumberSchema.optional(),
  corporateTransfer: nonNegativeNumberSchema.optional(),
  corporateCredit: nonNegativeNumberSchema.optional(),
  quantity: z.number().int().min(0).optional().default(0),
})

export const cashDrawerInputSchema = z.object({
  opening: nonNegativeNumberSchema.optional().default(0),
  bankDeposits: nonNegativeNumberSchema.optional().default(0),
  closingActual: nonNegativeNumberSchema.optional().default(0),
})

export const walletInputSchema = z.object({
  opening: nonNegativeNumberSchema.optional().default(0),
  openingSource: walletOpeningSourceSchema.optional().default("PREVIOUS_DAY"),
  closingActual: nonNegativeNumberSchema.optional().default(0),
})

export const createDailyEntrySchema = z.object({
  date: dateStringSchema,
  categories: z.array(categoryInputSchema).optional(),
  cashDrawer: cashDrawerInputSchema.optional(),
  wallet: walletInputSchema.optional(),
  notes: z.string().max(5000, "Notes cannot exceed 5000 characters").optional(),
})

export const updateDailyEntrySchema = z.object({
  categories: z.array(categoryInputSchema).optional(),
  cashDrawer: cashDrawerInputSchema.optional(),
  wallet: walletInputSchema.optional(),
  notes: z.string().max(5000, "Notes cannot exceed 5000 characters").optional().nullable(),
  status: dailyEntryStatusSchema.optional(),
  acknowledgeWarnings: z.boolean().optional(),
})

// ============================================
// Credit Customer Schemas
// ============================================

export const createCreditCustomerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  type: customerTypeSchema,
  phone: z.string().min(1, "Phone is required").max(20, "Phone too long"),
  email: z.string().email("Invalid email").optional().nullable(),
  creditLimit: positiveNumberSchema.optional().nullable(),
})

export const updateCreditCustomerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: customerTypeSchema.optional(),
  phone: z.string().min(1).max(20).optional(),
  email: z.string().email().optional().nullable(),
  creditLimit: positiveNumberSchema.optional().nullable(),
  isActive: z.boolean().optional(),
})

// ============================================
// Credit Sale Schemas
// ============================================

export const createCreditSaleSchema = z.object({
  dailyEntryId: z.string().cuid("Invalid daily entry ID"),
  customerId: z.string().cuid("Invalid customer ID").optional(),
  wholesaleCustomerId: z.string().cuid("Invalid wholesale customer ID").optional(),
  amount: positiveNumberSchema,
  cashAmount: positiveNumberSchema.optional().nullable(),
  discountPercent: z.number().min(6).max(8).optional().nullable(),
  reference: z.string().max(100).optional().nullable(),
  customerType: customerTypeSchema.optional(),
  category: z.enum(["DHIRAAGU_BILLS", "WHOLESALE_RELOAD"]).optional().default("DHIRAAGU_BILLS"),
  overrideLimit: z.boolean().optional(),
}).refine(
  (data) => data.customerId || data.wholesaleCustomerId,
  { message: "Either customerId or wholesaleCustomerId is required" }
)

// ============================================
// Settlement Schema
// ============================================

export const createSettlementSchema = z.object({
  amount: positiveNumberSchema,
  paymentMethod: settlementPaymentMethodSchema,
  reference: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  date: dateStringSchema,
  settlementGroupId: z.string().max(50).optional().nullable(),
})

// ============================================
// Bank Transaction Schemas
// ============================================

export const createBankTransactionSchema = z.object({
  type: bankTransactionTypeSchema,
  amount: positiveNumberSchema,
  reference: z.string().min(1, "Reference is required").max(100, "Reference too long"),
  notes: z.string().max(500).optional().nullable(),
  date: dateStringSchema,
})

export const updateBankTransactionSchema = z.object({
  id: z.string().cuid("Invalid transaction ID"),
  reference: z.string().min(1).max(100).optional(),
  notes: z.string().max(500).optional().nullable(),
})

// ============================================
// Wallet Schemas
// ============================================

export const createWalletTopupSchema = z.object({
  amount: positiveNumberSchema,
  paidAmount: positiveNumberSchema.optional(),
  source: walletSourceSchema,
  notes: z.string().max(500).optional().nullable(),
  date: dateStringSchema,
  splitGroupId: z.string().max(50).optional().nullable(),
})

export const updateWalletTopupSchema = z.object({
  id: z.string().cuid("Invalid top-up ID"),
  amount: positiveNumberSchema,
  paidAmount: positiveNumberSchema.optional(),
  source: walletSourceSchema,
  notes: z.string().max(500).optional().nullable(),
})

export const walletSettingsSchema = z.object({
  openingBalance: nonNegativeNumberSchema,
  openingDate: dateStringSchema.optional(),
  reason: z.string().min(1, "Reason is required").max(200, "Reason too long"),
})

// ============================================
// User Schemas
// ============================================

// Password strength validation
const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password too long")
  .refine(
    (password) => /[a-z]/.test(password),
    { message: "Password must contain at least one lowercase letter" }
  )
  .refine(
    (password) => /[A-Z]/.test(password),
    { message: "Password must contain at least one uppercase letter" }
  )
  .refine(
    (password) => /[0-9]/.test(password),
    { message: "Password must contain at least one number" }
  )
  .refine(
    (password) => /[!@#$%^&*]/.test(password),
    { message: "Password must contain at least one special character (!@#$%^&*)" }
  )

export const createUserSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username too long")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  email: z.preprocess((val) => (val === "" ? undefined : val), z.string().email("Invalid email").optional().nullable()),
  password: passwordSchema,
  role: userRoleSchema,
})

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.preprocess((val) => (val === "" ? undefined : val), z.string().email().optional().nullable()),
  role: userRoleSchema.optional(),
  isActive: z.boolean().optional(),
  password: passwordSchema.optional(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
})

// ============================================
// Cash Float Schemas
// ============================================

export const createCashFloatSchema = z.object({
  dailyEntryId: z.string().cuid("Invalid daily entry ID"),
  selectedFloatId: z.string().cuid().optional().nullable(),
  shiftId: z.string().cuid().optional().nullable(),
})

const denominationSchema = z.number().int().min(0).default(0)

export const updateCashFloatSchema = z.object({
  id: z.string().cuid("Invalid cash float ID"),
  type: z.enum(["opening", "closing"]),
  verified: z.boolean().optional(),
  notes: z.string().max(500).optional().nullable(),
  // Opening denominations
  openingMvr1000: denominationSchema.optional(),
  openingMvr500: denominationSchema.optional(),
  openingMvr100: denominationSchema.optional(),
  openingMvr50: denominationSchema.optional(),
  openingMvr20: denominationSchema.optional(),
  openingMvr10: denominationSchema.optional(),
  openingMvr5: denominationSchema.optional(),
  openingMvr2: denominationSchema.optional(),
  openingMvr1: denominationSchema.optional(),
  openingMvr050: denominationSchema.optional(),
  // Closing denominations
  closingMvr1000: denominationSchema.optional(),
  closingMvr500: denominationSchema.optional(),
  closingMvr100: denominationSchema.optional(),
  closingMvr50: denominationSchema.optional(),
  closingMvr20: denominationSchema.optional(),
  closingMvr10: denominationSchema.optional(),
  closingMvr5: denominationSchema.optional(),
  closingMvr2: denominationSchema.optional(),
  closingMvr1: denominationSchema.optional(),
  closingMvr050: denominationSchema.optional(),
})

// ============================================
// Cash Float Settings Schemas
// ============================================

export const createCashFloatSettingsSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name too long"),
  amount: positiveNumberSchema,
  isDefault: z.boolean().optional().default(false),
})

export const updateCashFloatSettingsSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  amount: positiveNumberSchema.optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

// ============================================
// Shift Settings Schemas
// ============================================

export const createShiftSettingsSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name too long"),
  startTime: z.string().max(10).optional().nullable(),
  endTime: z.string().max(10).optional().nullable(),
  isDefault: z.boolean().optional().default(false),
  sortOrder: z.number().int().min(0).optional().default(0),
})

export const updateShiftSettingsSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  startTime: z.string().max(10).optional().nullable(),
  endTime: z.string().max(10).optional().nullable(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

// ============================================
// Screenshot Verify Schema
// ============================================

export const verifyScreenshotSchema = z.object({
  id: z.string().cuid("Invalid screenshot ID"),
  verified: z.boolean(),
  notes: z.string().max(500).optional().nullable(),
})

// ============================================
// Sale Line Item Schemas
// ============================================

export const createSaleLineItemSchema = z.object({
  dailyEntryId: z.string().cuid("Invalid daily entry ID"),
  category: categoryTypeSchema,
  customerType: customerTypeSchema,
  paymentMethod: paymentMethodSchema,
  amount: positiveNumberSchema,
  serviceNumber: z.string().max(50).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  wholesaleCustomerId: z.string().cuid().optional().nullable(),
  cashAmount: positiveNumberSchema.optional().nullable(),
  discountPercent: z.number().min(6).max(8).optional().nullable(),
})

export const updateSaleLineItemSchema = z.object({
  amount: positiveNumberSchema.optional(),
  serviceNumber: z.string().max(50).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
})

// ============================================
// Wholesale Customer Schemas
// ============================================

const wholesaleDiscountValues = [6.0, 6.5, 7.0, 7.5, 8.0] as const

export const createWholesaleCustomerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  phone: z.string().min(1, "Phone is required").max(20, "Phone too long"),
  businessName: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  discountOverride: z.number().refine(
    (v) => wholesaleDiscountValues.includes(v as (typeof wholesaleDiscountValues)[number]),
    { message: "Discount must be 6.0, 6.5, 7.0, 7.5, or 8.0" }
  ).optional().nullable(),
})

export const updateWholesaleCustomerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().min(1).max(20).optional(),
  businessName: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  discountOverride: z.number().refine(
    (v) => wholesaleDiscountValues.includes(v as (typeof wholesaleDiscountValues)[number]),
    { message: "Discount must be 6.0, 6.5, 7.0, 7.5, or 8.0" }
  ).optional().nullable(),
  isActive: z.boolean().optional(),
})

// ============================================
// Import Schema
// ============================================

export const importedRowSchema = z.object({
  siteName: z.string().max(200),
  paymentMethod: z.string().max(50),
  customerType: z.string().max(50),
  paymentType: z.string().max(100),
  amount: z.number().min(0).max(10_000_000),
})

export const importDataSchema = z.object({
  date: dateStringSchema,
  rows: z.array(importedRowSchema).min(1, "At least one row is required").max(10_000, "Too many rows"),
  totals: z.object({
    cash: z.number().min(0).max(100_000_000),
    transfer: z.number().min(0).max(100_000_000),
    total: z.number().min(0).max(100_000_000),
  }),
})

// ============================================
// Business Rules Settings (owner-tunable thresholds)
// ============================================

export const updateBusinessRulesSchema = z.object({
  // ACCOUNTANT edit window — must be a sensible number of days.
  // Lower bound 1 (can't disable editing entirely below 1 day).
  // Upper bound 365 (a full year).
  accountantEditWindowDays: z.number().int().min(1).max(365).optional(),
  // Overdue credit alert threshold — same bounds; meaningful if > 0.
  overdueCreditDays: z.number().int().min(1).max(365).optional(),
}).refine(
  (data) =>
    data.accountantEditWindowDays !== undefined ||
    data.overdueCreditDays !== undefined,
  { message: "At least one field must be provided" },
)

// ============================================
// Wholesale Discount Tier Schemas
// ============================================

export const updateDiscountTiersSchema = z.object({
  tiers: z.array(z.object({
    id: z.string().cuid("Invalid tier ID"),
    minCashAmount: z.number().min(0).max(10_000_000),
    isActive: z.boolean(),
  })).min(1, "Tiers array is required"),
})

// ============================================
// Query Parameter Schemas
// ============================================

export const monthParamSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Invalid month format. Expected YYYY-MM")

/**
 * Validates a YYYY-MM-DD date string. Checks format, real day-of-month, and
 * that `new Date(value)` produces a valid timestamp (rejecting e.g. 2026-02-30).
 */
export const dateParamSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Expected YYYY-MM-DD")
  .refine((s) => !isNaN(new Date(s).getTime()), "Invalid date")

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const monthFilterSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format").optional(),
})

export const dateFilterSchema = z.object({
  date: dateStringSchema.optional(),
})

// ============================================
// Validation Helper
// ============================================

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: z.ZodError }

export function validateBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const errorMessage = result.error.issues
    .map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`)
    .join(", ")
  return { success: false, error: errorMessage, details: result.error }
}
