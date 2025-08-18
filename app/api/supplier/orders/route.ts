import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(request: Request) {
  try {
    console.log('Supplier orders API called')
    
    // Get the supplier name from query parameters for backwards compatibility
    const { searchParams } = new URL(request.url)
    const supplierName = searchParams.get('supplierName')
    const forceSync = searchParams.get('sync') === 'true'
    
    let supplierId: string
    
    // Try Supabase authentication first
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    console.log('User check:', { user: user?.email, error: userError })
    
    if (userError || !user) {
      console.log('No Supabase user found, checking supplier name parameter')
      
      if (supplierName) {
        // Use the supplier name from the request parameter (localStorage fallback)
        supplierId = supplierName
        console.log('Using supplier name from parameter:', supplierId)
      } else {
        return NextResponse.json({ error: "Authentication required - no user or supplier name provided" }, { status: 401 })
      }
    } else {
      // Get supplier data from suppliers table using user email
      const { data: supplierData, error: supplierError } = await supabase
        .from('suppliers')
        .select('username')
        .eq('email', user.email)
        .single()

      console.log('Supplier data query:', { supplierData, error: supplierError, email: user.email })

      if (supplierError || !supplierData) {
        console.log('Supplier not found in database, checking supplier name parameter')
        
        if (supplierName) {
          // Fallback to supplier name from parameter
          supplierId = supplierName
          console.log('Using supplier name from parameter as fallback:', supplierId)
        } else {
          return NextResponse.json({ error: `Supplier not found for email: ${user.email}` }, { status: 404 })
        }
      } else {
        // Use the actual username from suppliers table
        supplierId = supplierData.username
        console.log('Found supplier ID from database:', supplierId)
      }
    }

    // First, let's check if we have any product mappings at all
    console.log('🔍 Checking product mappings...')
    const { data: allMappings, error: mappingsError } = await supabase
      .from('product_shopify_mappings')
      .select('*')
    
    console.log(`📊 Total product mappings found: ${allMappings?.length || 0}`)
    if (allMappings && allMappings.length > 0) {
      console.log('📋 Sample mappings:', allMappings.slice(0, 3))
    }

    // Check if we should sync orders first
    if (forceSync) {
      console.log('🔄 Force sync requested, triggering order sync...')
      try {
        const syncResponse = await fetch(`${request.url.split('/api')[0]}/api/sync-orders`, {
          method: 'POST'
        })
        const syncResult = await syncResponse.json()
        console.log('🔄 Sync response:', syncResult)
        if (syncResponse.ok) {
          console.log('✅ Order sync completed successfully:', syncResult)
        } else {
          console.log('❌ Order sync failed:', syncResult)
        }
      } catch (error) {
        console.log('💥 Error during sync:', error)
      }
    }

    // First, get all product IDs for this supplier
    console.log(`Getting products for supplier: ${supplierId}`)
    const { data: supplierProducts, error: productsError } = await supabase
      .from('products')
      .select('id')
      .eq('supplier_id', supplierId)

    if (productsError) {
      console.error('Error fetching supplier products:', productsError)
      return NextResponse.json({ error: "Failed to fetch supplier products" }, { status: 500 })
    }

    const supplierProductIds = supplierProducts?.map(p => p.id) || []
    console.log(`Found ${supplierProductIds.length} products for supplier ${supplierId}`)

    if (supplierProductIds.length === 0) {
      console.log('No products found for this supplier')
      return NextResponse.json({ orders: [] })
    }

    // Get orders that contain any products from this supplier's catalog
    console.log(`Fetching orders containing supplier products from all accounts`)
    
    // First get unique order IDs that contain supplier products
    const { data: orderIds, error: orderIdsError } = await supabase
      .from('supplier_order_items')
      .select('supplier_order_id')
      .in('supplier_product_id', supplierProductIds)

    if (orderIdsError) {
      console.error('Error fetching order IDs for supplier products:', orderIdsError)
      return NextResponse.json({ error: "Failed to fetch order IDs" }, { status: 500 })
    }

    const uniqueOrderIds = [...new Set(orderIds?.map(item => item.supplier_order_id) || [])]
    console.log(`Found ${uniqueOrderIds.length} unique orders containing supplier products`)

    if (uniqueOrderIds.length === 0) {
      console.log('No orders found containing supplier products')
      return NextResponse.json({ orders: [] })
    }

    // Now get the full order details for those orders
    const { data: supplierOrders, error: ordersError } = await supabase
      .from('supplier_orders')
      .select(`
        *,
        supplier_order_items (
          id,
          shopify_line_item_id,
          shopify_product_id,
          supplier_product_id,
          product_name,
          quantity,
          price,
          variant_id,
          sku
        )
      `)
      .in('id', uniqueOrderIds)
      .order('order_date', { ascending: false })

    if (ordersError) {
      console.error('Error fetching supplier orders from Supabase:', ordersError)
      return NextResponse.json({ error: "Failed to fetch supplier orders" }, { status: 500 })
    }

    console.log(`Found ${supplierOrders?.length || 0} orders for supplier ${supplierId}`)

    if (!supplierOrders || supplierOrders.length === 0) {
      // If no orders found, try to sync once
      if (!forceSync) {
        console.log('📭 No orders found, triggering automatic sync...')
        try {
          const syncResponse = await fetch(`${request.url.split('/api')[0]}/api/sync-orders`, {
            method: 'POST'
          })
          const syncResult = await syncResponse.json()
          console.log('🔄 Auto sync response:', syncResult)
          
          if (syncResponse.ok) {
            console.log('✅ Auto sync completed, refetching orders...')
            // Refetch after sync using the same two-step logic as the main query
            const { data: freshOrderIds } = await supabase
              .from('supplier_order_items')
              .select('supplier_order_id')
              .in('supplier_product_id', supplierProductIds)

            const freshUniqueOrderIds = [...new Set(freshOrderIds?.map(item => item.supplier_order_id) || [])]
            
            if (freshUniqueOrderIds.length > 0) {
              const { data: freshOrders } = await supabase
                .from('supplier_orders')
                .select(`
                  *,
                  supplier_order_items (
                    id,
                    shopify_line_item_id,
                    shopify_product_id,
                    supplier_product_id,
                    product_name,
                    quantity,
                    price,
                    variant_id,
                    sku
                  )
                `)
                .in('id', freshUniqueOrderIds)
                .order('order_date', { ascending: false })
              
              console.log(`📦 After sync: Found ${freshOrders?.length || 0} orders`)
              
              if (freshOrders && freshOrders.length > 0) {
                return NextResponse.json({ 
                  orders: transformSupplierOrdersForResponse(freshOrders, supplierProductIds),
                  synced: true
                })
              }
            }
          } else {
            console.log('❌ Auto sync failed:', syncResult)
          }
        } catch (error) {
          console.log('💥 Auto sync error:', error)
        }
      }
      
      console.log('🚫 Returning empty orders array')
      return NextResponse.json({ orders: [] })
    }

    // Transform Supabase orders to match the expected response format
    const transformedOrders = transformSupplierOrdersForResponse(supplierOrders, supplierProductIds)

    console.log(`Returning ${transformedOrders.length} transformed orders`)

    return NextResponse.json({ orders: transformedOrders })

  } catch (error) {
    console.error('Error in supplier orders API:', error)
    return NextResponse.json({ 
      error: "Failed to fetch supplier orders" 
    }, { status: 500 })
  }
}

