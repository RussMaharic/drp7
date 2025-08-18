import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { WalletService } from '@/lib/services/wallet-service'

export async function POST() {
  try {
    const testStore = 'teast32123.myshopify.com'
    
    console.log('🔧 Setting up test data for wallet system...')
    
    // Create test order statuses
    const testOrders = [
      {
        shopify_order_id: '1001',
        store_url: testStore,
        order_number: '1001',
        status: 'confirmed',
        updated_by: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        shopify_order_id: '1002',
        store_url: testStore,
        order_number: '1002',
        status: 'rto',
        updated_by: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        shopify_order_id: '1003',
        store_url: testStore,
        order_number: '1003',
        status: 'confirmed',
        updated_by: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ]
    
    // Insert test order statuses
    console.log('📝 Inserting test order statuses...')
    const { data: orderStatuses, error: orderError } = await supabase
      .from('order_status')
      .upsert(testOrders, { onConflict: 'shopify_order_id,store_url' })
      .select()
    
    if (orderError) {
      console.error('Error inserting order statuses:', orderError)
      return NextResponse.json({
        success: false,
        error: orderError.message
      }, { status: 500 })
    }
    
    console.log('✅ Order statuses created:', orderStatuses?.length)
    
    // Create test tracking data
    const testTracking = [
      {
        shopify_order_id: '1001',
        order_number: '1001',
        store_url: testStore,
        tracking_number: 'TRK001',
        carrier: 'FedEx',
        tracking_url: 'https://www.fedex.com/tracking?trknbr=TRK001',
        status: 'delivered'
      },
      {
        shopify_order_id: '1002',
        order_number: '1002',
        store_url: testStore,
        tracking_number: 'TRK002',
        carrier: 'UPS',
        tracking_url: 'https://www.ups.com/track?tracknum=TRK002',
        status: 'rto'
      },
      {
        shopify_order_id: '1003',
        order_number: '1003',
        store_url: testStore,
        tracking_number: 'TRK003',
        carrier: 'DHL',
        tracking_url: 'https://www.dhl.com/track?tracking-id=TRK003',
        status: 'in_transit'
      }
    ]
    
    // Insert test tracking data
    console.log('📦 Inserting test tracking data...')
    const { data: trackingData, error: trackingError } = await supabase
      .from('order_tracking')
      .upsert(testTracking, { onConflict: 'shopify_order_id,store_url' })
      .select()
    
    if (trackingError) {
      console.error('Error inserting tracking data:', trackingError)
    } else {
      console.log('✅ Tracking data created:', trackingData?.length)
    }
    
    // Process wallet transactions for confirmed orders
    console.log('💰 Processing wallet transactions...')
    for (const order of testOrders) {
      if (order.status === 'confirmed') {
        const marginAmount = 150 // 15% of 1000
        await WalletService.addMarginEarned(
          order.store_url,
          order.shopify_order_id,
          order.order_number,
          marginAmount
        )
        console.log(`✅ Added margin for order ${order.order_number}`)
      } else if (order.status === 'rto') {
        const penaltyAmount = 100
        await WalletService.deductRTOTPenalty(
          order.store_url,
          order.shopify_order_id,
          order.order_number,
          penaltyAmount
        )
        console.log(`✅ Added RTO penalty for order ${order.order_number}`)
      }
    }
    
    // Get final wallet balance
    const finalBalance = await WalletService.getWalletBalance(testStore)
    const transactions = await WalletService.getTransactionHistory(testStore)
    
    return NextResponse.json({
      success: true,
      message: 'Test data setup completed successfully',
      data: {
        ordersCreated: orderStatuses?.length || 0,
        trackingCreated: trackingData?.length || 0,
        finalWalletBalance: finalBalance,
        transactionCount: transactions.length,
        transactions: transactions
      }
    })
    
  } catch (error) {
    console.error('Test data setup failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to setup test data'
    }, { status: 500 })
  }
}
