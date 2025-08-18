import { NextResponse } from "next/server"
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const { orderNumber, storeUrl, status, lineItems } = await request.json()

    if (!orderNumber || !storeUrl || !status) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters'
      }, { status: 400 })
    }

    console.log(`[New Wallet Webhook] Processing order ${orderNumber} with status ${status}`)

    // Only process confirmed orders for margin calculation
    if (status === 'confirmed') {
      // Check if margin already calculated
      const { data: existingMargin } = await supabase
        .from('new_order_margins')
        .select('id')
        .eq('order_number', orderNumber)
        .eq('store_url', storeUrl)
        .single()

      if (!existingMargin) {
        // Calculate margin from line items and store_product_margins
        let totalMargin = 0
        const marginDetails = []

        if (lineItems && lineItems.length > 0) {
          // Get product margins for this store
          const { data: productMargins } = await supabase
            .from('store_product_margins')
            .select('shopify_product_id, product_name, margin_per_unit')
            .eq('store_url', storeUrl)

          // Create lookup maps
          const marginByProductId = new Map()
          const marginByProductName = new Map()
          productMargins?.forEach(m => {
            if (m.shopify_product_id) {
              marginByProductId.set(String(m.shopify_product_id), Number(m.margin_per_unit) || 0)
            }
            if (m.product_name) {
              marginByProductName.set(m.product_name.toLowerCase().trim(), Number(m.margin_per_unit) || 0)
            }
          })

          // Calculate total margin
          for (const item of lineItems) {
            const productId = String(item.product_id || '')
            const productName = String(item.name || '').toLowerCase().trim()
            const quantity = Number(item.quantity) || 0
            
            const marginPerUnit = marginByProductId.get(productId) || marginByProductName.get(productName) || 0
            const itemTotalMargin = marginPerUnit * quantity
            totalMargin += itemTotalMargin

            marginDetails.push({
              product_id: productId,
              product_name: item.name,
              quantity: quantity,
              margin_per_unit: marginPerUnit,
              total_margin: itemTotalMargin
            })

            console.log(`[New Wallet] Item: ${item.name} - Qty: ${quantity} - Margin/unit: ₹${marginPerUnit} - Total: ₹${itemTotalMargin}`)
          }
        }

        console.log(`[New Wallet] Total calculated margin for order ${orderNumber}: ₹${totalMargin}`)

        // Store the calculated margin
        const { error: insertError } = await supabase
          .from('new_order_margins')
          .insert({
            shopify_order_id: orderNumber,
            order_number: orderNumber,
            store_url: storeUrl,
            margin_amount: totalMargin,
            product_details: {
              line_items: marginDetails,
              auto_calculated: true,
              webhook_processed: true,
              created_at: new Date().toISOString()
            }
          })

        if (!insertError) {
          console.log(`[New Wallet] Successfully stored order margin: ${orderNumber} = ₹${totalMargin}`)
        } else {
          console.error('[New Wallet] Error storing order margin:', insertError)
        }
      } else {
        console.log(`[New Wallet] Order ${orderNumber} margin already exists`)
      }
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[New Wallet] Webhook processing error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
