import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const storeUrl = searchParams.get('store') || 'teast32123.myshopify.com'
    const orderNumber = searchParams.get('order')
    
    console.log(`[Debug] Checking calculation for store: ${storeUrl}`)

    // Get product margins
    const { data: productMargins } = await supabase
      .from('store_product_margins')
      .select('*')
      .eq('store_url', storeUrl)

    console.log(`[Debug] Product margins found:`, productMargins)

    // Get supplier orders
    const { data: supplierOrders } = await supabase
      .from('supplier_orders')
      .select('*')
      .eq('store_url', storeUrl)

    console.log(`[Debug] Supplier orders found:`, supplierOrders?.length)

    // If specific order requested, show detailed calculation
    if (orderNumber && supplierOrders) {
      const order = supplierOrders.find(o => o.shopify_order_id === orderNumber || o.order_number === orderNumber)
      if (order) {
        console.log(`[Debug] Order ${orderNumber} line items:`, order.line_items)
        
        // Calculate margin for this order
        let totalMargin = 0
        const details = []
        
        if (order.line_items && Array.isArray(order.line_items)) {
          for (const item of order.line_items) {
            const productId = String(item.product_id || item.productId || '')
            const productName = String(item.name || item.productName || '').toLowerCase().trim()
            const quantity = Number(item.quantity) || 0
            
            // Find margin
            const productMargin = productMargins?.find(pm => 
              pm.shopify_product_id === productId || 
              pm.product_name.toLowerCase().trim() === productName
            )
            
            const marginPerUnit = productMargin ? Number(productMargin.margin_per_unit) : 0
            const itemTotal = marginPerUnit * quantity
            totalMargin += itemTotal
            
            details.push({
              product_id: productId,
              product_name: item.name || item.productName,
              quantity,
              margin_per_unit: marginPerUnit,
              item_total: itemTotal,
              matched_product: productMargin ? productMargin.product_name : 'No match found'
            })
          }
        }
        
        return NextResponse.json({
          success: true,
          debug: {
            storeUrl,
            orderNumber,
            totalMargin,
            calculation_details: details,
            available_products: productMargins?.map(pm => ({
              id: pm.shopify_product_id,
              name: pm.product_name,
              margin: pm.margin_per_unit
            }))
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      debug: {
        storeUrl,
        productMargins: productMargins?.map(pm => ({
          id: pm.shopify_product_id,
          name: pm.product_name,
          margin: pm.margin_per_unit
        })),
        supplierOrdersCount: supplierOrders?.length,
        sampleOrder: supplierOrders?.[0] ? {
          id: supplierOrders[0].shopify_order_id,
          lineItems: supplierOrders[0].line_items
        } : null
      }
    })

  } catch (error) {
    console.error('Debug calculation error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
