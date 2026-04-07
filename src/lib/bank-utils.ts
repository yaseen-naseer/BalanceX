import { prisma } from "@/lib/db"

/**
 * Recalculate running `balanceAfter` for every bank transaction, ordered by
 * date then createdAt. Call this after any insert, update, or delete.
 */
export async function recalculateBankBalances(): Promise<void> {
  const settings = await prisma.bankSettings.findFirst({
    orderBy: { openingDate: "desc" },
  })

  const allTransactions = await prisma.bankTransaction.findMany({
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  })

  let running = settings ? Number(settings.openingBalance) : 0

  // Collect updates needed, then batch them in a single transaction
  const updates: { id: string; balanceAfter: number }[] = []

  for (const tx of allTransactions) {
    running += tx.type === "DEPOSIT" ? Number(tx.amount) : -Number(tx.amount)

    if (Number(tx.balanceAfter) !== running) {
      updates.push({ id: tx.id, balanceAfter: running })
    }
  }

  if (updates.length > 0) {
    await prisma.$transaction(
      updates.map((u) =>
        prisma.bankTransaction.update({
          where: { id: u.id },
          data: { balanceAfter: u.balanceAfter },
        })
      )
    )
  }
}

/**
 * Keep the bank ledger in sync with the `bankDeposits` field on a daily entry.
 *
 * - amount > 0  → upsert a DEPOSIT transaction tagged with `dailyEntryDate`
 * - amount === 0 → delete the tagged transaction if one exists
 *
 * Running balances are recalculated after any change.
 */
export async function syncDailyEntryBankDeposit(
  entryDate: Date,
  amount: number,
  userId: string
): Promise<void> {
  const dateStr = entryDate.toISOString().slice(0, 10) // "YYYY-MM-DD"
  const reference = `Daily Entry – ${dateStr}`

  const existing = await prisma.bankTransaction.findFirst({
    where: { dailyEntryDate: dateStr },
  })

  if (amount > 0) {
    if (existing) {
      // Update only if amount changed (reference always stays the same)
      if (Number(existing.amount) !== amount) {
        await prisma.bankTransaction.update({
          where: { id: existing.id },
          data: { amount },
        })
        await recalculateBankBalances()
      }
      // No change — skip recalculation
    } else {
      // Calculate balance immediately before the new transaction's date
      const settings = await prisma.bankSettings.findFirst({
        orderBy: { openingDate: "desc" },
      })

      const prior = await prisma.bankTransaction.findMany({
        where: { date: { lte: entryDate } },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      })

      let balanceBefore = settings ? Number(settings.openingBalance) : 0
      for (const tx of prior) {
        balanceBefore += tx.type === "DEPOSIT" ? Number(tx.amount) : -Number(tx.amount)
      }

      await prisma.bankTransaction.create({
        data: {
          type: "DEPOSIT",
          amount,
          reference,
          date: entryDate,
          createdBy: userId,
          balanceAfter: balanceBefore + amount,
          dailyEntryDate: dateStr,
        },
      })

      await recalculateBankBalances()
    }
  } else {
    // bankDeposits removed or zero — clean up the auto-created transaction
    if (existing) {
      await prisma.bankTransaction.delete({ where: { id: existing.id } })
      await recalculateBankBalances()
    }
  }
}
