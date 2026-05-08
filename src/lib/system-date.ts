import { prisma } from "@/lib/db"

/**
 * Compute the earliest valid date for any user-entered transaction —
 * the minimum of `BankSettings.openingDate` and `WalletSettings.openingDate`.
 *
 * Used as the floor for date pickers (client-side via /api/system-date) AND
 * as a server-side guard against backdating before setup
 * (POST /api/daily-entries, etc).
 *
 * Returns `null` if neither setting exists yet (system not set up).
 */
export async function getSystemStartDate(): Promise<Date | null> {
  const [bank, wallet] = await Promise.all([
    prisma.bankSettings.findFirst({ orderBy: { openingDate: "desc" }, select: { openingDate: true } }),
    prisma.walletSettings.findFirst({ orderBy: { openingDate: "desc" }, select: { openingDate: true } }),
  ])

  const dates: Date[] = []
  if (bank?.openingDate) dates.push(bank.openingDate)
  if (wallet?.openingDate) dates.push(wallet.openingDate)

  if (dates.length === 0) return null

  dates.sort((a, b) => a.getTime() - b.getTime())
  return dates[0]
}
