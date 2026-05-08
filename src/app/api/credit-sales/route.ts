import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/api-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { createCreditSaleSchema, validateRequestBody } from "@/lib/validations"
import { createAuditLog, getClientIpFromRequest, getUserAgentFromRequest } from "@/lib/audit"
import { checkWalletSufficiency } from "@/lib/utils/wallet-check"
import { withTransaction } from "@/lib/utils/atomic"
import { calculateCustomerOutstanding } from "@/lib/calculations/credit"
import { convertPrismaDecimals } from "@/lib/utils/serialize"
import { CURRENCY_CODE } from "@/lib/constants"
import { logError } from "@/lib/logger"
import { ApiErrors, successOk } from "@/lib/api-response"

// POST /api/credit-sales - Create a new credit sale
export async function POST(request: NextRequest) {
  // Use requirePermission instead of getAuthenticatedUser for proper authorization
  const auth = await requirePermission(PERMISSIONS.CREDIT_SALE_CREATE)
  if (auth.error) return auth.error

  // Verify user exists in database (handles stale sessions after db:clean)
  const userExists = await prisma.user.findUnique({
    where: { id: auth.user!.id },
    select: { id: true }
  })

  if (!userExists) {
    return ApiErrors.sessionExpired()
  }

  const isOwner = auth.user!.role === "OWNER"

  try {
    // Validate request body
    const validation = await validateRequestBody(request, createCreditSaleSchema)
    if ("error" in validation) return validation.error
    const { dailyEntryId, customerId: directCustomerId, wholesaleCustomerId, amount, cashAmount, discountPercent, reference, category, overrideLimit } = validation.data

    // Resolve the credit customer
    let customerId: string
    let wholesaleCustomer: { id: string; name: string; phone: string; discountOverride: unknown; isActive: boolean } | null = null

    if (wholesaleCustomerId) {
      // Wholesale flow: look up wholesale customer, then find/create credit customer
      wholesaleCustomer = await prisma.wholesaleCustomer.findUnique({
        where: { id: wholesaleCustomerId },
        select: { id: true, name: true, phone: true, businessName: true, discountOverride: true, isActive: true },
      })

      if (!wholesaleCustomer) {
        return ApiErrors.notFound("Wholesale customer")
      }

      // B7: Reject credit sales for deactivated wholesale customers
      if (!wholesaleCustomer.isActive) {
        return ApiErrors.badRequest("Wholesale customer is deactivated")
      }

      // Find or create a matching CreditCustomer by phone
      let creditCustomer = await prisma.creditCustomer.findFirst({
        where: { phone: wholesaleCustomer.phone },
      })

      if (!creditCustomer) {
        creditCustomer = await prisma.creditCustomer.create({
          data: {
            name: wholesaleCustomer.name,
            type: "CONSUMER",
            phone: wholesaleCustomer.phone,
            creditLimit: null,
          },
        })
      }

      customerId = creditCustomer.id
    } else if (directCustomerId) {
      customerId = directCustomerId
    } else {
      return ApiErrors.badRequest("Customer ID or wholesale customer ID is required")
    }

    // Get customer details for credit limit check
    const customer = await prisma.creditCustomer.findUnique({
      where: { id: customerId },
    })

    if (!customer) {
      return ApiErrors.notFound("Customer")
    }

    if (!customer.isActive) {
      return ApiErrors.badRequest("Customer is inactive")
    }

    // If overrideLimit is sent by non-Owner, reject it early (security check)
    if (overrideLimit && !isOwner) {
      return ApiErrors.forbidden("Only Owner can override credit limits")
    }

    // Get daily entry to verify it exists and get date
    const dailyEntry = await prisma.dailyEntry.findUnique({
      where: { id: dailyEntryId },
    })

    if (!dailyEntry) {
      return ApiErrors.notFound("Daily entry")
    }

    // For wholesale credit, the credit balance tracks cashAmount (what customer owes)
    // For regular credit, it tracks amount
    const creditBalanceAmount = cashAmount ?? amount

    // Atomic: credit balance check + wallet check + sale + transaction + line item creation
    // All inside a single Serializable transaction to prevent race conditions (S2, S3, S11)
    let creditSale: Awaited<ReturnType<typeof prisma.creditSale.create>>
    let limitExceeded = false
    let limitAmount = 0
    let outstandingBalance = 0
    let newBalance = 0

    try {
      const result = await withTransaction(async (tx) => {
        // Calculate current outstanding balance (inside transaction for atomicity — S3)
        const outstanding = await calculateCustomerOutstanding(customerId, tx)

        const balance = outstanding + creditBalanceAmount
        let exceeded = false
        let limit = 0

        if (customer.creditLimit !== null && balance > Number(customer.creditLimit)) {
          exceeded = true
          limit = Number(customer.creditLimit)
        }

        // Enforce credit limit for non-Owner users
        if (exceeded && !isOwner && !overrideLimit) {
          throw {
            type: "CREDIT_LIMIT_EXCEEDED",
            outstanding,
            balance,
            limit,
          }
        }

        // Check wallet balance for wholesale credit sales (inside transaction — S2)
        if (category === "WHOLESALE_RELOAD") {
          const walletError = await checkWalletSufficiency("WHOLESALE_RELOAD", amount, tx)
          if (walletError) {
            throw { type: "WALLET_INSUFFICIENT", message: walletError }
          }
        }

        // Create corresponding credit transaction first (S11 — atomic with sale)
        const overrideNote = exceeded && isOwner
          ? `LIMIT_OVERRIDE: Approved by ${auth.user!.name || auth.user!.username} (exceeded by ${(balance - limit).toLocaleString()} ${CURRENCY_CODE})`
          : null

        const creditTx = await tx.creditTransaction.create({
          data: {
            customerId,
            type: "CREDIT_SALE",
            amount: creditBalanceAmount,
            date: dailyEntry.date,
            balanceAfter: balance,
            reference: reference || null,
            notes: overrideNote,
            createdBy: auth.user!.id,
          },
        })

        // Create the credit sale with FK to transaction (B1)
        const sale = await tx.creditSale.create({
          data: {
            dailyEntryId,
            customerId,
            wholesaleCustomerId: wholesaleCustomerId ?? null,
            creditTransactionId: creditTx.id,
            category: category || "DHIRAAGU_BILLS",
            amount,
            cashAmount: cashAmount ?? null,
            discountPercent: discountPercent ?? null,
            reference: reference || null,
          },
          include: {
            customer: { select: { id: true, name: true, type: true, creditLimit: true } },
          },
        })

        // For wholesale credit sales: create SaleLineItem with FK to credit sale (B2, S11 — atomic)
        if (category === "WHOLESALE_RELOAD" && wholesaleCustomerId) {
          await tx.saleLineItem.create({
            data: {
              dailyEntryId,
              category: "WHOLESALE_RELOAD",
              customerType: customer.type,
              paymentMethod: "CREDIT",
              amount,
              cashAmount: cashAmount ?? null,
              discountPercent: discountPercent ?? null,
              wholesaleCustomerId,
              creditSaleId: sale.id,
              note: `Credit sale #${sale.id}`,
              createdBy: auth.user!.id,
            },
          })

          // Sync the category cell total (grid shows cash received)
          const fieldName = customer.type === "CONSUMER" ? "consumerCredit" : "corporateCredit"
          const items = await tx.saleLineItem.findMany({
            where: { dailyEntryId, category: "WHOLESALE_RELOAD", customerType: customer.type, paymentMethod: "CREDIT" },
            select: { cashAmount: true, amount: true },
          })
          const cellTotal = items.reduce((sum, item) => sum + Number(item.cashAmount ?? item.amount), 0)
          await tx.dailyEntryCategory.upsert({
            where: { dailyEntryId_category: { dailyEntryId, category: "WHOLESALE_RELOAD" } },
            update: { [fieldName]: cellTotal },
            create: { dailyEntryId, category: "WHOLESALE_RELOAD", [fieldName]: cellTotal },
          })
        }

        return { sale, exceeded, limit, outstanding, balance }
      })

      creditSale = result.sale
      limitExceeded = result.exceeded
      limitAmount = result.limit
      outstandingBalance = result.outstanding
      newBalance = result.balance
    } catch (err: unknown) {
      // Handle structured errors from inside the transaction
      if (err && typeof err === "object" && "type" in err) {
        const typed = err as { type: string; outstanding?: number; balance?: number; limit?: number; message?: string }
        if (typed.type === "CREDIT_LIMIT_EXCEEDED") {
          return NextResponse.json(
            {
              success: false,
              error: "Credit limit exceeded. Owner approval required.",
              requiresOwnerApproval: true,
              limitDetails: {
                currentBalance: typed.outstanding,
                saleAmount: creditBalanceAmount,
                newBalance: typed.balance,
                creditLimit: typed.limit,
                exceededBy: (typed.balance ?? 0) - (typed.limit ?? 0),
              },
            },
            { status: 403 }
          )
        }
        if (typed.type === "WALLET_INSUFFICIENT") {
          return ApiErrors.badRequest(typed.message ?? "Wallet has insufficient balance")
        }
      }
      throw err
    }

    // Log credit sale
    await createAuditLog({
      action: "CREDIT_SALE_ADDED",
      userId: auth.user!.id,
      targetId: creditSale.id,
      details: {
        customerId,
        customerName: customer.name,
        amount,
        reference: reference || null,
        dailyEntryId,
      },
      ipAddress: getClientIpFromRequest(request),
      userAgent: getUserAgentFromRequest(request),
    })

    // Log credit limit override in audit trail
    if (limitExceeded && isOwner) {
      await createAuditLog({
        action: "CREDIT_LIMIT_OVERRIDE",
        userId: auth.user!.id,
        targetId: customerId,
        details: {
          customerId,
          customerName: customer.name,
          creditLimit: limitAmount,
          previousBalance: outstandingBalance,
          saleAmount: amount,
          newBalance,
          exceededBy: newBalance - limitAmount,
          creditSaleId: creditSale.id,
        },
        ipAddress: getClientIpFromRequest(request),
        userAgent: getUserAgentFromRequest(request),
      })
    }

    // Domain extension: success envelope carries `limitOverridden` + `warning` so
    // the credit-sale-dialog can surface owner-override info via a toast. Read by
    // [src/components/credit/credit-sale-dialog.tsx] alongside `result.data`.
    return NextResponse.json({
      success: true,
      data: convertPrismaDecimals(creditSale),
      limitOverridden: limitExceeded && isOwner,
      warning: limitExceeded
        ? `Credit limit of ${limitAmount.toLocaleString()} ${CURRENCY_CODE} exceeded (Owner override). New balance: ${newBalance.toLocaleString()} ${CURRENCY_CODE}`
        : null,
    })
  } catch (error) {
    logError("Error creating credit sale", error)
    return ApiErrors.serverError("Failed to create credit sale")
  }
}

