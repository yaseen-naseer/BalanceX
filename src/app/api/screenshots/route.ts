import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"
import { ApiErrors, errorResponse } from "@/lib/api-response"
import { writeFile, mkdir, unlink } from "fs/promises"
import { join, resolve } from "path"
import { existsSync } from "fs"
import { randomBytes } from "crypto"
import { logError } from "@/lib/logger"
import { createAuditLog } from "@/lib/audit"

// POST - Upload a screenshot for a specific date
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return ApiErrors.unauthorized()
    }

    // Only Owner and Accountant can upload screenshots
    if (session.user.role === "SALES") {
      return ApiErrors.forbidden("Only Owner and Accountant can upload screenshots")
    }

    // Verify user exists in database (handles stale sessions after db:clean)
    const userExists = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true }
    })

    if (!userExists) {
      return ApiErrors.sessionExpired()
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const date = formData.get("date") as string | null

    if (!file || !date) {
      return ApiErrors.badRequest("File and date are required")
    }

    // Validate file type by MIME type
    const validMimeTypes = ["image/jpeg", "image/jpg", "image/png"]
    if (!validMimeTypes.includes(file.type)) {
      return ApiErrors.badRequest("Only JPG and PNG files are allowed")
    }

    // Validate and sanitize file extension - SECURITY FIX
    const allowedExtensions = ["jpg", "jpeg", "png"]
    const rawExt = file.name.split(".").pop()?.toLowerCase()
    if (!rawExt || !allowedExtensions.includes(rawExt)) {
      return ApiErrors.badRequest("Invalid file extension. Only jpg, jpeg, and png allowed")
    }
    // Use validated extension
    const ext = rawExt

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return ApiErrors.badRequest("File size must be less than 10MB")
    }

    // Validate date format to prevent path traversal - SECURITY FIX
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      return ApiErrors.badRequest("Invalid date format. Expected YYYY-MM-DD")
    }

    // Validate it's an actual valid date
    const parsedDate = new Date(date)
    if (isNaN(parsedDate.getTime())) {
      return ApiErrors.badRequest("Invalid date")
    }

    // Get daily entry for this date
    const dailyEntry = await prisma.dailyEntry.findUnique({
      where: { date: parsedDate },
      include: { screenshot: true },
    })

    if (!dailyEntry) {
      return errorResponse("No daily entry found for this date", 404)
    }

    // Block replacement of verified screenshots
    if (dailyEntry.screenshot?.isVerified) {
      return ApiErrors.badRequest("Cannot replace a verified screenshot")
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), "public", "uploads", "screenshots")
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // S13: Generate unpredictable filename using crypto random bytes
    const filename = `${date}-${randomBytes(16).toString("hex")}.${ext}`
    const filepath = join(uploadsDir, filename)

    // S13: Validate resolved path stays within uploads directory
    const resolvedPath = resolve(filepath)
    const resolvedUploadsDir = resolve(uploadsDir)
    if (!resolvedPath.startsWith(resolvedUploadsDir)) {
      return ApiErrors.badRequest("Invalid file path")
    }

    // Save file to disk
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

    // Delete old screenshot if exists
    if (dailyEntry.screenshot) {
      await prisma.telcoScreenshot.delete({
        where: { id: dailyEntry.screenshot.id },
      })
    }

    // Create new screenshot record
    const screenshot = await prisma.telcoScreenshot.create({
      data: {
        dailyEntryId: dailyEntry.id,
        filename,
        filepath: `/api/uploads/screenshots/${filename}`,
        mimeType: file.type,
        fileSize: file.size,
        uploadedBy: session.user.id,
      },
    })

    await createAuditLog({
      action: "SCREENSHOT_UPLOADED",
      userId: session.user.id,
      targetId: screenshot.id,
      details: { date, filename, dailyEntryId: dailyEntry.id },
    })

    return NextResponse.json(screenshot, { status: 201 })
  } catch (error) {
    logError("Error uploading screenshot", error)
    return ApiErrors.serverError("Failed to upload screenshot")
  }
}

// GET - Get screenshot for a date
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return ApiErrors.unauthorized()
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date")

    if (!date) {
      return ApiErrors.badRequest("Date is required")
    }

    // Validate date
    const parsedDate = new Date(date)
    if (isNaN(parsedDate.getTime())) {
      return ApiErrors.badRequest("Invalid date format")
    }

    const dailyEntry = await prisma.dailyEntry.findUnique({
      where: { date: parsedDate },
      include: {
        screenshot: {
          include: {
            uploader: {
              select: { id: true, name: true },
            },
          },
        },
      },
    })

    if (!dailyEntry || !dailyEntry.screenshot) {
      return NextResponse.json({ success: true, data: null })
    }

    const screenshot = dailyEntry.screenshot
    // Normalize old static paths to API paths
    const filepath = screenshot.filepath.startsWith("/uploads/")
      ? screenshot.filepath.replace("/uploads/", "/api/uploads/")
      : screenshot.filepath

    if (screenshot.verifiedBy) {
      const verifier = await prisma.user.findUnique({
        where: { id: screenshot.verifiedBy },
        select: { name: true },
      })
      return NextResponse.json({
        success: true,
        data: { ...screenshot, filepath, verifiedBy: verifier?.name || null },
      })
    }

    return NextResponse.json({ success: true, data: { ...screenshot, filepath } })
  } catch (error) {
    logError("Error fetching screenshot", error)
    return ApiErrors.serverError("Failed to fetch screenshot")
  }
}

// DELETE - Delete a screenshot (Owner only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return ApiErrors.unauthorized()
    }

    // Only Owner can delete screenshots
    if (session.user.role !== "OWNER") {
      return ApiErrors.forbidden("Only Owner can delete screenshots")
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return ApiErrors.badRequest("Screenshot ID is required")
    }

    // Find the screenshot
    const screenshot = await prisma.telcoScreenshot.findUnique({
      where: { id },
    })

    if (!screenshot) {
      return ApiErrors.notFound("Screenshot")
    }

    if (screenshot.isVerified) {
      return ApiErrors.badRequest("Cannot delete a verified screenshot")
    }

    // Delete the file from disk — validate path stays within public directory
    const filepath = join(process.cwd(), "public", screenshot.filepath)
    const resolvedFilepath = resolve(filepath)
    const publicDir = resolve(join(process.cwd(), "public"))
    if (!resolvedFilepath.startsWith(publicDir)) {
      return ApiErrors.badRequest("Invalid file path")
    }
    if (existsSync(filepath)) {
      try {
        await unlink(filepath)
      } catch (err) {
        logError("Error deleting file", err)
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete from database
    await prisma.telcoScreenshot.delete({
      where: { id },
    })

    await createAuditLog({
      action: "SCREENSHOT_DELETED",
      userId: session.user.id,
      targetId: id,
      details: { filename: screenshot.filename, dailyEntryId: screenshot.dailyEntryId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logError("Error deleting screenshot", error)
    return ApiErrors.serverError("Failed to delete screenshot")
  }
}
