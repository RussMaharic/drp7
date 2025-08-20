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

export async function POST(request: NextRequest) {
  try {
    // Check if Cashfree is configured
    if (!cashfree) {
      return NextResponse.json(
        { success: false, error: 'Payment system not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { orderId } = body

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      )
    }

    // Verify order status with Cashfree
    const version = '2023-08-01'
    console.log('Fetching order from Cashfree:', { version, orderId })
    
    const response = await cashfree.PGFetchOrder(version, orderId)
    
    console.log('Cashfree verification response:', response)
    console.log('Response data:', response.data)
    
    if (response.data) {
      const orderStatus = response.data.order_status
      const paymentAmount = response.data.order_amount
      
      console.log('Payment verification result:', { orderId, orderStatus, paymentAmount, isPaid: orderStatus === 'PAID' })
      
      return NextResponse.json({
        success: true,
        orderStatus,
        paymentAmount,
        isPaid: orderStatus === 'PAID',
        orderDetails: response.data
      })
    } else {
      console.log('No response data from Cashfree for order:', orderId)
      return NextResponse.json(
        { success: false, error: 'Failed to verify payment' },
        { status: 500 }
      )
    }

  } catch (error: any) {
    const upstream = error?.response?.data || error?.message || 'Unknown error'
    console.error('Payment verification error:', upstream)
    return NextResponse.json(
      { success: false, error: typeof upstream === 'string' ? upstream : JSON.stringify(upstream) },
      { status: 500 }
    )
  }
}
