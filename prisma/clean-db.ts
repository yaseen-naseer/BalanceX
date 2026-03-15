import { config } from "dotenv"
// Load environment variables from .env file
config()

import { PrismaClient } from "@prisma/client"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"

// Parse DATABASE_URL for pg pool
function parseConnectionString(url: string) {
  const regex = /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/
  const match = url.match(regex)
  if (!match) {
    throw new Error("Invalid DATABASE_URL format")
  }
  return {
    user: match[1],
    password: decodeURIComponent(match[2]), // Decode URL-encoded password
    host: match[3],
    port: parseInt(match[4]),
    database: match[5],
  }
}

// Create Prisma client with pg adapter (required for Prisma 7)
const connectionString = process.env.DATABASE_URL!
console.log("Connecting to database...")
const pgConfig = parseConnectionString(connectionString)
const pool = new Pool(pgConfig)
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("========================================")
  console.log("CLEANING DATABASE (Keeping Users)")
  console.log("========================================\n")

  // Count users before cleaning
  const userCount = await prisma.user.count()
  console.log(`Found ${userCount} users (will be preserved)\n`)

  // Delete all data except users
  // Order matters due to foreign key constraints (children first)

  let step = 0
  const del = async (label: string, fn: () => Promise<{ count: number }>) => {
    step++
    console.log(`${step}. Deleting ${label}...`)
    const result = await fn()
    console.log(`   ✓ Deleted ${result.count} ${label.toLowerCase()}`)
  }

  await del("Audit Logs", () => prisma.auditLog.deleteMany())
  await del("Telco Screenshots", () => prisma.telcoScreenshot.deleteMany())
  await del("Daily Entry Amendments", () => prisma.dailyEntryAmendment.deleteMany())
  await del("Sale Line Items", () => prisma.saleLineItem.deleteMany())
  await del("Credit Sales", () => prisma.creditSale.deleteMany())
  await del("Credit Transactions", () => prisma.creditTransaction.deleteMany())
  await del("Credit Customers", () => prisma.creditCustomer.deleteMany())
  await del("Wholesale Customers", () => prisma.wholesaleCustomer.deleteMany())
  await del("Wholesale Discount Tiers", () => prisma.wholesaleDiscountTier.deleteMany())
  await del("Wallet Topups", () => prisma.walletTopup.deleteMany())
  await del("Wallet Settings", () => prisma.walletSettings.deleteMany())
  await del("Bank Transactions", () => prisma.bankTransaction.deleteMany())
  await del("Bank Settings", () => prisma.bankSettings.deleteMany())
  await del("Daily Entry Notes", () => prisma.dailyEntryNotes.deleteMany())
  await del("Daily Entry Categories", () => prisma.dailyEntryCategory.deleteMany())
  await del("Daily Entry Wallets", () => prisma.dailyEntryWallet.deleteMany())
  await del("Daily Entry Cash Drawers", () => prisma.dailyEntryCashDrawer.deleteMany())
  await del("Daily Entries", () => prisma.dailyEntry.deleteMany())

  // Verify users are still there
  const remainingUsers = await prisma.user.count()
  
  console.log("\n========================================")
  console.log("DATABASE CLEANED SUCCESSFULLY!")
  console.log("========================================")
  console.log(`Users preserved: ${remainingUsers}`)
  console.log("\nAll transactions, entries, and customer data have been removed.")
  console.log("The database is now ready for a fresh start!\n")

  // List remaining users
  const users = await prisma.user.findMany({
    select: {
      username: true,
      name: true,
      role: true,
      isActive: true,
    },
    orderBy: { role: "asc" },
  })

  console.log("Remaining Users:")
  console.log("----------------")
  users.forEach((user) => {
    const status = user.isActive ? "✓ Active" : "✗ Inactive"
    console.log(`• ${user.name} (${user.username}) - ${user.role} - ${status}`)
  })
  console.log("\n")
}

main()
  .catch((e) => {
    console.error("Error cleaning database:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
