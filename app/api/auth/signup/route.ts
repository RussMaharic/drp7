import { NextRequest, NextResponse } from 'next/server'
import { AuthService, type SignupCredentials } from '@/lib/auth-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, email, password, name, userType, companyName }: SignupCredentials = body

    // Validate required fields
    if (!username || !email || !password || !name || !userType) {
      return NextResponse.json(
        { success: false, error: 'All required fields must be provided' },
        { status: 400 }
      )
    }

    // Validate user type
    if (!['seller', 'supplier'].includes(userType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid user type' },
        { status: 400 }
      )
    }

    // Attempt signup
    const result = await AuthService.signup({
      username,
      email,
      password,
      name,
      userType,
      companyName
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      user: result.user,
      message: 'Account created successfully'
    })

  } catch (error) {
    console.error('Signup API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}