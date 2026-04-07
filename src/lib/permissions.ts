import type { UserRole } from "@prisma/client"

// Permission definitions based on MVP Specification
export const PERMISSIONS = {
  // Daily Entry
  DAILY_ENTRY_CREATE: "daily_entry:create",
  DAILY_ENTRY_EDIT_OWN: "daily_entry:edit_own",
  DAILY_ENTRY_EDIT_ANY: "daily_entry:edit_any",
  DAILY_ENTRY_EDIT_PAST: "daily_entry:edit_past",
  DAILY_ENTRY_SUBMIT: "daily_entry:submit",
  DAILY_ENTRY_REOPEN: "daily_entry:reopen",

  // Credit Customers
  CREDIT_CUSTOMER_VIEW: "credit_customer:view",
  CREDIT_CUSTOMER_CREATE: "credit_customer:create",
  CREDIT_CUSTOMER_EDIT: "credit_customer:edit",
  CREDIT_CUSTOMER_OVERRIDE_LIMIT: "credit_customer:override_limit",

  // Credit Transactions
  CREDIT_SALE_CREATE: "credit_sale:create",
  CREDIT_SALE_DELETE: "credit_sale:delete",
  SETTLEMENT_RECORD: "settlement:record",

  // Wholesale Customers
  WHOLESALE_CUSTOMER_EDIT: "wholesale_customer:edit",

  // Bank
  BANK_VIEW: "bank:view",
  BANK_DEPOSIT: "bank:deposit",
  BANK_WITHDRAW: "bank:withdraw",
  BANK_SET_OPENING: "bank:set_opening",
  BANK_TRANSACTION_EDIT: "bank:transaction_edit",
  BANK_TRANSACTION_DELETE: "bank:transaction_delete",

  // Wallet
  WALLET_VIEW: "wallet:view",
  WALLET_ADD_TOPUP: "wallet:add_topup",
  WALLET_DELETE_TOPUP: "wallet:delete_topup",
  WALLET_SET_OPENING: "wallet:set_opening",

  // Screenshot
  SCREENSHOT_UPLOAD: "screenshot:upload",
  SCREENSHOT_VERIFY: "screenshot:verify",
  SCREENSHOT_DELETE: "screenshot:delete",

  // Import
  IMPORT_DATA: "import:data",

  // Reports
  REPORTS_VIEW: "reports:view",
  REPORTS_EXPORT: "reports:export",

  // Settings
  SETTINGS_VIEW: "settings:view",
  SETTINGS_USER_MANAGE: "settings:user_manage",
  SETTINGS_DATA_EXPORT: "settings:data_export",
  SETTINGS_DATA_CLEAR: "settings:data_clear",
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

// Role permission mapping based on MVP Specification
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  OWNER: Object.values(PERMISSIONS), // Owner has all permissions

  ACCOUNTANT: [
    PERMISSIONS.DAILY_ENTRY_CREATE,
    PERMISSIONS.DAILY_ENTRY_EDIT_OWN,
    PERMISSIONS.DAILY_ENTRY_EDIT_PAST, // Within 7 days
    PERMISSIONS.DAILY_ENTRY_SUBMIT,
    PERMISSIONS.DAILY_ENTRY_REOPEN,
    PERMISSIONS.CREDIT_CUSTOMER_VIEW,
    PERMISSIONS.CREDIT_CUSTOMER_CREATE,
    PERMISSIONS.CREDIT_CUSTOMER_EDIT,
    PERMISSIONS.CREDIT_SALE_CREATE,
    PERMISSIONS.CREDIT_SALE_DELETE,
    PERMISSIONS.SETTLEMENT_RECORD,
    PERMISSIONS.WHOLESALE_CUSTOMER_EDIT,
    PERMISSIONS.BANK_VIEW,
    PERMISSIONS.BANK_DEPOSIT,
    PERMISSIONS.BANK_WITHDRAW,
    PERMISSIONS.BANK_SET_OPENING,
    PERMISSIONS.BANK_TRANSACTION_EDIT,
    PERMISSIONS.WALLET_VIEW,
    PERMISSIONS.WALLET_ADD_TOPUP,
    PERMISSIONS.WALLET_DELETE_TOPUP,
    PERMISSIONS.WALLET_SET_OPENING,
    PERMISSIONS.SCREENSHOT_UPLOAD,
    PERMISSIONS.SCREENSHOT_VERIFY,
    PERMISSIONS.IMPORT_DATA,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_DATA_EXPORT,
  ],

  SALES: [
    PERMISSIONS.DAILY_ENTRY_CREATE,
    PERMISSIONS.DAILY_ENTRY_EDIT_OWN,
    PERMISSIONS.DAILY_ENTRY_SUBMIT,
    PERMISSIONS.CREDIT_CUSTOMER_VIEW,
    PERMISSIONS.CREDIT_SALE_CREATE,
    PERMISSIONS.WALLET_VIEW, // View only
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.SETTINGS_VIEW,
  ],
}

