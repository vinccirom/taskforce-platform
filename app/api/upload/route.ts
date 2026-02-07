import { NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { getAuthUser } from "@/lib/auth"
import { authenticateAgent } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

const ALLOWED_TYPES = new Set([
  // Images
  "image/png", "image/jpeg", "image/gif", "image/webp",
  // Documents
  "application/pdf", "text/plain", "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  // Archives
  "application/zip", "application/gzip", "application/x-tar",
  // Data
  "application/json",
])

// Allowlist approach: only these extensions are permitted
const ALLOWED_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".pdf", ".txt", ".csv", ".doc", ".docx",
  ".zip", ".gz", ".tar", ".json",
])

export async function POST(request: NextRequest) {
  try {
    // Dual auth: try API key first, then Privy
    let authenticated = false
    const apiKey = request.headers.get("X-API-Key")

    if (apiKey) {
      const authResult = await authenticateAgent(request)
      if ("error" in authResult) {
        return NextResponse.json(
          { error: authResult.error },
          { status: authResult.status }
        )
      }
      authenticated = true
    } else {
      const privyUser = await getAuthUser()
      if (!privyUser) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        )
      }
      const user = await prisma.user.findUnique({
        where: { privyId: privyUser.userId },
      })
      if (!user) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 401 }
        )
      }
      authenticated = true
    }

    if (!authenticated) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 50MB` },
        { status: 400 }
      )
    }

    // Check extension via allowlist
    const filename = file.name.toLowerCase()
    const ext = filename.includes('.') ? '.' + filename.split('.').pop() : ''
    if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `File extension "${ext}" is not allowed` },
        { status: 400 }
      )
    }

    // Check allowed content types
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `File type "${file.type}" is not allowed` },
        { status: 400 }
      )
    }

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN || ""

    // Sanitize filename for all paths
    const sanitizedName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`

    // Dev mode: save locally if using placeholder token (never in production)
    if (blobToken.includes("placeholder") && process.env.NODE_ENV !== "production") {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      const uploadsDir = join(process.cwd(), "public", "uploads")
      await mkdir(uploadsDir, { recursive: true })

      const filePath = join(uploadsDir, sanitizedName)
      await writeFile(filePath, buffer)

      return NextResponse.json({
        url: `/uploads/${sanitizedName}`,
        filename: file.name,
        size: file.size,
        contentType: file.type,
      })
    }

    // Production: upload to Vercel Blob with sanitized filename
    const blob = await put(sanitizedName, file, {
      access: "public",
      token: blobToken,
    })

    return NextResponse.json({
      url: blob.url,
      filename: file.name,
      size: file.size,
      contentType: file.type,
    })
  } catch (error: any) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    )
  }
}
