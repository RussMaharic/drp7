import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth-service'
import { isTestMode } from '@/lib/test-mode'

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value

    if (!sessionToken) {
      // In test mode, return a fake seller session to unblock UI flows
      if (isTestMode()) {
        return NextResponse.json({
          success: true,
          user: {
            id: 'test-seller-id',
            username: 'Rushi',
            email: 'rushi@example.com',
            name: 'Rushi',
            userType: 'seller',
            createdAt: new Date().toISOString(),
          }
        })
      }
      return NextResponse.json(
        { success: false, error: 'No session token found' },
        { status: 401 }
      )
    }

    const result = await AuthService.verifySession(sessionToken)

    if (!result.success) {
      // Clear invalid session cookie
      const response = NextResponse.json(
        { success: false, error: result.error },
        { status: 401 }
      )
      response.cookies.delete('session_token')
      return response
    }

    return NextResponse.json({
      success: true,
      user: result.user
    })

  } catch (error) {
    console.error('Session API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}