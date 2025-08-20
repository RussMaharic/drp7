import { NextRequest, NextResponse } from 'next/server'
import { Cashfree, CFEnvironment } from 'cashfree-pg'

// Validate environment variables
const clientId = process.env.CASHFREE_CLIENT_ID
const clientSecret = process.env.CASHFREE_CLIENT_SECRET
const environment = process.env.CASHFREE_ENVIRONMENT || 'sandbox'

// Initialize Cashfree with your credentials
const cashfree = clientId && clientSecret ? new Cashfree(
  environment === 'production' ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX,
  clientId,
  clientSecret
) : null

export async function GET(request: NextRequest) {
  try {
    // Check if Cashfree is configured
    if (!cashfree) {
      return NextResponse.json(
        { success: false, error: 'Payment system not configured' },
        { status: 500 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const orderId = searchParams.get('order_id')

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required as query parameter' },
        { status: 400 }
      )
    }

    // Verify order status with Cashfree
    const version = '2023-08-01'
    const response = await cashfree.PGFetchOrder(version, orderId)
    
    console.log('Test verification for order:', orderId)
    console.log('Cashfree response:', response.data)
    
    if (response.data) {
      return NextResponse.json({
        success: true,
        orderId,
        orderStatus: response.data.order_status,
        paymentAmount: response.data.order_amount,
        isPaid: response.data.order_status === 'PAID',
        fullResponse: response.data
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'No response from Cashfree',
        orderId
      })
    }

  } catch (error: any) {
    const upstream = error?.response?.data || error?.message || 'Unknown error'
    console.error('Test verification error:', upstream)
    return NextResponse.json({
      success: false,
      error: typeof upstream === 'string' ? upstream : JSON.stringify(upstream),
      orderId: request.nextUrl.searchParams.get('order_id')
    })
  }
}
