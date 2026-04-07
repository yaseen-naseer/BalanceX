/**
 * Shared validation types used by both server-side (daily-entry.ts) and
 * client-side (use-daily-entry-validation.ts) validation logic.
 */

export interface ValidationMessage {
  type: "block" | "warning"
  message: string
  field?: string
}

export interface ValidationResult {
  canSubmit: boolean
  hasWarnings: boolean
  hasBlocks: boolean
  messages: ValidationMessage[]
}
