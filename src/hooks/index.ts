// Shared utility hooks (Phase 1 - Foundation)
export { useAsyncOperation } from "./use-async-operation"
export { useApiClient } from "./use-api-client"
export type { ApiResponse, ExtractApiData } from "./use-api-client"
export { useDialogState, useMultiDialogState } from "./use-dialog-state"
export { useFormField, useForm, validators } from "./use-form-field"

// Authentication hook
export { useAuth } from "./use-auth"

// Domain-specific data hooks
export { useDailyEntry } from "./use-daily-entry"
export type { ValidationResult, SubmitResult, CalculationData } from "./use-daily-entry"
export { useDailyEntryForm } from "./use-daily-entry-form"
export type { UseDailyEntryFormOptions, UseDailyEntryFormReturn, ValidationMessage } from "./use-daily-entry-form"
export { useCreditCustomers } from "./use-credit-customers"
export { useDashboard } from "./use-dashboard"
export { useBank } from "./use-bank"
export { useWallet } from "./use-wallet"
export { useWholesaleCustomers } from "./use-wholesale-customers"
export type { UseWholesaleCustomersReturn } from "./use-wholesale-customers"
export { useReports } from "./use-reports"
export type {
  DailyBreakdown,
  PaymentMethodBreakdown,
  CustomerTypeBreakdown,
  CategoryBreakdown,
  VarianceTrend,
  AgingBucket,
  CreditAging,
  ReportSummary,
  MonthlyReportData,
} from "./use-reports"
