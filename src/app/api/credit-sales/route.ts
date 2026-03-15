import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/api-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { createCreditSaleSchema, validateRequestBody } from "@/lib/validations"
import { createAuditLog, getClientIpFromRequest, getUserAgentFromRequest } from "@/lib/audit"
import { checkWalletSufficiency } from "@/lib/utils/wallet-check"

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
    return NextResponse.json(
      { success: false, error: "Session expired. Please logout and login again." },
      { status: 401 }
    )
  }

  const isOwner = auth.user!.role === "OWNER"

  try {
    // Validate request body
    const validation = await validateRequestBody(request, createCreditSaleSchema)
    if ("error" in validation) return validation.error
    const { dailyEntryId, customerId: directCustomerId, wholesaleCustomerId, amount, cashAmount, discountPercent, reference, category, overrideLimit } = validation.data

    // Resolve the credit customer
    let customerId: string
    let wholesaleCustomer: { id: string; name: string; phone: string; discountOverride: unknown } | null = null

    if (wholesaleCustomerId) {
      // Wholesale flow: look up wholesale customer, then find/create credit customer
      wholesaleCustomer = await prisma.wholesaleCustomer.findUnique({
        where: { id: wholesaleCustomerId },
        select: { id: true, name: true, phone: true, businessName: true, discountOverride: true, isActive: true },
      })

      if (!wholesaleCustomer) {
        return NextResponse.json(
          { success: false, error: "Wholesale customer not found" },
          { status: 404 }
        )
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
      return NextResponse.json(
        { success: false, error: "Customer ID or wholesale customer ID is required" },
        { status: 400 }
      )
    }

    // Get customer details for credit limit check
    const customer = await prisma.creditCustomer.findUnique({
      where: { id: customerId },
    })

    if (!customer) {
      return NextResponse.json(
        { success: false, error: "Customer not found" },
        { status: 404 }
      )
    }

    if (!customer.isActive) {
      return NextResponse.json(
        { success: false, error: "Customer is inactive" },
        { status: 400 }
      )
    }

    // Calculate current outstanding balance
    const transactions = await prisma.creditTransaction.findMany({
      where: { customerId },
    })

    const outstandingBalance = transactions.reduce((sum, tx) => {
      if (tx.type === "CREDIT_SALE") {
        return sum + Number(tx.amount)
      } else {
        return sum - Number(tx.amount)
      }
    }, 0)

    // For wholesale credit, the credit balance tracks cashAmount (what customer owes)
    // For regular credit, it tracks amount
    const creditBalanceAmount = cashAmount ?? amount

    // Check credit limit
    const newBalance = outstandingBalance + creditBalanceAmount
    let limitExceeded = false
    let limitAmount = 0

    if (customer.creditLimit !== null && newBalance > Number(customer.creditLimit)) {
      limitExceeded = true
      limitAmount = Number(customer.creditLimit)
    }

    // Enforce credit limit for non-Owner users
    // Only Owner can override credit limits
    if (limitExceeded && !isOwner && !overrideLimit) {
      return NextResponse.json(
        {
          success: false,
          error: "Credit limit exceeded. Owner approval required.",
          requiresOwnerApproval: true,
          limitDetails: {
            currentBalance: outstandingBalance,
            saleAmount: creditBalanceAmount,
            newBalance,
            creditLimit: limitAmount,
            exceededBy: newBalance - limitAmount,
          },
        },
        { status: 403 }
      )
    }

    // If overrideLimit is sent by non-Owner, reject it (security check)
    if (overrideLimit && !isOwner) {
      return NextResponse.json(
        { success: false, error: "Only Owner can override credit limits" },
        { status: 403 }
      )
    }

    // Get daily entry to verify it exists and get date
    const dailyEntry = await prisma.dailyEntry.findUnique({
      where: { id: dailyEntryId },
    })

    if (!dailyEntry) {
      return NextResponse.json(
        { success: false, error: "Daily entry not found" },
        { status: 404 }
      )
    }

    // Check wallet balance for wholesale credit sales
    if (category === "WHOLESALE_RELOAD") {
      const walletError = await checkWalletSufficiency("WHOLESALE_RELOAD", amount)
      if (walletError) {
        return NextResponse.json(
          { success: false, error: walletError },
          { status: 400 }
        )
      }
    }

    // Create the credit sale
    const creditSale = await prisma.creditSale.create({
      data: {
        dailyEntryId,
        customerId,
        wholesaleCustomerId: wholesaleCustomerId ?? null,
        category: category || "DHIRAAGU_BILLS",
        amount, // reload amount for wholesale, regular amount otherwise
        cashAmount: cashAmount ?? null,
        discountPercent: discountPercent ?? null,
        reference: reference || null,
      },
      include: {
        customer: { select: { id: true, name: true, type: true, creditLimit: true } },
      },
    })

    // Create corresponding credit transaction
    // Track limit override in notes if applicable
    const overrideNote = limitExceeded && isOwner
      ? `LIMIT_OVERRIDE: Approved by ${auth.user!.name || auth.user!.username} (exceeded by ${(newBalance - limitAmount).toLocaleString()} MVR)`
      : null

    await prisma.creditTransaction.create({
      data: {
        customerId,
        type: "CREDIT_SALE",
        amount: creditBalanceAmount, // cashAmount for wholesale (what they owe), amount for regular
        date: dailyEntry.date,
        balanceAfter: newBalance,
        reference: reference || null,
        notes: overrideNote,
        createdBy: auth.user!.id,
      },
    })

    // For wholesale credit sales: create a SaleLineItem so wallet calculations include the reload
    if (category === "WHOLESALE_RELOAD" && wholesaleCustomerId) {
      await prisma.saleLineItem.create({
        data: {
          dailyEntryId,
          category: "WHOLESALE_RELOAD",
          customerType: customer.type,
          paymentMethod: "CREDIT",
          amount, // reload amount (wallet deduction)
          cashAmount: cashAmount ?? null,
          discountPercent: discountPercent ?? null,
          wholesaleCustomerId,
          note: `Credit sale #${creditSale.id}`,
          createdBy: auth.user!.id,
        },
      })

      // Sync the category cell total (grid shows cash received)
      const fieldName = customer.type === "CONSUMER" ? "consumerCredit" : "corporateCredit"
      const items = await prisma.saleLineItem.findMany({
        where: { dailyEntryId, category: "WHOLESALE_RELOAD", customerType: customer.type, paymentMethod: "CREDIT" },
        select: { cashAmount: true, amount: true },
      })
      const cellTotal = items.reduce((sum, item) => sum + Number(item.cashAmount ?? item.amount), 0)
      await prisma.dailyEntryCategory.upsert({
        where: { dailyEntryId_category: { dailyEntryId, category: "WHOLESALE_RELOAD" } },
        update: { [fieldName]: cellTotal },
        create: { dailyEntryId, category: "WHOLESALE_RELOAD", [fieldName]: cellTotal },
      })
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

    return NextResponse.json({
      success: true,
      data: creditSale,
      limitOverridden: limitExceeded && isOwner,
      warning: limitExceeded
        ? `Credit limit of ${limitAmount.toLocaleString()} MVR exceeded (Owner override). New balance: ${newBalance.toLocaleString()} MVR`
        : null,
    })
  } catch (error) {
    console.error("Error creating credit sale:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create credit sale" },
      { status: 500 }
    )
  }
}

