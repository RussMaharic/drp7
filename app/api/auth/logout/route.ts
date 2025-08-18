import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth-service'

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value

    if (sessionToken) {
      await AuthService.logout(sessionToken)
    }

    // Create response and clear cookie
    const response = NextResponse.json({ 
      success: true, 
      message: 'Logged out successfully' 
    })
    
    response.cookies.delete('session_token')

    return response
  } catch (error) {
    console.error('Logout API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}