// Check if a role has a specific permission
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

// Check if a role has any of the specified permissions
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission))
}

// Check if a role has all of the specified permissions
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((permission) => hasPermission(role, permission))
}

// Get all permissions for a role
export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? []
}

// Navigation items with role-based visibility
export interface NavItemPermission {
  href: string
  requiredPermissions?: Permission[]
  allowedRoles?: UserRole[]
}

export const NAV_PERMISSIONS: NavItemPermission[] = [
  { href: "/", allowedRoles: ["OWNER", "ACCOUNTANT", "SALES"] },
  { href: "/daily-entry", allowedRoles: ["OWNER", "ACCOUNTANT", "SALES"] },
  { href: "/day-detail", allowedRoles: ["OWNER", "ACCOUNTANT", "SALES"] },
  { href: "/import", allowedRoles: ["OWNER", "ACCOUNTANT"] },
  { href: "/credit", allowedRoles: ["OWNER", "ACCOUNTANT", "SALES"] },
  { href: "/bank", allowedRoles: ["OWNER", "ACCOUNTANT"] },
  { href: "/wholesale-customers", allowedRoles: ["OWNER", "ACCOUNTANT", "SALES"] },
  { href: "/wallet", allowedRoles: ["OWNER", "ACCOUNTANT", "SALES"] },
  { href: "/reports", allowedRoles: ["OWNER", "ACCOUNTANT", "SALES"] },
  { href: "/settings", allowedRoles: ["OWNER", "ACCOUNTANT", "SALES"] },
  { href: "/profile", allowedRoles: ["OWNER", "ACCOUNTANT", "SALES"] },
  { href: "/audit", allowedRoles: ["OWNER"] },
]

// Check if a role can reopen a submitted daily entry
export function canReopenDailyEntry(role: UserRole, entryDate: Date): boolean {
  if (role === "OWNER") return true

  if (role === "ACCOUNTANT") {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const entryDateClean = new Date(entryDate)
    entryDateClean.setUTCHours(0, 0, 0, 0)
    const daysDiff = Math.floor(
      (today.getTime() - entryDateClean.getTime()) / (1000 * 60 * 60 * 24)
    )
    return daysDiff <= 7
  }

  return false
}

// Check if a role can access a specific route
export function canAccessRoute(role: UserRole, href: string): boolean {
  const navItem = NAV_PERMISSIONS.find((item) => item.href === href)

  if (!navItem) return true // Allow access to routes not in the list

  if (navItem.allowedRoles) {
    return navItem.allowedRoles.includes(role)
  }

  if (navItem.requiredPermissions) {
    return hasAnyPermission(role, navItem.requiredPermissions)
  }

  return true
}

// Edit restrictions based on MVP specification
export interface EditRestrictions {
  canEdit: boolean
  reason?: string
}

export function canEditDailyEntry(
  role: UserRole,
  entryDate: Date,
  isOwnEntry: boolean
): EditRestrictions {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const entryDateClean = new Date(entryDate)
  entryDateClean.setUTCHours(0, 0, 0, 0)

  const daysDiff = Math.floor(
    (today.getTime() - entryDateClean.getTime()) / (1000 * 60 * 60 * 24)
  )

  // Owner can edit any entry, any date
  if (role === "OWNER") {
    return { canEdit: true }
  }

  // Accountant can edit within 7 days
  if (role === "ACCOUNTANT") {
    if (daysDiff <= 7) {
      return { canEdit: true }
    }
    return {
      canEdit: false,
      reason: "Accountant can only edit entries within the last 7 days",
    }
  }

  // Sales can only edit today's own entries
  if (role === "SALES") {
    if (!isOwnEntry) {
      return {
        canEdit: false,
        reason: "Sales can only edit their own entries",
      }
    }
    if (daysDiff > 0) {
      return {
        canEdit: false,
        reason: "Sales can only edit today's entries",
      }
    }
    return { canEdit: true }
  }

  return { canEdit: false, reason: "Unknown role" }
}
