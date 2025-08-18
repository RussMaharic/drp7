import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const storeUrl = searchParams.get('store') || 'teast32123.myshopify.com'

    // Check product_margins table
    const { data: productMargins, error: pmError } = await supabase
      .from('product_margins')
      .select('*')
      .eq('shopify_store_url', storeUrl)

    // Check order_margins table  
    const { data: orderMargins, error: omError } = await supabase
      .from('order_margins')
      .select('*')
      .eq('store_url', storeUrl)
      .order('created_at', { ascending: false })
      .limit(10)

    // Check recent orders from order_status
    const { data: orderStatuses, error: osError } = await supabase
      .from('order_status')
      .select('*')
      .eq('store_url', storeUrl)
      .order('updated_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      success: true,
      data: {
        store_url: storeUrl,
        product_margins: {
          count: productMargins?.length || 0,
          data: productMargins,
          error: pmError
        },
        order_margins: {
          count: orderMargins?.length || 0,
          data: orderMargins,
          error: omError
        },
        order_statuses: {
          count: orderStatuses?.length || 0,
          data: orderStatuses,
          error: osError
        }
      }
    })

  } catch (error) {
    console.error('Debug webhook status error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
