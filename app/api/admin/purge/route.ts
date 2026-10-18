import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifySession, unauthorizedResponse } from "@/lib/api-utils"
import { UUID_REGEX } from "@/lib/constants"

/**
 * POST /api/admin/purge  { userId }
 *
 * Permanently deletes a closed patient account whose retention period is over: the
 * database part first (admin_purge_patient checks the caller is an admin and the date
 * has passed, and deletes everything in one transaction), then its files in storage.
 * If removing a file fails the records are already gone; the file is reported so it can
 * be removed by hand.
 */
export async function POST(request: NextRequest) {
  const { user, supabase } = await verifySession()
  if (!user) return unauthorizedResponse()

  const body = await request.json().catch(() => null)
  const userId = typeof body?.userId === "string" ? body.userId : ""
  if (!UUID_REGEX.test(userId)) {
    return NextResponse.json({ error: "Missing or invalid userId" }, { status: 400 })
  }

  const { data: files, error } = await supabase.rpc("admin_purge_patient", { p_user: userId })
  if (error) {
    const status = error.code === "42501" ? 403 : 400
    return NextResponse.json({ error: error.message }, { status })
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ deleted: true, filesRemoved: 0, fileErrors: ["Server has no storage key; remove the files by hand."] })
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let filesRemoved = 0
  const fileErrors: string[] = []
  for (const [bucket, paths] of Object.entries((files || {}) as Record<string, string[]>)) {
    if (!Array.isArray(paths) || paths.length === 0) continue
    const { error: removeError } = await admin.storage.from(bucket).remove(paths)
    if (removeError) fileErrors.push(`${bucket}: ${removeError.message}`)
    else filesRemoved += paths.length
  }

  return NextResponse.json({ deleted: true, filesRemoved, fileErrors })
}