// Helper function to transform Supabase orders to response format
function transformSupplierOrdersForResponse(supplierOrders: any[], supplierProductIds: string[]) {
  return supplierOrders.map(order => {
    // Parse shipping and billing addresses from JSON
    let shippingAddress = null
    let billingAddress = null
    
    try {
      if (order.shipping_address) {
        shippingAddress = typeof order.shipping_address === 'string' 
          ? JSON.parse(order.shipping_address) 
          : order.shipping_address
      }
      if (order.billing_address) {
        billingAddress = typeof order.billing_address === 'string' 
          ? JSON.parse(order.billing_address) 
          : order.billing_address
      }
    } catch (error) {
      console.log('Error parsing address data:', error)
    }

    // Filter order items to only include products from this supplier
    const supplierOrderItems = order.supplier_order_items?.filter((item: any) => 
      supplierProductIds.includes(item.supplier_product_id)
    ) || []

    // Calculate supplier-specific amount based on their products only
    const supplierAmount = supplierOrderItems.reduce((total: number, item: any) => {
      return total + (parseFloat(item.price || '0') * item.quantity)
    }, 0)

    return {
      id: order.shopify_order_id,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      customerPhone: order.customer_phone || null,
      shippingAddress: shippingAddress,
      billingAddress: billingAddress,
      status: order.status,
      financialStatus: order.financial_status,
      amount: supplierAmount, // Show only the amount for supplier's products
      currency: order.currency,
      date: order.order_date,
      store: order.store_url,
      supplierProducts: supplierOrderItems.map((item: any) => ({
        id: item.shopify_line_item_id,
        name: item.product_name,
        quantity: item.quantity,
        price: parseFloat(item.price || '0'),
        productId: item.supplier_product_id,
        variantId: item.variant_id,
        shopifyProductId: item.shopify_product_id,
        sku: item.sku
      }))
    }
  })
}