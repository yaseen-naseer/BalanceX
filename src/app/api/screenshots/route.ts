import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"
import { writeFile, mkdir, unlink } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

// POST - Upload a screenshot for a specific date
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only Owner and Accountant can upload screenshots
    if (session.user.role === "SALES") {
      return NextResponse.json(
        { error: "Only Owner and Accountant can upload screenshots" },
        { status: 403 }
      )
    }

    // Verify user exists in database (handles stale sessions after db:clean)
    const userExists = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true }
    })

    if (!userExists) {
      return NextResponse.json(
        { error: "Session expired. Please logout and login again." },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const date = formData.get("date") as string | null

    if (!file || !date) {
      return NextResponse.json(
        { error: "File and date are required" },
        { status: 400 }
      )
    }

    // Validate file type by MIME type
    const validMimeTypes = ["image/jpeg", "image/jpg", "image/png"]
    if (!validMimeTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPG and PNG files are allowed" },
        { status: 400 }
      )
    }

    // Validate and sanitize file extension - SECURITY FIX
    const allowedExtensions = ["jpg", "jpeg", "png"]
    const rawExt = file.name.split(".").pop()?.toLowerCase()
    if (!rawExt || !allowedExtensions.includes(rawExt)) {
      return NextResponse.json(
        { error: "Invalid file extension. Only jpg, jpeg, and png allowed" },
        { status: 400 }
      )
    }
    // Use validated extension
    const ext = rawExt

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size must be less than 10MB" },
        { status: 400 }
      )
    }

    // Validate date format to prevent path traversal - SECURITY FIX
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      return NextResponse.json(
        { error: "Invalid date format. Expected YYYY-MM-DD" },
        { status: 400 }
      )
    }

    // Validate it's an actual valid date
    const parsedDate = new Date(date)
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date" },
        { status: 400 }
      )
    }

    // Get daily entry for this date
    const dailyEntry = await prisma.dailyEntry.findUnique({
      where: { date: parsedDate },
      include: { screenshot: true },
    })

    if (!dailyEntry) {
      return NextResponse.json(
        { error: "No daily entry found for this date" },
        { status: 404 }
      )
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), "public", "uploads", "screenshots")
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Generate unique filename using sanitized date and validated extension
    // SECURITY: Uses only validated date format and whitelisted extension
    const filename = `${date}-${Date.now()}.${ext}`
    const filepath = join(uploadsDir, filename)

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
        filepath: `/uploads/screenshots/${filename}`,
        mimeType: file.type,
        fileSize: file.size,
        uploadedBy: session.user.id,
      },
    })

    return NextResponse.json(screenshot, { status: 201 })
  } catch (error) {
    console.error("Error uploading screenshot:", error)
    return NextResponse.json(
      { error: "Failed to upload screenshot" },
      { status: 500 }
    )
  }
}

// GET - Get screenshot for a date
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date")

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 })
    }

    // Validate date
    const parsedDate = new Date(date)
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 })
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

    if (!dailyEntry) {
      return NextResponse.json(
        { error: "No daily entry found for this date" },
        { status: 404 }
      )
    }

    const screenshot = dailyEntry.screenshot
    if (screenshot && screenshot.verifiedBy) {
      // Look up verifier name
      const verifier = await prisma.user.findUnique({
        where: { id: screenshot.verifiedBy },
        select: { name: true },
      })
      return NextResponse.json({
        ...screenshot,
        verifiedBy: verifier?.name || null,
      })
    }

    return NextResponse.json(screenshot)
  } catch (error) {
    console.error("Error fetching screenshot:", error)
    return NextResponse.json(
      { error: "Failed to fetch screenshot" },
      { status: 500 }
    )
  }
}

// DELETE - Delete a screenshot (Owner only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only Owner can delete screenshots
    if (session.user.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only Owner can delete screenshots" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "Screenshot ID is required" },
        { status: 400 }
      )
    }

    // Find the screenshot
    const screenshot = await prisma.telcoScreenshot.findUnique({
      where: { id },
    })

    if (!screenshot) {
      return NextResponse.json(
        { error: "Screenshot not found" },
        { status: 404 }
      )
    }

    // Delete the file from disk
    const filepath = join(process.cwd(), "public", screenshot.filepath)
    if (existsSync(filepath)) {
      try {
        await unlink(filepath)
      } catch (err) {
        console.error("Error deleting file:", err)
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete from database
    await prisma.telcoScreenshot.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting screenshot:", error)
    return NextResponse.json(
      { error: "Failed to delete screenshot" },
      { status: 500 }
    )
  }
}