// DELETE /api/credit-sales - Delete a credit sale (Owner/Accountant only)
export async function DELETE(request: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.CREDIT_SALE_DELETE)
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return ApiErrors.badRequest("Credit sale ID is required")
    }

    let reason: string | null = null
    try {
      const body = await request.json()
      reason = body?.reason ?? null
    } catch {
      // no body is fine
    }

    // Get the credit sale first
    const creditSale = await prisma.creditSale.findUnique({
      where: { id },
      include: {
        customer: true,
        dailyEntry: true,
      },
    })

    if (!creditSale) {
      return ApiErrors.notFound("Credit sale")
    }

    // Delete linked records using FKs (B1, B2) then the credit sale itself — atomically
    const transactionOps = [
      // Delete the linked sale line item by FK (B2 — replaces fuzzy note matching)
      prisma.saleLineItem.deleteMany({
        where: { creditSaleId: id },
      }),
      // Delete the credit sale (this nullifies the FK on CreditTransaction since it's optional)
      prisma.creditSale.delete({
        where: { id },
      }),
      // Delete the corresponding credit transaction by FK (B1 — replaces fuzzy matching)
      ...(creditSale.creditTransactionId
        ? [prisma.creditTransaction.delete({ where: { id: creditSale.creditTransactionId } })]
        : [
            // Fallback for legacy sales created before B1 FK was added
            prisma.creditTransaction.deleteMany({
              where: {
                customerId: creditSale.customerId,
                type: "CREDIT_SALE",
                amount: creditSale.amount,
                date: creditSale.dailyEntry.date,
              },
            }),
          ]),
    ]

    await prisma.$transaction(transactionOps)

    // If it was a wholesale credit sale, sync the cell total
    if (creditSale.category === "WHOLESALE_RELOAD" && creditSale.wholesaleCustomerId) {
      const customerType = creditSale.customer.type
      const fieldName = customerType === "CONSUMER" ? "consumerCredit" : "corporateCredit"
      const items = await prisma.saleLineItem.findMany({
        where: {
          dailyEntryId: creditSale.dailyEntryId,
          category: "WHOLESALE_RELOAD",
          customerType,
          paymentMethod: "CREDIT",
        },
        select: { cashAmount: true, amount: true },
      })
      const cellTotal = items.reduce((sum, item) => sum + Number(item.cashAmount ?? item.amount), 0)
      await prisma.dailyEntryCategory.upsert({
        where: { dailyEntryId_category: { dailyEntryId: creditSale.dailyEntryId, category: "WHOLESALE_RELOAD" } },
        update: { [fieldName]: cellTotal },
        create: { dailyEntryId: creditSale.dailyEntryId, category: "WHOLESALE_RELOAD", [fieldName]: cellTotal },
      })
    }

    await createAuditLog({
      action: "CREDIT_SALE_DELETED",
      userId: auth.user!.id,
      targetId: id,
      details: {
        customerId: creditSale.customerId,
        customerName: creditSale.customer.name,
        amount: Number(creditSale.amount),
        dailyEntryId: creditSale.dailyEntryId,
        reason: reason ?? "No reason provided",
      },
      ipAddress: getClientIpFromRequest(request),
      userAgent: getUserAgentFromRequest(request),
    })

    return successOk()
  } catch (error) {
    logError("Error deleting credit sale", error)
    return ApiErrors.serverError("Failed to delete credit sale")
  }
}
