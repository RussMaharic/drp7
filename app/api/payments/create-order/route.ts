import { NextRequest, NextResponse } from 'next/server'
import { Cashfree, CFEnvironment } from 'cashfree-pg'

// Validate environment variables
const clientId = process.env.CASHFREE_CLIENT_ID
const clientSecret = process.env.CASHFREE_CLIENT_SECRET
const environment = process.env.CASHFREE_ENVIRONMENT || 'sandbox'

if (!clientId || !clientSecret) {
  console.error('❌ Cashfree credentials not configured')
  console.error('Please set CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET in .env.local')
}

// Initialize Cashfree with your credentials
const cashfree = clientId && clientSecret ? new Cashfree(
  environment === 'production' ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX,
  clientId,
  clientSecret
) : null

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 ORDER CREATION DEBUG START')
    
    // Check if Cashfree is configured
    if (!cashfree) {
      console.log('❌ Cashfree not configured')
      return NextResponse.json(
        { success: false, error: 'Payment system not configured. Please contact administrator.' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { amount, customerEmail, customerName, customerPhone, orderId } = body

    console.log('📥 Order creation request received:', { amount, customerEmail, customerName, customerPhone, orderId })

    // Validate required fields
    if (!amount || !customerEmail || !customerName || !orderId) {
      console.log('❌ Missing required fields:', { amount, customerEmail, customerName, orderId })
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate amount (should be one of the allowed amounts)
    const allowedAmounts = [25000, 50000, 75000]
    if (!allowedAmounts.includes(Number(amount))) {
      console.log('❌ Invalid amount:', amount)
      return NextResponse.json(
        { success: false, error: 'Invalid payment amount' },
        { status: 400 }
      )
    }

    // Create order request
    // Compute a safe base URL for callbacks
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin
    console.log('🌐 Using base URL for callbacks:', baseUrl)
    console.log('🌐 Environment variables:', {
      NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
      requestOrigin: request.nextUrl.origin,
      finalBaseUrl: baseUrl
    })

    const orderRequest = {
      order_amount: amount.toString(),
      order_currency: 'INR',
      order_id: orderId,
      customer_details: {
        customer_id: `seller_${Date.now()}`,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone || '9999999999'
      },
      order_meta: {
        // Include order_id in the return URL so we can verify after redirect
        return_url: `${baseUrl}/api/payments/callback?order_id=${encodeURIComponent(orderId)}`
      },
      order_note: `Seller Dashboard Subscription - ₹${amount}`
    }
    
    console.log('📋 Order request to Cashfree:', orderRequest)
    console.log('🔗 Return URL:', orderRequest.order_meta.return_url)
    console.log('🔗 Return URL details:', {
      fullUrl: orderRequest.order_meta.return_url,
      baseUrl: baseUrl,
      orderId: orderId,
      encodedOrderId: encodeURIComponent(orderId)
    })

    // Create order with Cashfree
    console.log('🚀 Creating Cashfree order...')
    const response = await cashfree.PGCreateOrder(orderRequest)
    
    console.log('📡 Cashfree order creation response:', response)
    console.log('📊 Response data:', response.data)
    console.log('📊 Response status:', response.status)
    
    if (response.data) {
      console.log('✅ Order created successfully:', {
        orderId: response.data.order_id,
        paymentSessionId: response.data.payment_session_id,
        orderAmount: response.data.order_amount
      })
      
      return NextResponse.json({
        success: true,
        orderId: response.data.order_id,
        paymentSessionId: response.data.payment_session_id,
        orderAmount: response.data.order_amount
      })
    } else {
      console.log('❌ No response data from Cashfree')
      return NextResponse.json(
        { success: false, error: 'Failed to create order' },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.log('💥 Order creation error:', error)
    // Try to surface upstream error details for easier debugging
    const upstream = error?.response?.data || error?.message || 'Unknown error'
    console.log('💥 Upstream error details:', upstream)
    console.log('💥 Full error object:', error)
    
    return NextResponse.json(
      { success: false, error: typeof upstream === 'string' ? upstream : JSON.stringify(upstream) },
      { status: 500 }
    )
  } finally {
    console.log('🔍 ORDER CREATION DEBUG END')
  }
}
