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
    // Check if Cashfree is configured
    if (!cashfree) {
      return NextResponse.json(
        { success: false, error: 'Payment system not configured. Please contact administrator.' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { amount, customerEmail, customerName, customerPhone, orderId } = body

    // Validate required fields
    if (!amount || !customerEmail || !customerName || !orderId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate amount (should be one of the allowed amounts)
    const allowedAmounts = [25000, 50000, 75000]
    if (!allowedAmounts.includes(Number(amount))) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment amount' },
        { status: 400 }
      )
    }

    // Create order request
    // Compute a safe base URL for callbacks
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin

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

    // Create order with Cashfree
    const response = await cashfree.PGCreateOrder(orderRequest)
    
    if (response.data) {
      return NextResponse.json({
        success: true,
        orderId: response.data.order_id,
        paymentSessionId: response.data.payment_session_id,
        orderAmount: response.data.order_amount
      })
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to create order' },
        { status: 500 }
      )
    }

  } catch (error: any) {
    // Try to surface upstream error details for easier debugging
    const upstream = error?.response?.data || error?.message || 'Unknown error'
    console.error('Cashfree order creation error:', upstream)
    return NextResponse.json(
      { success: false, error: typeof upstream === 'string' ? upstream : JSON.stringify(upstream) },
      { status: 500 }
    )
  }
}
