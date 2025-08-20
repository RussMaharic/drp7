import { NextRequest, NextResponse } from 'next/server'
import { AuthService, type SignupCredentials } from '@/lib/auth-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, email, password, name, userType, companyName, paymentOrderId, subscriptionAmount }: SignupCredentials = body

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

    // For seller signup, verify payment if paymentOrderId is provided
    if (userType === 'seller' && paymentOrderId) {
      const verifyResponse = await fetch(`${request.nextUrl.origin}/api/payments/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId: paymentOrderId })
      })

      const verifyData = await verifyResponse.json()
      
      if (!verifyData.success || !verifyData.isPaid) {
        return NextResponse.json(
          { success: false, error: 'Payment verification failed. Please complete payment first.' },
          { status: 400 }
        )
      }
    }

    // Attempt signup
    const result = await AuthService.signup({
      username,
      email,
      password,
      name,
      userType,
      companyName,
      paymentOrderId,
      subscriptionAmount
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