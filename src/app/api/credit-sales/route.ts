import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/api-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { createCreditSaleSchema, validateRequestBody } from "@/lib/validations"
import { createAuditLog, getClientIpFromRequest, getUserAgentFromRequest } from "@/lib/audit"

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
    const { dailyEntryId, customerId, amount, reference, overrideLimit } = validation.data

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

    // Check credit limit
    const newBalance = outstandingBalance + amount
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
            saleAmount: amount,
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

    // Enforce grid credit cap per customer type
    const [entryCategory, existingSalesOfType] = await Promise.all([
      prisma.dailyEntryCategory.findFirst({
        where: { dailyEntryId, category: "DHIRAAGU_BILLS" },
        select: { consumerCredit: true, corporateCredit: true },
      }),
      prisma.creditSale.findMany({
        where: { dailyEntryId },
        include: { customer: { select: { type: true } } },
      }),
    ])

    const gridCreditForType =
      customer.type === "CONSUMER"
        ? Number(entryCategory?.consumerCredit ?? 0)
        : Number(entryCategory?.corporateCredit ?? 0)

    const alreadyLinkedOfType = existingSalesOfType
      .filter((s) => s.customer.type === customer.type)
      .reduce((sum, s) => sum + Number(s.amount), 0)

    const remaining = gridCreditForType - alreadyLinkedOfType

    if (amount > remaining) {
      const typeLabel = customer.type === "CONSUMER" ? "consumer" : "corporate"
      return NextResponse.json(
        {
          success: false,
          error: `Amount exceeds available ${typeLabel} credit in the grid. Available: ${Math.max(0, remaining).toLocaleString()} MVR.`,
        },
        { status: 400 }
      )
    }

    // Create the credit sale
    const creditSale = await prisma.creditSale.create({
      data: {
        dailyEntryId,
        customerId,
        amount,
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
        amount,
        date: dailyEntry.date,
        balanceAfter: newBalance,
        reference: reference || null,
        notes: overrideNote,
        createdBy: auth.user!.id,
      },
    })

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

    // Delete the credit sale and corresponding credit transaction atomically
    await prisma.$transaction([
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
      // Delete the credit sale
      prisma.creditSale.delete({
        where: { id },
      }),
    ])

    await createAuditLog({
      action: "CREDIT_SALE_DELETED",
      userId: auth.user!.id,
      targetId: id,
      details: {
        customerId: creditSale.customerId,
        customerName: creditSale.customer.name,
        amount: Number(creditSale.amount),
        dailyEntryId: creditSale.dailyEntryId,
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
