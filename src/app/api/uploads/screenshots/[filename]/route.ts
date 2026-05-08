import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { readFile } from "fs/promises"
import { join, resolve } from "path"
import { existsSync } from "fs"
import { SCREENSHOTS_DIR } from "@/lib/storage"

const MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { filename } = await params

  // Validate filename format to prevent path traversal
  if (!/^[\w-]+\.(jpg|jpeg|png)$/.test(filename)) {
    return new NextResponse("Invalid filename", { status: 400 })
  }

  const uploadsDir = resolve(SCREENSHOTS_DIR)
  const filepath = resolve(join(uploadsDir, filename))

  // Ensure resolved path is within uploads directory
  if (!filepath.startsWith(uploadsDir)) {
    return new NextResponse("Invalid path", { status: 400 })
  }

  if (!existsSync(filepath)) {
    return new NextResponse("Not found", { status: 404 })
  }

  const ext = filename.split(".").pop()?.toLowerCase() || "jpeg"
  const contentType = MIME_TYPES[ext] || "application/octet-stream"

  const buffer = await readFile(filepath)
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      // Sensitive content: never persist on disk, never use stale cache without revalidation.
      // Forces every request through the auth check above.
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "Pragma": "no-cache",
    },
  })
}
