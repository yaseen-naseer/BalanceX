import { config } from "dotenv"
// Load environment variables from .env file
config()

import { PrismaClient, UserRole, CustomerType } from "@prisma/client"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

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
  console.log("Seeding database...")

  // Clear existing data
  await prisma.telcoScreenshot.deleteMany()
  await prisma.walletTopup.deleteMany()
  await prisma.walletSettings.deleteMany()
  await prisma.bankTransaction.deleteMany()
  await prisma.bankSettings.deleteMany()
  await prisma.creditTransaction.deleteMany()
  await prisma.creditSale.deleteMany()
  await prisma.creditCustomer.deleteMany()
  await prisma.dailyEntryNotes.deleteMany()
  await prisma.dailyEntryCategory.deleteMany()
  await prisma.dailyEntryWallet.deleteMany()
  await prisma.dailyEntryCashDrawer.deleteMany()
  await prisma.dailyEntry.deleteMany()
  await prisma.user.deleteMany()

  console.log("Cleared existing data")

  // Create Users
  const hashedPassword = await bcrypt.hash("password123", 10)

  const owner = await prisma.user.create({
    data: {
      username: "owner",
      name: "Ahmed Ibrahim",
      email: "owner@balancex.com",
      passwordHash: hashedPassword,
      role: UserRole.OWNER,
    },
  })

  const accountant = await prisma.user.create({
    data: {
      username: "accountant",
      name: "Fathimath Ali",
      email: "accountant@balancex.com",
      passwordHash: hashedPassword,
      role: UserRole.ACCOUNTANT,
    },
  })

  const sales = await prisma.user.create({
    data: {
      username: "sales",
      name: "Mariyam Hassan",
      email: "sales@balancex.com",
      passwordHash: hashedPassword,
      role: UserRole.SALES,
    },
  })

  console.log("Created users:", { owner: owner.name, accountant: accountant.name, sales: sales.name })

  // Create Credit Customers
  const customers = await Promise.all([
    prisma.creditCustomer.create({
      data: {
        name: "Ahmed Mohamed",
        type: CustomerType.CONSUMER,
        phone: "777-1234",
        email: "ahmed@email.com",
        creditLimit: null, // No limit
      },
    }),
    prisma.creditCustomer.create({
      data: {
        name: "Fathimath Ali",
        type: CustomerType.CONSUMER,
        phone: "777-5678",
        email: null,
        creditLimit: 2000,
      },
    }),
    prisma.creditCustomer.create({
      data: {
        name: "Island Tech Ltd",
        type: CustomerType.CORPORATE,
        phone: "334-5678",
        email: "accounts@islandtech.mv",
        creditLimit: 5000,
      },
    }),
    prisma.creditCustomer.create({
      data: {
        name: "Maldives Trading Co",
        type: CustomerType.CORPORATE,
        phone: "334-9012",
        email: "finance@maldivestrading.mv",
        creditLimit: 10000,
      },
    }),
    prisma.creditCustomer.create({
      data: {
        name: "Hassan Ibrahim",
        type: CustomerType.CONSUMER,
        phone: "777-3456",
        email: null,
        creditLimit: 1500,
      },
    }),
  ])

  console.log("Created credit customers:", customers.length)

  // Create Bank Settings (opening balance)
  await prisma.bankSettings.create({
    data: {
      openingBalance: 5200,
      openingDate: new Date("2026-01-01"),
    },
  })

  console.log("Created bank settings")

  // Create Wallet Settings (opening balance)
  await prisma.walletSettings.create({
    data: {
      openingBalance: 15000,
      openingDate: new Date("2026-01-01"),
    },
  })

  console.log("Created wallet settings")

  // Create sample daily entries for the past week
  const today = new Date()
  const dailyEntries = []

  for (let i = 7; i >= 1; i--) {
    const entryDate = new Date(today)
    entryDate.setDate(today.getDate() - i)
    entryDate.setHours(0, 0, 0, 0)

    // Random variations for realistic data
    const baseRevenue = 5000 + Math.floor(Math.random() * 3000)
    const cashRatio = 0.4 + Math.random() * 0.2

    const entry = await prisma.dailyEntry.create({
      data: {
        date: entryDate,
        status: "SUBMITTED",
        createdBy: sales.id,
        submittedAt: entryDate,
      },
    })

    // Create categories for this entry
    const categories = [
      {
        category: "DHIRAAGU_BILLS" as const,
        consumerCash: Math.floor(baseRevenue * 0.15 * cashRatio),
        consumerTransfer: Math.floor(baseRevenue * 0.15 * (1 - cashRatio)),
        consumerCredit: Math.floor(baseRevenue * 0.02),
        corporateCash: Math.floor(baseRevenue * 0.05 * cashRatio),
        corporateTransfer: Math.floor(baseRevenue * 0.05 * (1 - cashRatio)),
        corporateCredit: Math.floor(baseRevenue * 0.01),
        quantity: 0,
      },
      {
        category: "RETAIL_RELOAD" as const,
        consumerCash: Math.floor(baseRevenue * 0.2 * cashRatio),
        consumerTransfer: Math.floor(baseRevenue * 0.2 * (1 - cashRatio)),
        consumerCredit: Math.floor(baseRevenue * 0.03),
        corporateCash: Math.floor(baseRevenue * 0.08 * cashRatio),
        corporateTransfer: Math.floor(baseRevenue * 0.08 * (1 - cashRatio)),
        corporateCredit: Math.floor(baseRevenue * 0.02),
        quantity: 0,
      },
      {
        category: "WHOLESALE_RELOAD" as const,
        consumerCash: Math.floor(baseRevenue * 0.05 * cashRatio),
        consumerTransfer: Math.floor(baseRevenue * 0.05 * (1 - cashRatio)),
        consumerCredit: 0,
        corporateCash: Math.floor(baseRevenue * 0.02 * cashRatio),
        corporateTransfer: Math.floor(baseRevenue * 0.02 * (1 - cashRatio)),
        corporateCredit: 0,
        quantity: 0,
      },
      {
        category: "SIM" as const,
        consumerCash: 150,
        consumerTransfer: 100,
        consumerCredit: 0,
        corporateCash: 50,
        corporateTransfer: 100,
        corporateCredit: 0,
        quantity: Math.floor(3 + Math.random() * 5),
      },
      {
        category: "USIM" as const,
        consumerCash: 100,
        consumerTransfer: 50,
        consumerCredit: 0,
        corporateCash: 0,
        corporateTransfer: 50,
        corporateCredit: 0,
        quantity: Math.floor(1 + Math.random() * 3),
      },
    ]

    for (const cat of categories) {
      await prisma.dailyEntryCategory.create({
        data: {
          dailyEntryId: entry.id,
          ...cat,
        },
      })
    }

    // Calculate totals
    let totalCash = 0
    categories.forEach((c) => {
      totalCash += c.consumerCash + c.corporateCash
    })

    // Create cash drawer
    const openingCash = 2000
    const bankDeposits = totalCash > 3000 ? 2000 : 0
    const closingExpected = openingCash + totalCash - bankDeposits
    const variance = Math.floor((Math.random() - 0.5) * 100) // Small random variance

    await prisma.dailyEntryCashDrawer.create({
      data: {
        dailyEntryId: entry.id,
        opening: openingCash,
        bankDeposits,
        closingActual: closingExpected + variance,
        closingExpected,
        variance,
      },
    })

    // Create wallet data
    const walletOpening = 15000 - i * 1000
    const reloadSales = categories[1].consumerCash + categories[1].consumerTransfer + categories[1].consumerCredit +
      categories[1].corporateCash + categories[1].corporateTransfer + categories[1].corporateCredit +
      categories[2].consumerCash + categories[2].consumerTransfer + categories[2].consumerCredit +
      categories[2].corporateCash + categories[2].corporateTransfer + categories[2].corporateCredit
    const topupAmount = reloadSales > 2000 ? 3000 : 0
    const walletExpected = walletOpening + topupAmount - reloadSales
    const walletVariance = Math.floor((Math.random() - 0.5) * 50)

    await prisma.dailyEntryWallet.create({
      data: {
        dailyEntryId: entry.id,
        opening: walletOpening,
        openingSource: "PREVIOUS_DAY",
        closingActual: walletExpected + walletVariance,
        closingExpected: walletExpected,
        variance: walletVariance,
      },
    })

    // Create topup if needed
    if (topupAmount > 0) {
      await prisma.walletTopup.create({
        data: {
          date: entryDate,
          amount: topupAmount,
          source: "CASH",
          createdBy: sales.id,
        },
      })
    }

    dailyEntries.push(entry)
  }

  console.log("Created sample daily entries:", dailyEntries.length)

  // Create sample bank transactions
  const bankTxData = [
    { date: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000), type: "DEPOSIT" as const, amount: 2000, reference: "Daily Cash Deposit" },
    { date: new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000), type: "DEPOSIT" as const, amount: 2500, reference: "Daily Cash Deposit" },
    { date: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000), type: "WITHDRAWAL" as const, amount: 1000, reference: "Petty Cash" },
    { date: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), type: "DEPOSIT" as const, amount: 1800, reference: "Daily Cash Deposit" },
  ]

  let runningBalance = 5200 // Opening balance
  for (const tx of bankTxData) {
    if (tx.type === "DEPOSIT") {
      runningBalance += tx.amount
    } else {
      runningBalance -= tx.amount
    }
    await prisma.bankTransaction.create({
      data: {
        date: tx.date,
        type: tx.type,
        amount: tx.amount,
        reference: tx.reference,
        balanceAfter: runningBalance,
        createdBy: accountant.id,
      },
    })
  }

  console.log("Created sample bank transactions:", bankTxData.length)

  // Create sample credit transactions
  // Track balances per customer
  const customerBalances: Record<string, number> = {}
  customers.forEach((c) => (customerBalances[c.id] = 0))

  const creditTxData = [
    { customerId: customers[0].id, amount: 500, type: "CREDIT_SALE" as const, paymentMethod: null as null | "CASH" | "TRANSFER", date: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000) },
    { customerId: customers[2].id, amount: 1200, type: "CREDIT_SALE" as const, paymentMethod: null as null | "CASH" | "TRANSFER", date: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000) },
    { customerId: customers[0].id, amount: 300, type: "SETTLEMENT" as const, paymentMethod: "CASH" as null | "CASH" | "TRANSFER", date: new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000) },
    { customerId: customers[3].id, amount: 2500, type: "CREDIT_SALE" as const, paymentMethod: null as null | "CASH" | "TRANSFER", date: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000) },
    { customerId: customers[2].id, amount: 1000, type: "SETTLEMENT" as const, paymentMethod: "TRANSFER" as null | "CASH" | "TRANSFER", date: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000) },
  ]

  for (const tx of creditTxData) {
    // Update balance: CREDIT_SALE increases balance, SETTLEMENT decreases it
    if (tx.type === "CREDIT_SALE") {
      customerBalances[tx.customerId] += tx.amount
    } else {
      customerBalances[tx.customerId] -= tx.amount
    }

    await prisma.creditTransaction.create({
      data: {
        customerId: tx.customerId,
        amount: tx.amount,
        type: tx.type,
        paymentMethod: tx.paymentMethod,
        date: tx.date,
        balanceAfter: customerBalances[tx.customerId],
        createdBy: accountant.id,
      },
    })
  }

  console.log("Created sample credit transactions:", creditTxData.length)

  console.log("\n========================================")
  console.log("Database seeded successfully!")
  console.log("========================================")
  console.log("\nTest accounts:")
  console.log("  Owner:      username=owner, password=password123")
  console.log("  Accountant: username=accountant, password=password123")
  console.log("  Sales:      username=sales, password=password123")
  console.log("========================================\n")
}

main()
  .then(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    await pool.end()
    process.exit(1)
  })
