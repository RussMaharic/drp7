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
    console.log('🔍 PAYMENT VERIFICATION DEBUG START')
    
    // Check if Cashfree is configured
    if (!cashfree) {
      console.log('❌ Cashfree not configured')
      return NextResponse.json(
        { success: false, error: 'Payment system not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { orderId } = body

    console.log('📥 Verification request received:', { orderId, body })

    if (!orderId) {
      console.log('❌ No order ID provided')
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      )
    }

    // Verify order status with Cashfree
    console.log('🔍 Fetching order from Cashfree:', { orderId })
    
    const response = await cashfree.PGFetchOrder(orderId)
    
    console.log('📡 Cashfree API response:', response)
    console.log('📊 Response data:', response.data)
    console.log('📊 Response status:', response.status)
    console.log('📊 Response headers:', response.headers)
    
    if (response.data) {
      const orderStatus = response.data.order_status
      const paymentAmount = response.data.order_amount
      
      console.log('✅ Payment verification result:', { 
        orderId, 
        orderStatus, 
        paymentAmount, 
        isPaid: orderStatus === 'PAID',
        fullResponse: response.data
      })
      
      return NextResponse.json({
        success: true,
        orderStatus,
        paymentAmount,
        isPaid: orderStatus === 'PAID',
        orderDetails: response.data
      })
    } else {
      console.log('❌ No response data from Cashfree for order:', orderId)
      return NextResponse.json(
        { success: false, error: 'Failed to verify payment' },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.log('💥 Payment verification error:', error)
    const upstream = error?.response?.data || error?.message || 'Unknown error'
    console.log('💥 Upstream error details:', upstream)
    console.log('💥 Full error object:', error)
    
    return NextResponse.json(
      { success: false, error: typeof upstream === 'string' ? upstream : JSON.stringify(upstream) },
      { status: 500 }
    )
  } finally {
    console.log('🔍 PAYMENT VERIFICATION DEBUG END')
  }
}
