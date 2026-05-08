// Re-export Prisma types for convenience
export type {
  User,
  DailyEntry,
  DailyEntryCashDrawer,
  DailyEntryWallet,
  DailyEntryCategory,
  DailyEntryNotes,
  CreditCustomer,
  CreditSale,
  CreditTransaction,
  BankTransaction,
  BankSettings,
  WalletTopup,
  WalletSettings,
  TelcoScreenshot,
  UserRole,
  DailyEntryStatus,
  CustomerType,
  CategoryType,
  CreditTransactionType,
  PaymentMethod,
  BankTransactionType,
  WalletTopupSource,
  WalletOpeningSource,
  SaleLineItem,
} from "@prisma/client"

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Daily Entry with relations
export interface DailyEntryWithRelations {
  id: string
  date: Date
  status: "DRAFT" | "SUBMITTED"
  createdBy: string
  createdAt: Date
  updatedAt: Date
  submittedAt: Date | null
  cashDrawer: {
    opening: number
    bankDeposits: number
    closingActual: number
    closingExpected: number
    variance: number
  } | null
  wallet: {
    opening: number
    openingSource: "PREVIOUS_DAY" | "INITIAL_SETUP" | "MANUAL"
    closingActual: number
    closingExpected: number
    variance: number
  } | null
  categories: Array<{
    category: "DHIRAAGU_BILLS" | "RETAIL_RELOAD" | "WHOLESALE_RELOAD" | "SIM" | "USIM"
    consumerCash: number
    consumerTransfer: number
    consumerCredit: number
    corporateCash: number
    corporateTransfer: number
    corporateCredit: number
    quantity: number
  }>
  notes: {
    content: string | null
  } | null
  creditSales: Array<{
    id: string
    customerId: string
    category: "DHIRAAGU_BILLS" | "RETAIL_RELOAD" | "WHOLESALE_RELOAD" | "SIM" | "USIM"
    amount: number
    cashAmount: number | null
    discountPercent: number | null
    reference: string | null
    customer: {
      id: string
      name: string
      type: "CONSUMER" | "CORPORATE"
    }
  }>
  screenshot: {
    id: string
    filename: string
    filepath: string
    isVerified: boolean
    verifiedBy: string | null
    verifiedAt: Date | null
    verifyNotes: string | null
  } | null
  user: {
    id: string
    name: string
    username: string
  }
  amendments?: Array<{
    id: string
    reason: string
    reopenedBy: string
    reopenedByUser: { id: string; name: string }
    reopenedAt: string | Date
    resubmittedBy: string | null
    resubmittedByUser: { id: string; name: string } | null
    resubmittedAt: string | Date | null
    snapshotBefore: unknown
    snapshotAfter: unknown
  }>
}

// Create/Update DTOs
export interface CreateDailyEntryDto {
  date: string // ISO date string
  categories?: Array<{
    category: "DHIRAAGU_BILLS" | "RETAIL_RELOAD" | "WHOLESALE_RELOAD" | "SIM" | "USIM"
    consumerCash?: number
    consumerTransfer?: number
    consumerCredit?: number
    corporateCash?: number
    corporateTransfer?: number
    corporateCredit?: number
    quantity?: number
  }>
  cashDrawer?: {
    opening?: number
    bankDeposits?: number
    closingActual?: number
  }
  wallet?: {
    opening?: number
    openingSource?: "PREVIOUS_DAY" | "INITIAL_SETUP" | "MANUAL"
    closingActual?: number
  }
  notes?: string
}

export interface UpdateDailyEntryDto extends Partial<CreateDailyEntryDto> {
  status?: "DRAFT" | "SUBMITTED"
}

// Credit Customer types
export interface CreateCreditCustomerDto {
  name: string
  type: "CONSUMER" | "CORPORATE"
  phone: string
  email?: string
  creditLimit?: number
}

export interface UpdateCreditCustomerDto extends Partial<CreateCreditCustomerDto> {
  isActive?: boolean
}

export interface CreditCustomerWithBalance {
  id: string
  name: string
  type: "CONSUMER" | "CORPORATE"
  phone: string
  email: string | null
  creditLimit: number | null
  isActive: boolean
  outstandingBalance: number
  lastActivityDate: Date | null
}

// Credit Transaction types
export interface CreateCreditSaleDto {
  dailyEntryId: string
  customerId: string
  amount: number
  reference?: string
}

export interface CreateSettlementDto {
  customerId: string
  amount: number
  paymentMethod: "CASH" | "TRANSFER" | "CHEQUE"
  reference?: string
  notes?: string
  date: string // ISO date string
  settlementGroupId?: string
}

