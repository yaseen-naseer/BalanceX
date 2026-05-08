import path from "node:path"

export const STORAGE_ROOT = path.join(process.cwd(), "storage")
export const SCREENSHOTS_DIR = path.join(STORAGE_ROOT, "uploads", "screenshots")
