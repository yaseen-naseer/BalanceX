import { prisma } from "@/lib/db"
import type { TxClient } from "@/lib/utils/atomic"

/**
 * Compute the current bank balance: opening + sum(deposits) − sum(withdrawals).
 * Two parallel `aggregate` queries instead of reading every row + iterating in JS.
 *
 * This is the balance AFTER all currently-recorded txs, regardless of their
 * chronological order. Backdated inserts using this value as `balanceAfter`
 * for the new row must still call `recalculateBankBalances` afterwards to fix
 * per-tx running balances.
 */
export async function getCurrentBankBalance(tx?: TxClient): Promise<number> {
  const client = tx ?? prisma
  const [settings, deposits, withdrawals] = await Promise.all([
    client.bankSettings.findFirst({ orderBy: { openingDate: "desc" } }),
    client.bankTransaction.aggregate({ _sum: { amount: true }, where: { type: "DEPOSIT" } }),
    client.bankTransaction.aggregate({ _sum: { amount: true }, where: { type: "WITHDRAWAL" } }),
  ])
  const opening = settings ? Number(settings.openingBalance) : 0
  return opening + Number(deposits._sum.amount ?? 0) - Number(withdrawals._sum.amount ?? 0)
}

/**
 * Recalculate running `balanceAfter` for every bank transaction, ordered by
 * date then createdAt. Use this when:
 *   - Bootstrapping or repairing balances (self-heals any prior corruption).
 *   - You don't have an anchor date for the change (ambiguous mutation).
 *
 * For routine create/update/delete flows where the affected date IS known,
 * prefer `recalculateBankBalancesFrom(anchorDate, tx)` — same correctness
 * guarantee, but only touches rows from the anchor onwards.
 *
 * - Without `tx`: batches updates inside its own `$transaction`.
 * - With `tx`: applies updates sequentially inside the caller's transaction
 *   (Prisma forbids nesting `$transaction` on a transaction client).
 */
export async function recalculateBankBalances(tx?: TxClient): Promise<void> {
  const client = tx ?? prisma

  const settings = await client.bankSettings.findFirst({
    orderBy: { openingDate: "desc" },
  })

  const allTransactions = await client.bankTransaction.findMany({
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  })

  let running = settings ? Number(settings.openingBalance) : 0
  const updates: { id: string; balanceAfter: number }[] = []

  for (const t of allTransactions) {
    running += t.type === "DEPOSIT" ? Number(t.amount) : -Number(t.amount)
    if (Number(t.balanceAfter) !== running) {
      updates.push({ id: t.id, balanceAfter: running })
    }
  }

  if (updates.length === 0) return

  if (tx) {
    for (const u of updates) {
      await tx.bankTransaction.update({
        where: { id: u.id },
        data: { balanceAfter: u.balanceAfter },
      })
    }
  } else {
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
 * Recalculate `balanceAfter` for every bank transaction with `date >= anchorDate`.
 * The running balance is seeded with `opening + sum(txs with date < anchorDate)`
 * via two parallel `aggregate` queries — no need to iterate prior history.
 *
 * Same correctness contract as `recalculateBankBalances` — for any mutation
 * (create, update, or delete) at `anchorDate`, all affected per-row balances
 * are made consistent.
 *
 * **Caveat:** assumes per-row `balanceAfter` for txs strictly before `anchorDate`
 * is already correct. If the DB has prior corruption, those rows are NOT healed.
 * Call `recalculateBankBalances()` (full) for a one-shot self-heal pass.
 *
 * Same-day txs that precede the anchor in `createdAt` order get re-iterated but
 * the diff check below skips no-op writes, so this costs only an extra read.
 */
export async function recalculateBankBalancesFrom(
  anchorDate: Date,
  tx?: TxClient,
): Promise<void> {
  const client = tx ?? prisma

  const [settings, priorDeposits, priorWithdrawals] = await Promise.all([
    client.bankSettings.findFirst({ orderBy: { openingDate: "desc" } }),
    client.bankTransaction.aggregate({
      _sum: { amount: true },
      where: { type: "DEPOSIT", date: { lt: anchorDate } },
    }),
    client.bankTransaction.aggregate({
      _sum: { amount: true },
      where: { type: "WITHDRAWAL", date: { lt: anchorDate } },
    }),
  ])

  let running =
    (settings ? Number(settings.openingBalance) : 0)
    + Number(priorDeposits._sum.amount ?? 0)
    - Number(priorWithdrawals._sum.amount ?? 0)

  const sliceTxs = await client.bankTransaction.findMany({
    where: { date: { gte: anchorDate } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  })

  const updates: { id: string; balanceAfter: number }[] = []
  for (const t of sliceTxs) {
    running += t.type === "DEPOSIT" ? Number(t.amount) : -Number(t.amount)
    if (Number(t.balanceAfter) !== running) {
      updates.push({ id: t.id, balanceAfter: running })
    }
  }

  if (updates.length === 0) return

  if (tx) {
    for (const u of updates) {
      await tx.bankTransaction.update({
        where: { id: u.id },
        data: { balanceAfter: u.balanceAfter },
      })
    }
  } else {
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
        await recalculateBankBalancesFrom(entryDate)
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

      await recalculateBankBalancesFrom(entryDate)
    }
  } else {
    // bankDeposits removed or zero — clean up the auto-created transaction
    if (existing) {
      await prisma.bankTransaction.delete({ where: { id: existing.id } })
      await recalculateBankBalancesFrom(entryDate)
    }
  }
}
