import { prisma } from "@/lib/db"
import type { PrismaClient } from "@prisma/client"

/**
 * Transaction client type — use this as parameter type for functions
 * that need to run inside a transaction.
 */
export type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]

/**
 * Run a callback inside a Prisma interactive transaction with
 * Serializable isolation (strongest guarantee against race conditions).
 *
 * Usage:
 *   const result = await withTransaction(async (tx) => {
 *     const balance = await tx.bankTransaction.findMany(...)
 *     return tx.bankTransaction.create(...)
 *   })
 */
export async function withTransaction<T>(
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(fn, {
    isolationLevel: "Serializable",
    timeout: 15000,
  })
}
