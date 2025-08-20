import { NextRequest, NextResponse } from 'next/server'
import { AuthService, type SignupCredentials } from '@/lib/auth-service'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const orderId = searchParams.get('order_id')
    const orderToken = searchParams.get('order_token')
    
    console.log('Payment callback received:', { orderId, orderToken, allParams: Object.fromEntries(searchParams.entries()) })
    
    if (!orderId) {
      console.log('No order ID in callback')
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin
      return NextResponse.redirect(`${baseUrl}/auth/seller/signup?error=payment_failed`)
    }

    // Verify payment status using a safe base URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin
    console.log('Verifying payment for order:', orderId)
    
    const verifyResponse = await fetch(`${baseUrl}/api/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderId })
    })

    const verifyData = await verifyResponse.json()
    console.log('Verification result:', verifyData)

    if (verifyData.success && verifyData.isPaid) {
      // Payment successful - redirect to completion page to update account
      console.log('Payment verified successfully for order:', orderId)
      
      const successUrl = `${baseUrl}/auth/seller/signup/complete?order_id=${encodeURIComponent(orderId)}&amount=${encodeURIComponent(verifyData.paymentAmount)}&status=paid`
      return NextResponse.redirect(successUrl)
    } else {
      // Payment failed or not verified
      console.log('Payment verification failed:', verifyData)
      const failUrl = `${baseUrl}/auth/seller/signup?error=payment_failed&order_id=${encodeURIComponent(orderId)}`
      return NextResponse.redirect(failUrl)
    }

  } catch (error) {
    console.error('Payment callback error:', error)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin
    return NextResponse.redirect(`${baseUrl}/auth/seller/signup?error=callback_error`)
  }
}
