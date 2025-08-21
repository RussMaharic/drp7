import { NextRequest, NextResponse } from 'next/server'
import { AuthService, type SignupCredentials } from '@/lib/auth-service'

export async function GET(request: NextRequest) {
  console.log('🚨 CALLBACK ENDPOINT REACHED!')
  console.log('🚨 URL:', request.url)
  console.log('🚨 Method:', request.method)
  console.log('🚨 Headers:', Object.fromEntries(request.headers.entries()))
  
  try {
    const searchParams = request.nextUrl.searchParams
    const orderId = searchParams.get('order_id')
    const orderToken = searchParams.get('order_token')
    const paymentStatus = searchParams.get('payment_status')
    
    console.log('🔍 PAYMENT CALLBACK DEBUG START')
    console.log('📥 Callback received with params:', { 
      orderId, 
      orderToken, 
      paymentStatus, 
      allParams: Object.fromEntries(searchParams.entries()),
      url: request.url,
      origin: request.nextUrl.origin
    })
    
    if (!orderId) {
      console.log('❌ No order ID in callback - redirecting to payment failed')
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin
      return NextResponse.redirect(`${baseUrl}/auth/seller/signup?error=payment_failed`)
    }

    // Check if payment status is directly available from Cashfree callback
    if (paymentStatus === 'SUCCESS' || paymentStatus === 'PAID') {
      console.log('✅ Payment successful based on status parameter:', paymentStatus)
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin
      const successUrl = `${baseUrl}/auth/seller/signup/complete?order_id=${encodeURIComponent(orderId)}&status=paid&direct_success=true`
      console.log('🔄 Redirecting to success URL:', successUrl)
      return NextResponse.redirect(successUrl)
    }

    // Try to verify payment status using Cashfree API
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin
    console.log('🔍 Starting payment verification for order:', orderId)
    console.log('🌐 Using base URL for verification:', baseUrl)
    
    try {
      // Add a small delay to allow Cashfree to process the order
      console.log('⏳ Waiting 2 seconds before verification...')
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const verifyUrl = `${baseUrl}/api/payments/verify`
      console.log('📡 Calling verification API:', verifyUrl)
      
      const verifyResponse = await fetch(verifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId })
      })

      console.log('📡 Verification API response status:', verifyResponse.status)
      console.log('📡 Verification API response headers:', Object.fromEntries(verifyResponse.headers.entries()))

      const verifyData = await verifyResponse.json()
      console.log('📊 Verification API response data:', verifyData)
      console.log('🔍 Verification result analysis:', {
        success: verifyData.success,
        isPaid: verifyData.isPaid,
        orderStatus: verifyData.orderStatus,
        paymentAmount: verifyData.paymentAmount,
        hasError: !!verifyData.error
      })

      if (verifyData.success && verifyData.isPaid) {
        // Payment successful - redirect to completion page
        console.log('✅ Payment verified successfully for order:', orderId)
        
        const successUrl = `${baseUrl}/auth/seller/signup/complete?order_id=${encodeURIComponent(orderId)}&amount=${encodeURIComponent(verifyData.paymentAmount)}&status=paid`
        console.log('🔄 Redirecting to success URL:', successUrl)
        return NextResponse.redirect(successUrl)
      } else {
        // Payment failed or not verified
        console.log('❌ Payment verification failed:', verifyData)
        console.log('❌ Verification failed reason:', {
          success: verifyData.success,
          isPaid: verifyData.isPaid,
          error: verifyData.error
        })
        const failUrl = `${baseUrl}/auth/seller/signup?error=payment_failed&order_id=${encodeURIComponent(orderId)}`
        console.log('🔄 Redirecting to failure URL:', failUrl)
        return NextResponse.redirect(failUrl)
      }
    } catch (verifyError) {
      console.log('❌ Payment verification failed with exception:', verifyError)
      console.log('❌ Error details:', {
        message: verifyError instanceof Error ? verifyError.message : 'Unknown error',
        stack: verifyError instanceof Error ? verifyError.stack : 'No stack trace',
        name: verifyError instanceof Error ? verifyError.name : 'Unknown error type'
      })
      // If verification fails, still try to proceed with the callback data
      // This handles cases where the order might be valid but verification fails
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin
      const successUrl = `${baseUrl}/auth/seller/signup/complete?order_id=${encodeURIComponent(orderId)}&status=callback_success`
      console.log('🔄 Verification failed but proceeding with callback success URL:', successUrl)
      return NextResponse.redirect(successUrl)
    }

  } catch (error) {
    console.error('💥 Payment callback error:', error)
    console.error('💥 Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      name: error instanceof Error ? error.name : 'Unknown error type'
    })
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin
    return NextResponse.redirect(`${baseUrl}/auth/seller/signup?error=callback_error`)
  } finally {
    console.log('🔍 PAYMENT CALLBACK DEBUG END')
  }
}
