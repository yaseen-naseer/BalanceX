import { config } from "dotenv"
config()

import { PrismaClient } from "@prisma/client"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"

function parseConnectionString(url: string) {
  const regex = /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/
  const match = url.match(regex)
  if (!match) {
    throw new Error("Invalid DATABASE_URL format")
  }
  return {
    user: match[1],
    password: decodeURIComponent(match[2]),
    host: match[3],
    port: parseInt(match[4]),
    database: match[5],
  }
}

const connectionString = process.env.DATABASE_URL!
const pgConfig = parseConnectionString(connectionString)
const pool = new Pool(pgConfig)
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("Seeding Cash Float Settings...\n")

  // Create default float amounts
  const floatSettings = [
    { name: "Small Float", amount: 1000, isDefault: false },
    { name: "Standard Float", amount: 2000, isDefault: true },
    { name: "Weekend Float", amount: 5000, isDefault: false },
    { name: "Holiday Float", amount: 10000, isDefault: false },
  ]

  for (const setting of floatSettings) {
    const existing = await prisma.cashFloatSettings.findFirst({
      where: { name: setting.name },
    })

    if (!existing) {
      await prisma.cashFloatSettings.create({
        data: setting,
      })
      console.log(`✓ Created float setting: ${setting.name} (${setting.amount} MVR)`)
    } else {
      console.log(`✓ Float setting already exists: ${setting.name}`)
    }
  }

  // Create default shifts
  console.log("\nSeeding Shift Settings...\n")

  const shifts = [
    { name: "Morning", startTime: "08:00", endTime: "14:00", isDefault: true, sortOrder: 1 },
    { name: "Afternoon", startTime: "14:00", endTime: "20:00", isDefault: false, sortOrder: 2 },
    { name: "Evening", startTime: "20:00", endTime: "23:00", isDefault: false, sortOrder: 3 },
  ]

  for (const shift of shifts) {
    const existing = await prisma.shiftSettings.findFirst({
      where: { name: shift.name },
    })

    if (!existing) {
      await prisma.shiftSettings.create({
        data: shift,
      })
      console.log(`✓ Created shift: ${shift.name} (${shift.startTime} - ${shift.endTime})`)
    } else {
      console.log(`✓ Shift already exists: ${shift.name}`)
    }
  }

  console.log("\n========================================")
  console.log("Cash Float Settings Seeded Successfully!")
  console.log("========================================")
}

main()
  .catch((e) => {
    console.error("Error seeding cash float settings:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