// Bank Transaction types
export interface CreateBankTransactionDto {
  type: "DEPOSIT" | "WITHDRAWAL"
  amount: number
  reference: string
  notes?: string
  date: string // ISO date string
}

// Wallet Topup types
export interface CreateWalletTopupDto {
  amount: number
  paidAmount?: number
  source: "CASH" | "BANK"
  notes?: string
  date: string // ISO date string
  splitGroupId?: string
}

// Sale Line Item types
export interface SaleLineItemData {
  id: string
  dailyEntryId: string
  category: "DHIRAAGU_BILLS" | "RETAIL_RELOAD" | "WHOLESALE_RELOAD" | "SIM" | "USIM"
  customerType: "CONSUMER" | "CORPORATE"
  paymentMethod: "CASH" | "TRANSFER"
  amount: number
  serviceNumber: string | null
  note: string | null
  wholesaleCustomerId: string | null
  wholesaleCustomer: { id: string; name: string; phone: string; businessName: string | null } | null
  cashAmount: number | null
  discountPercent: number | null
  timestamp: string
  createdBy: string
  createdAt: string
}

export interface CreateSaleLineItemDto {
  dailyEntryId: string
  category: "DHIRAAGU_BILLS" | "RETAIL_RELOAD" | "WHOLESALE_RELOAD" | "SIM" | "USIM"
  customerType: "CONSUMER" | "CORPORATE"
  paymentMethod: "CASH" | "TRANSFER"
  amount: number
  serviceNumber?: string | null
  note?: string | null
  wholesaleCustomerId?: string | null
  cashAmount?: number | null
  discountPercent?: number | null
}

// Wholesale Customer types
export interface WholesaleCustomerData {
  id: string
  name: string
  phone: string
  businessName: string | null
  notes: string | null
  discountOverride: number | null
  isActive: boolean
  totalPurchases: number
  totalCashAmount: number
  purchaseCount: number
  lastPurchaseDate: string | null
  createdAt: string
}

export interface CreateWholesaleCustomerDto {
  name: string
  phone: string
  businessName?: string | null
  notes?: string | null
  discountOverride?: number | null
}

// Wholesale Discount Tier types
export interface WholesaleDiscountTierData {
  id: string
  discountPercent: number
  minCashAmount: number
  isActive: boolean
  sortOrder: number
}

// Dashboard types
export interface TodayBreakdown {
  consumer: { cash: number; transfer: number; credit: number; total: number }
  corporate: { cash: number; transfer: number; credit: number; total: number }
  totals: { cash: number; transfer: number; credit: number; grandTotal: number }
}

export interface DashboardSummary {
  todayRevenue: number
  todayBreakdown: TodayBreakdown
  cashInHand: number | null // null for Sales users or when no entry exists
  monthRevenue: number | null // null for Sales users (limited view)
  monthRevenueChange: number | null // null for Sales users
  creditOutstanding: number | null // null for Sales users
  creditOutstandingChange: number | null
  bankBalance: number | null // null for Sales users
  walletBalance: number
  alerts: DashboardAlert[]
  recentActivity: RecentActivity[]
  limitedView: boolean // true for Sales users
}

export interface DashboardAlert {
  id: string
  type: "not_submitted" | "missing_screenshot" | "not_verified" | "cash_variance" | "wallet_variance" | "overdue_credit"
  priority: "high" | "medium"
  message: string
  count?: number
  dates?: string[]
  link: string
}

export interface RecentActivity {
  id: string
  type: "daily_entry" | "credit_sale" | "settlement" | "bank_transaction" | "wallet_topup"
  description: string
  amount: number
  date: Date
  user: string
}

// Monthly Summary types
export interface MonthlySummary {
  year: number
  month: number
  totalRevenue: number
  averageDaily: number
  daysComplete: number
  totalDays: number
  revenueByCategory: {
    category: string
    total: number
    percentage: number
  }[]
  revenueByPaymentMethod: {
    method: string
    total: number
    percentage: number
  }[]
  revenueByCustomerType: {
    type: string
    total: number
    percentage: number
  }[]
  dailyBreakdown: {
    date: string
    revenue: number
    status: "complete" | "pending" | "missing"
    hasScreenshot: boolean
    isVerified: boolean
    variance: number
  }[]
  varianceSummary: {
    totalCashVariance: number
    totalWalletVariance: number
    daysWithVariance: number
  }
}
