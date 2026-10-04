import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession, unauthorizedResponse } from '@/lib/api-utils'

/**
 * GET /api/file/signed-url?path=<storage-path>
 *
 * Returns a short-lived signed URL for a file in the private `reports` bucket.
 * The caller must be authenticated and have access to the related report.
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verify the user is logged in
    const { user, supabase: userClient } = await verifySession()
    if (!user) {
      return unauthorizedResponse()
    }

    // 2. Get the requested file path
    const filePath = request.nextUrl.searchParams.get('path')
    if (!filePath || typeof filePath !== 'string' || filePath.length > 500) {
      return NextResponse.json(
        { error: 'Missing or invalid "path" query parameter' },
        { status: 400 },
      )
    }

    // 3. Validate that this user has access to a report referencing this file
    //    We check if the file_name matches a report the user can see.
    const { data: reportAccess, error: accessError } = await userClient
      .from('reports')
      .select('id')
      .eq('file_name', filePath)
      .limit(1)
      .maybeSingle()

    if (accessError) {
      console.error('[file/signed-url] Access check error:', accessError.message)
      return NextResponse.json(
        { error: 'Failed to verify file access' },
        { status: 500 },
      )
    }

    if (!reportAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this file' },
        { status: 403 },
      )
    }

    // 4. Generate a signed URL using the service role client (bypasses storage RLS)
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 },
      )
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { data: signedData, error: signError } = await adminClient.storage
      .from('reports')
      .createSignedUrl(filePath, 300) // 5-minute expiry

    if (signError || !signedData?.signedUrl) {
      console.error('[file/signed-url] Signing error:', signError?.message)
      return NextResponse.json(
        { error: 'Failed to generate signed URL' },
        { status: 500 },
      )
    }

    // Proxy the image through Next.js to avoid local 127.0.0.1 redirect issues
    // when accessing the app from mobile devices or other computers on the network
    const imageResponse = await fetch(signedData.signedUrl);
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image from storage: ${imageResponse.statusText}`);
    }
    
    const headers = new Headers();
    headers.set('Content-Type', imageResponse.headers.get('Content-Type') || 'application/octet-stream');
    headers.set('Cache-Control', 'public, max-age=3600');
    
    return new NextResponse(imageResponse.body, { headers });
  } catch (error: unknown) {
    console.error('[file/signed-url] Internal error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
