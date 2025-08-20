import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const baseUrlFromEnv = process.env.NEXT_PUBLIC_BASE_URL || null
  const computedOrigin = request.nextUrl.origin
  const env = {
    CASHFREE_CLIENT_ID: !!process.env.CASHFREE_CLIENT_ID,
    CASHFREE_CLIENT_SECRET: !!process.env.CASHFREE_CLIENT_SECRET,
    CASHFREE_ENVIRONMENT: process.env.CASHFREE_ENVIRONMENT || 'sandbox',
    NEXT_PUBLIC_BASE_URL: baseUrlFromEnv,
    computedOrigin
  }

  const ok = env.CASHFREE_CLIENT_ID && env.CASHFREE_CLIENT_SECRET

  return NextResponse.json({ ok, env })
}



