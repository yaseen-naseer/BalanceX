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
  // Order matters due to foreign key constraints
  
  console.log("1. Deleting Telco Screenshots...")
  const screenshots = await prisma.telcoScreenshot.deleteMany()
  console.log(`   ✓ Deleted ${screenshots.count} screenshots`)

  console.log("2. Deleting Wallet Topups...")
  const topups = await prisma.walletTopup.deleteMany()
  console.log(`   ✓ Deleted ${topups.count} top-ups`)

  console.log("3. Deleting Wallet Settings...")
  const walletSettings = await prisma.walletSettings.deleteMany()
  console.log(`   ✓ Deleted ${walletSettings.count} wallet settings`)

  console.log("4. Deleting Bank Transactions...")
  const bankTransactions = await prisma.bankTransaction.deleteMany()
  console.log(`   ✓ Deleted ${bankTransactions.count} bank transactions`)

  console.log("5. Deleting Bank Settings...")
  const bankSettings = await prisma.bankSettings.deleteMany()
  console.log(`   ✓ Deleted ${bankSettings.count} bank settings`)

  console.log("6. Deleting Credit Transactions...")
  const creditTransactions = await prisma.creditTransaction.deleteMany()
  console.log(`   ✓ Deleted ${creditTransactions.count} credit transactions`)

  console.log("7. Deleting Credit Sales...")
  const creditSales = await prisma.creditSale.deleteMany()
  console.log(`   ✓ Deleted ${creditSales.count} credit sales`)

  console.log("8. Deleting Credit Customers...")
  const creditCustomers = await prisma.creditCustomer.deleteMany()
  console.log(`   ✓ Deleted ${creditCustomers.count} credit customers`)

  console.log("9. Deleting Daily Entry Notes...")
  const notes = await prisma.dailyEntryNotes.deleteMany()
  console.log(`   ✓ Deleted ${notes.count} notes`)

  console.log("10. Deleting Daily Entry Categories...")
  const categories = await prisma.dailyEntryCategory.deleteMany()
  console.log(`   ✓ Deleted ${categories.count} categories`)

  console.log("11. Deleting Daily Entry Wallets...")
  const wallets = await prisma.dailyEntryWallet.deleteMany()
  console.log(`   ✓ Deleted ${wallets.count} wallet records`)

  console.log("12. Deleting Daily Entry Cash Drawers...")
  const cashDrawers = await prisma.dailyEntryCashDrawer.deleteMany()
  console.log(`   ✓ Deleted ${cashDrawers.count} cash drawer records`)

  console.log("13. Deleting Daily Entries...")
  const dailyEntries = await prisma.dailyEntry.deleteMany()
  console.log(`   ✓ Deleted ${dailyEntries.count} daily entries`)

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