// DELETE /api/credit-sales - Delete a credit sale
export async function DELETE(request: NextRequest) {
  // Use requirePermission for proper authorization
  const auth = await requirePermission(PERMISSIONS.CREDIT_SALE_CREATE)
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Credit sale ID is required" },
        { status: 400 }
      )
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
      return NextResponse.json(
        { success: false, error: "Credit sale not found" },
        { status: 404 }
      )
    }

    // Delete the credit sale, credit transaction, and any linked sale line item atomically
    const transactionOps = [
      // Delete the corresponding credit transaction to avoid orphaned records
      prisma.creditTransaction.deleteMany({
        where: {
          customerId: creditSale.customerId,
          type: "CREDIT_SALE",
          amount: creditSale.amount,
          date: creditSale.dailyEntry.date,
          // Reference should match the credit sale ID or be null
          OR: [
            { reference: creditSale.reference },
            { reference: id },
            { reference: null },
          ],
        },
      }),
      // Delete linked wholesale sale line item (note contains credit sale ID)
      prisma.saleLineItem.deleteMany({
        where: {
          dailyEntryId: creditSale.dailyEntryId,
          category: "WHOLESALE_RELOAD",
          paymentMethod: "CREDIT",
          note: `Credit sale #${id}`,
        },
      }),
      // Delete the credit sale
      prisma.creditSale.delete({
        where: { id },
      }),
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting credit sale:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete credit sale" },
      { status: 500 }
    )
  }
}
