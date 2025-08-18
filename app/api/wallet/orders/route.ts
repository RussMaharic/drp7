import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { WalletService } from '@/lib/services/wallet-service'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const storeUrl = searchParams.get('store')
    
    if (!storeUrl) {
      return NextResponse.json({
        success: false,
        error: 'Store URL is required'
      }, { status: 400 })
    }

    // Fetch orders from order_status table
    const { data: orderStatuses, error: statusError } = await supabase
      .from('order_status')
      .select('*')
      .eq('store_url', storeUrl)
      .order('updated_at', { ascending: false })

    if (statusError) {
      throw new Error(`Failed to fetch order statuses: ${statusError.message}`)
    }

    // Fetch order tracking data
    const { data: orderTracking, error: trackingError } = await supabase
      .from('order_tracking')
      .select('*')
      .eq('store_url', storeUrl)

    if (trackingError) {
      console.error('Error fetching order tracking:', trackingError)
    }

    // Create tracking map
    const trackingMap = new Map()
    if (orderTracking) {
      orderTracking.forEach(tracking => {
        trackingMap.set(tracking.shopify_order_id, tracking)
      })
    }

    // Fetch margins from order_margins table
    const { data: orderMarginsData, error: orderMarginsError } = await supabase
      .from('order_margins')
      .select('order_number, margin_amount')
      .eq('store_url', storeUrl)
    
    if (orderMarginsError) {
      console.error('Error fetching order margins:', orderMarginsError)
    }
    
    // Create margins map
    const orderMarginsMap = new Map<string, number>()
    orderMarginsData?.forEach(margin => {
      orderMarginsMap.set(margin.order_number, Number(margin.margin_amount) || 0)
    })

    // Get seller info for RTO rates
    const { data: storeConn } = await supabase
      .from('seller_store_connections')
      .select('seller_id')
      .eq('store_url', storeUrl)
      .eq('is_active', true)
      .single()

    // Get RTO rate for this seller
    let rtoRate = 0
    if (storeConn?.seller_id) {
      const { data: rtoRateData } = await supabase
        .from('seller_rto_rates')
        .select('rto_rate')
        .eq('seller_id', storeConn.seller_id)
        .eq('store_url', storeUrl)
        .eq('is_active', true)
        .single()
      
      rtoRate = Number(rtoRateData?.rto_rate) || 0
    }

    // Process orders and calculate wallet impact
    const orders = (orderStatuses || []).map(status => {
      const tracking = trackingMap.get(status.shopify_order_id)
      
      let marginAmount = 0
      let penaltyAmount = 0

      // For confirmed orders: Get margin from order_margins table
      if (status.status === 'confirmed') {
        marginAmount = orderMarginsMap.get(status.order_number) || 0
      }

      // For RTO orders: Use seller-specific RTO rate
      if (status.status === 'rto') {
        penaltyAmount = rtoRate
      }

      return {
        id: status.shopify_order_id,
        orderNumber: status.order_number,
        status: status.status,
        storeUrl: status.store_url,
        updatedAt: status.updated_at,
        tracking: tracking ? {
          trackingNumber: tracking.tracking_number,
          carrier: tracking.carrier,
          trackingUrl: tracking.tracking_url
        } : null,
        marginAmount,
        penaltyAmount
      }
    })

    // Get wallet balance and transaction history
    const [walletBalance, transactionHistory] = await Promise.all([
      WalletService.getWalletBalance(storeUrl),
      WalletService.getTransactionHistory(storeUrl)
    ])

    // Calculate summary
    const confirmedOrders = orders.filter(o => o.status === 'confirmed')
    const rtoOrders = orders.filter(o => o.status === 'rto')
    const totalMargin = confirmedOrders.reduce((sum, o) => sum + o.marginAmount, 0)
    const totalPenalties = rtoOrders.reduce((sum, o) => sum + o.penaltyAmount, 0)

    return NextResponse.json({
      success: true,
      data: {
        orders,
        walletBalance,
        transactionHistory,
        summary: {
          totalOrders: orders.length,
          confirmedOrders: confirmedOrders.length,
          rtoOrders: rtoOrders.length,
          totalMargin,
          totalPenalties
        }
      }
    })

  } catch (error) {
    console.error('Error fetching wallet orders:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to fetch wallet orders'
    }, { status: 500 })
  }
}

// POST endpoint for wallet transactions (keeping RTO functionality unchanged)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { storeUrl, orderId, orderNumber, action } = body

    if (!storeUrl || !orderId || !orderNumber || !action) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: storeUrl, orderId, orderNumber, action'
      }, { status: 400 })
    }

    let result

    switch (action) {
      case 'confirm':
        // Get margin from order_margins table
        const { data: marginData } = await supabase
          .from('order_margins')
          .select('margin_amount')
          .eq('order_number', orderNumber)
          .eq('store_url', storeUrl)
          .single()

        const marginAmount = Number(marginData?.margin_amount) || 0
        result = await WalletService.addMarginEarned(storeUrl, orderId, orderNumber, marginAmount)
        break

      case 'rto':
        // Keep existing RTO logic unchanged
        const { data: storeConn } = await supabase
          .from('seller_store_connections')
          .select('seller_id')
          .eq('store_url', storeUrl)
          .eq('is_active', true)
          .single()

        let rtoPenaltyAmount = 0
        if (storeConn?.seller_id) {
          const { data: rto } = await supabase
            .from('seller_rto_rates')
            .select('rto_rate')
            .eq('seller_id', storeConn.seller_id)
            .eq('store_url', storeUrl)
            .eq('is_active', true)
            .single()
          if (rto?.rto_rate !== undefined) rtoPenaltyAmount = Number(rto.rto_rate)
        }

        result = await WalletService.deductRTOTPenalty(storeUrl, orderId, orderNumber, rtoPenaltyAmount)
        break

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use "confirm" or "rto"'
        }, { status: 400 })
    }

    // Get updated wallet balance
    const newBalance = await WalletService.getWalletBalance(storeUrl)

    return NextResponse.json({
      success: true,
      message: `Order ${action === 'confirm' ? 'confirmed' : 'marked as RTO'} successfully`,
      data: {
        newBalance,
        transactionAmount: action === 'confirm' ? marginAmount : -rtoPenaltyAmount
      }
    })

  } catch (error) {
    console.error('Error processing wallet transaction:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to process wallet transaction'
    }, { status: 500 })
  }
}