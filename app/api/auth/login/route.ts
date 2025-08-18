import { NextRequest, NextResponse } from 'next/server'
import { AuthService, type LoginCredentials } from '@/lib/auth-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { usernameOrEmail, password, userType }: LoginCredentials = body

    // Validate input
    if (!usernameOrEmail || !password || !userType) {
      return NextResponse.json(
        { success: false, error: 'Username/email, password, and user type are required' },
        { status: 400 }
      )
    }

    if (!['seller', 'supplier'].includes(userType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid user type' },
        { status: 400 }
      )
    }

    // Get client info
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Attempt login
    const result = await AuthService.login(
      { usernameOrEmail, password, userType },
      ip,
      userAgent
    )

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 401 }
      )
    }

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      user: result.sessionData!.user,
      message: 'Login successful'
    })

    // Set HTTP-only cookie
    response.cookies.set('session_token', result.sessionData!.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/'
    })

    return response
  } catch (error) {
    console.error('Login API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}