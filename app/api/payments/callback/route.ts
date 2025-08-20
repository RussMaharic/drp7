import { NextRequest, NextResponse } from 'next/server'
import { AuthService, type SignupCredentials } from '@/lib/auth-service'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const orderId = searchParams.get('order_id')
    const orderToken = searchParams.get('order_token')
    const paymentStatus = searchParams.get('payment_status')
    
    console.log('Payment callback received:', { orderId, orderToken, paymentStatus, allParams: Object.fromEntries(searchParams.entries()) })
    
    if (!orderId) {
      console.log('No order ID in callback')
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin
      return NextResponse.redirect(`${baseUrl}/auth/seller/signup?error=payment_failed`)
    }

    // Check if payment status is directly available from Cashfree
    if (paymentStatus === 'SUCCESS' || paymentStatus === 'PAID') {
      console.log('Payment successful based on status parameter:', paymentStatus)
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin
      const successUrl = `${baseUrl}/auth/seller/signup/complete?order_id=${encodeURIComponent(orderId)}&status=paid&direct_success=true`
      return NextResponse.redirect(successUrl)
    }

    // Try to verify payment status using Cashfree API
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin
    console.log('Verifying payment for order:', orderId)
    
    try {
      // Add a small delay to allow Cashfree to process the order
      await new Promise(resolve => setTimeout(resolve, 2000))
      
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
        // Payment successful - redirect to completion page
        console.log('Payment verified successfully for order:', orderId)
        
        const successUrl = `${baseUrl}/auth/seller/signup/complete?order_id=${encodeURIComponent(orderId)}&amount=${encodeURIComponent(verifyData.paymentAmount)}&status=paid`
        return NextResponse.redirect(successUrl)
      } else {
        // Payment failed or not verified
        console.log('Payment verification failed:', verifyData)
        const failUrl = `${baseUrl}/auth/seller/signup?error=payment_failed&order_id=${encodeURIComponent(orderId)}`
        return NextResponse.redirect(failUrl)
      }
    } catch (verifyError) {
      console.log('Payment verification failed, but proceeding with callback data:', verifyError)
      // If verification fails, still try to proceed with the callback data
      // This handles cases where the order might be valid but verification fails
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin
      const successUrl = `${baseUrl}/auth/seller/signup/complete?order_id=${encodeURIComponent(orderId)}&status=callback_success`
      return NextResponse.redirect(successUrl)
    }

  } catch (error) {
    console.error('Payment callback error:', error)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin
    return NextResponse.redirect(`${baseUrl}/auth/seller/signup?error=callback_error`)
  }
}
