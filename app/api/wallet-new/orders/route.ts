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

    // We don't need to fetch from new_order_margins - calculating on-the-fly

    // Get seller info for RTO rates (keeping same RTO system)
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

    // Get product margins for calculation
    const { data: productMargins } = await supabase
      .from('store_product_margins')
      .select('shopify_product_id, product_name, margin_per_unit')
      .eq('store_url', storeUrl)

    // Create margin lookup maps
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

    // Get supplier orders for line items
    const { data: supplierOrders } = await supabase
      .from('supplier_orders')
      .select('shopify_order_id, line_items')
      .eq('store_url', storeUrl)

    // Create supplier orders map
    const supplierOrdersMap = new Map()
    supplierOrders?.forEach(order => {
      supplierOrdersMap.set(order.shopify_order_id, order.line_items)
    })

    // Helper function to fetch order details from Shopify if needed
    const fetchOrderDetailsFromShopify = async (orderId: string) => {
      try {
        // Get store credentials
        const { data: storeConfig } = await supabase
          .from('store_configs')
          .select('access_token')
          .eq('store_url', storeUrl)
          .eq('is_active', true)
          .single()

        if (!storeConfig?.access_token) {
          console.log(`[New Wallet] No access token for store ${storeUrl}`)
          return null
        }

        // Fetch order from Shopify
        const response = await fetch(`https://${storeUrl}/admin/api/2023-10/orders/${orderId}.json`, {
          headers: {
            'X-Shopify-Access-Token': storeConfig.access_token
          }
        })

        if (!response.ok) {
          console.log(`[New Wallet] Failed to fetch order ${orderId} from Shopify: ${response.status}`)
          return null
        }

        const data = await response.json()
        return data.order?.line_items || null
      } catch (error) {
        console.error(`[New Wallet] Error fetching order ${orderId}:`, error)
        return null
      }
    }

    // Process orders and calculate wallet impact
    const orders = await Promise.all((orderStatuses || []).map(async (status) => {
      let marginAmount = 0
      let penaltyAmount = 0

      // For confirmed orders: Calculate margin directly from product margins
      if (status.status === 'confirmed') {
        let lineItems = supplierOrdersMap.get(status.shopify_order_id)
        
        // If no line items in supplier_orders, try to fetch from Shopify
        if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
          console.log(`[New Wallet] No line items in supplier_orders for ${status.order_number}, fetching from Shopify...`)
          lineItems = await fetchOrderDetailsFromShopify(status.shopify_order_id)
        }
        
        if (lineItems && Array.isArray(lineItems) && lineItems.length > 0) {
          // Use actual line items to calculate margins
          for (const item of lineItems) {
            const productId = String(item.product_id || item.productId || '')
            const productName = String(item.name || item.productName || item.title || '').toLowerCase().trim()
            const quantity = Number(item.quantity) || 0
            
            // Try to find margin by product ID first, then by name
            const marginPerUnit = marginByProductId.get(productId) || marginByProductName.get(productName) || 0
            const itemMargin = marginPerUnit * quantity
            marginAmount += itemMargin
            
            console.log(`[New Wallet] Order ${status.order_number} - Item: "${item.name || item.title}" (ID: ${productId}) - Qty: ${quantity} - Margin/unit: ₹${marginPerUnit} - Item Total: ₹${itemMargin}`)
          }
        } else {
          // No line items found anywhere - mark as NA
          marginAmount = -1 // Special value to indicate NA
          console.log(`[New Wallet] Order ${status.order_number} - No line items found anywhere, cannot determine product - marking as NA`)
        }
        console.log(`[New Wallet] Order ${status.order_number} - Final calculated margin: ₹${marginAmount}`)
      }

      // For RTO orders: Use seller-specific RTO rate (same as current system)
      if (status.status === 'rto') {
        penaltyAmount = rtoRate
      }

      return {
        id: status.shopify_order_id,
        orderNumber: status.order_number,
        status: status.status,
        storeUrl: status.store_url,
        updatedAt: status.updated_at,
        marginAmount,
        penaltyAmount,
        productDetails: null // Calculated on-the-fly, no stored details needed
      }
    }))

    // Calculate total margins and penalties from the calculated orders (excluding NA orders)
    const confirmedOrders = orders.filter(o => o.status === 'confirmed' && o.marginAmount !== -1)
    const rtoOrders = orders.filter(o => o.status === 'rto')
    const totalMargins = confirmedOrders.reduce((sum, o) => sum + o.marginAmount, 0)
    const totalPenalties = rtoOrders.reduce((sum, o) => sum + o.penaltyAmount, 0)
    
    // Calculate new wallet balance
    const newWalletBalance = totalMargins - totalPenalties

    // Get transaction history
    const transactionHistory = await WalletService.getTransactionHistory(storeUrl)

    return NextResponse.json({
      success: true,
      data: {
        orders,
        balance: newWalletBalance,
        transactions: transactionHistory,
        summary: {
          totalOrders: orders.length,
          confirmedOrders: confirmedOrders.length,
          rtoOrders: rtoOrders.length,
          totalMargins,
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

// POST - Process order confirmation or RTO (trigger wallet transactions)
export async function POST(request: Request) {
  try {
    const { orderNumber, storeUrl, action } = await request.json()

    if (!orderNumber || !storeUrl || !action) {
      return NextResponse.json({
        success: false,
        error: 'Order number, store URL, and action are required'
      }, { status: 400 })
    }

    let result
    let transactionAmount = 0

    switch (action) {
      case 'confirm':
        // Get margin from new_order_margins table
        const { data: marginData } = await supabase
          .from('new_order_margins')
          .select('margin_amount')
          .eq('order_number', orderNumber)
          .eq('store_url', storeUrl)
          .single()

        const marginAmount = Number(marginData?.margin_amount) || 0
        transactionAmount = marginAmount
        
        result = await WalletService.addMarginEarned(
          storeUrl, 
          orderNumber, 
          orderNumber, 
          marginAmount,
          'Margin from new wallet system'
        )
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

        transactionAmount = -rtoPenaltyAmount
        result = await WalletService.deductRTOTPenalty(storeUrl, orderNumber, orderNumber, rtoPenaltyAmount)
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
        transactionAmount
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
