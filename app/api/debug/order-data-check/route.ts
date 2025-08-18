import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const storeUrl = searchParams.get('store') || 'teast32123.myshopify.com'
    
    // Check all tables that might contain order data
    const [orderStatuses, supplierOrders, orderTracking] = await Promise.all([
      supabase.from('order_status').select('*').eq('store_url', storeUrl),
      supabase.from('supplier_orders').select('*').eq('store_url', storeUrl),
      supabase.from('order_tracking').select('*').eq('store_url', storeUrl)
    ])

    return NextResponse.json({
      success: true,
      debug: {
        storeUrl,
        order_status: {
          count: orderStatuses.data?.length || 0,
          sample: orderStatuses.data?.[0] || null,
          recent_orders: orderStatuses.data?.slice(0, 3).map(o => ({
            order_number: o.order_number,
            shopify_order_id: o.shopify_order_id,
            status: o.status
          })) || []
        },
        supplier_orders: {
          count: supplierOrders.data?.length || 0,
          sample: supplierOrders.data?.[0] || null
        },
        order_tracking: {
          count: orderTracking.data?.length || 0,
          sample: orderTracking.data?.[0] || null
        }
      }
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
