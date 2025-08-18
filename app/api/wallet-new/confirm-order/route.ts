import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { WalletService } from '@/lib/services/wallet-service'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { orderNumber, storeUrl, lineItems } = body

    if (!orderNumber || !storeUrl) {
      return NextResponse.json({
        success: false,
        error: 'Order number and store URL are required'
      }, { status: 400 })
    }

    console.log(`[New Wallet] Processing order confirmation: ${orderNumber}`)

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
      const marginByProductId = new Map<string, number>()
      const marginByProductName = new Map<string, number>()
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

    // Store the calculated margin in new_order_margins
    const { error: upsertError } = await supabase
      .from('new_order_margins')
      .upsert({
        shopify_order_id: orderNumber,
        order_number: orderNumber,
        store_url: storeUrl,
        margin_amount: totalMargin,
        product_details: {
          line_items: marginDetails,
          confirmed_at: new Date().toISOString(),
          api_processed: true
        }
      }, {
        onConflict: 'order_number,store_url'
      })

    if (upsertError) {
      console.error('[New Wallet] Error storing order margin:', upsertError)
      return NextResponse.json({
        success: false,
        error: 'Failed to store order margin'
      }, { status: 500 })
    }

    // Add to wallet balance via WalletService
    await WalletService.addMarginEarned(
      storeUrl,
      orderNumber,
      orderNumber,
      totalMargin,
      `New wallet system - Order #${orderNumber}`
    )

    console.log(`[New Wallet] Successfully processed order ${orderNumber} with margin ₹${totalMargin}`)

    return NextResponse.json({
      success: true,
      data: {
        orderNumber,
        marginCalculated: totalMargin,
        marginDetails
      }
    })

  } catch (error) {
    console.error('[New Wallet] Error processing order confirmation:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
