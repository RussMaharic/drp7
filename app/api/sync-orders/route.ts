import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { TokenManager } from "@/lib/token-manager"

// Function to sync orders from Shopify to Supabase
export async function POST(request: Request) {
  try {
    console.log('Starting order sync process...')
    
    // Get all connected stores
    const connectedStores = await TokenManager.getAllStores()
    console.log(`Found ${connectedStores.length} connected stores`)

    if (connectedStores.length === 0) {
      return NextResponse.json({ message: "No connected stores found" })
    }

    let totalOrdersSynced = 0
    const syncResults = []

    // Get all product mappings for filtering
    const { data: allMappings, error: mappingsError } = await supabase
      .from('product_shopify_mappings')
      .select('*')

    if (mappingsError) {
      console.error('Error fetching product mappings:', mappingsError)
      return NextResponse.json({ error: "Failed to fetch product mappings" }, { status: 500 })
    }

    console.log(`Found ${allMappings?.length || 0} product mappings`)

    // Process each store
    for (const store of connectedStores) {
      try {
        console.log(`Syncing orders from store: ${store.shop}`)
        
        // Get store-specific mappings
        const storeMappings = allMappings?.filter(mapping => mapping.shopify_store_url === store.shop) || []
        
        if (storeMappings.length === 0) {
          console.log(`No product mappings found for store ${store.shop}, skipping...`)
          continue
        }

        console.log(`Store ${store.shop} has ${storeMappings.length} product mappings`)

        // Fetch orders from Shopify for this store
        const storeOrders = await fetchOrdersFromStore(store.shop, request.url)
        
        if (!storeOrders || storeOrders.length === 0) {
          console.log(`No orders found for store ${store.shop}`)
          continue
        }

        console.log(`Found ${storeOrders.length} orders from ${store.shop}`)

        // Process and store orders
        const storeResult = await processAndStoreOrders(storeOrders, storeMappings, store.shop)
        syncResults.push({
          store: store.shop,
          ...storeResult
        })
        
        totalOrdersSynced += storeResult.ordersSynced

      } catch (error) {
        console.error(`Error syncing orders from store ${store.shop}:`, error)
        syncResults.push({
          store: store.shop,
          error: error.message,
          ordersSynced: 0,
          itemsSynced: 0
        })
      }
    }

    console.log(`Order sync completed. Total orders synced: ${totalOrdersSynced}`)

    return NextResponse.json({
      message: "Order sync completed",
      totalOrdersSynced,
      storeResults: syncResults
    })

  } catch (error) {
    console.error('Error in order sync:', error)
    return NextResponse.json({ 
      error: "Failed to sync orders",
      details: error.message 
    }, { status: 500 })
  }
}

// Function to fetch orders from a specific Shopify store
async function fetchOrdersFromStore(shop: string, requestUrl: string): Promise<any[]> {
  try {
    const baseUrl = requestUrl.split('/api')[0]
    
    // Try GraphQL API first
    try {
      const graphqlResponse = await fetch(`${baseUrl}/api/shopify-orders-graphql?shop=${shop}`)
      if (graphqlResponse.ok) {
        const graphqlData = await graphqlResponse.json()
        return graphqlData.orders || []
      }
    } catch (error) {
      console.log(`GraphQL API failed for ${shop}:`, error)
    }
    
    // Fallback to REST API
    try {
      const restResponse = await fetch(`${baseUrl}/api/shopify-orders?shop=${shop}`)
      if (restResponse.ok) {
        const restData = await restResponse.json()
        return restData.orders || []
      }
    } catch (error) {
      console.log(`REST API failed for ${shop}:`, error)
    }
    
    return []
  } catch (error) {
    console.error(`Error fetching orders from ${shop}:`, error)
    return []
  }
}

// Function to process and store orders in Supabase
async function processAndStoreOrders(orders: any[], mappings: any[], storeUrl: string) {
  let ordersSynced = 0
  let itemsSynced = 0
  const errors = []

  // Create mapping lookup
  const shopifyToSupplierMap = new Map()
  const supplierGroups = new Map() // Group by supplier_id
  
  mappings.forEach(mapping => {
    shopifyToSupplierMap.set(mapping.shopify_product_id, mapping)
    
    // Get supplier info from the first mapping (they should all be the same supplier for the store)
    const supplierProductId = mapping.supplier_product_id
    if (!supplierGroups.has(mapping.supplier_product_id)) {
      // We need to get supplier_id from the products table
      supplierGroups.set(mapping.supplier_product_id, mapping)
    }
  })

  // Get supplier info for the products
  const supplierProductIds = Array.from(supplierGroups.keys())
  const { data: supplierProducts, error: productsError } = await supabase
    .from('products')
    .select('id, supplier_id')
    .in('id', supplierProductIds)

  if (productsError) {
    console.error('Error fetching supplier products:', productsError)
    return { ordersSynced: 0, itemsSynced: 0, errors: ['Failed to fetch supplier products'] }
  }

  // Create supplier lookup
  const productToSupplierMap = new Map()
  supplierProducts?.forEach(product => {
    productToSupplierMap.set(product.id, product.supplier_id)
  })

         // Process each order
       for (const order of orders) {
         try {
           // Debug: Log order data
           console.log(`📝 Processing order ${order.id}:`, {
             customerPhone: order.customerPhone,
             hasShipping: !!order.shippingAddress,
             hasBilling: !!order.billingAddress
           })
      // Check if order contains any mapped products
      const relevantItems = order.lineItems?.filter(item => 
        shopifyToSupplierMap.has(item.productId?.toString())
      ) || []

      if (relevantItems.length === 0) {
        continue // Skip orders without mapped products
      }

      // Group items by supplier
      const supplierOrdersMap = new Map()
      
      relevantItems.forEach(item => {
        const mapping = shopifyToSupplierMap.get(item.productId?.toString())
        const supplierId = productToSupplierMap.get(mapping.supplier_product_id)
        
        if (!supplierId) return
        
        if (!supplierOrdersMap.has(supplierId)) {
          supplierOrdersMap.set(supplierId, {
            supplierId,
            items: [],
            totalRevenue: 0
          })
        }
        
        const supplierOrder = supplierOrdersMap.get(supplierId)
        supplierOrder.items.push({
          ...item,
          supplierProductId: mapping.supplier_product_id
        })
        supplierOrder.totalRevenue += (item.price * item.quantity)
      })

      // Create supplier orders in database
      for (const [supplierId, supplierOrderData] of supplierOrdersMap) {
        try {
          // Check if order already exists
          const { data: existingOrder } = await supabase
            .from('supplier_orders')
            .select('id')
            .eq('shopify_order_id', order.id.toString())
            .eq('supplier_id', supplierId)
            .eq('store_url', storeUrl)
            .single()

          let supplierOrderId

          if (existingOrder) {
            // Update existing order
            const { error: updateError } = await supabase
              .from('supplier_orders')
                             .update({
                 order_number: order.orderNumber || order.order_number,
                 order_name: order.name,
                 customer_name: order.customerName || 'Guest',
                 customer_email: order.customerEmail || 'No email',
                 customer_phone: order.customerPhone || null,
                 status: order.status || 'pending',
                financial_status: order.financialStatus || order.financial_status || 'pending',
                total_amount: order.amount || 0,
                currency: order.currency || 'INR',
                order_date: order.date || order.created_at,
                supplier_revenue: supplierOrderData.totalRevenue,
                shipping_address: order.shippingAddress,
                billing_address: order.billingAddress,
                tags: order.tags,
                note: order.note,
                last_synced_at: new Date().toISOString()
              })
              .eq('id', existingOrder.id)

            if (updateError) {
              console.error('Error updating order:', updateError)
              continue
            }
            
            supplierOrderId = existingOrder.id
          } else {
            // Create new order
            const { data: newOrder, error: insertError } = await supabase
              .from('supplier_orders')
                             .insert({
                 shopify_order_id: order.id.toString(),
                 order_number: order.orderNumber || order.order_number,
                 order_name: order.name,
                 customer_name: order.customerName || 'Guest',
                 customer_email: order.customerEmail || 'No email',
                 customer_phone: order.customerPhone || null,
                 status: order.status || 'pending',
                financial_status: order.financialStatus || order.financial_status || 'pending',
                total_amount: order.amount || 0,
                currency: order.currency || 'INR',
                order_date: order.date || order.created_at,
                store_url: storeUrl,
                supplier_id: supplierId,
                supplier_revenue: supplierOrderData.totalRevenue,
                shipping_address: order.shippingAddress,
                billing_address: order.billingAddress,
                tags: order.tags,
                note: order.note
              })
              .select('id')
              .single()

            if (insertError) {
              console.error('Error inserting order:', insertError)
              continue
            }
            
            supplierOrderId = newOrder.id
            ordersSynced++
          }

          // Delete existing items and insert new ones
          await supabase
            .from('supplier_order_items')
            .delete()
            .eq('supplier_order_id', supplierOrderId)

          // Insert order items
          const orderItems = supplierOrderData.items.map(item => ({
            supplier_order_id: supplierOrderId,
            shopify_line_item_id: item.id?.toString(),
            shopify_product_id: item.productId?.toString(),
            supplier_product_id: item.supplierProductId,
            product_name: item.name,
            quantity: item.quantity,
            price: item.price,
            variant_id: item.variantId?.toString(),
            sku: item.sku
          }))

          const { error: itemsError } = await supabase
            .from('supplier_order_items')
            .insert(orderItems)

          if (itemsError) {
            console.error('Error inserting order items:', itemsError)
          } else {
            itemsSynced += orderItems.length
          }

        } catch (error) {
          console.error(`Error processing order ${order.id} for supplier ${supplierId}:`, error)
          errors.push(`Order ${order.id}: ${error.message}`)
        }
      }

    } catch (error) {
      console.error(`Error processing order ${order.id}:`, error)
      errors.push(`Order ${order.id}: ${error.message}`)
    }
  }

  return { ordersSynced, itemsSynced, errors }
}

// GET endpoint to manually trigger sync
export async function GET(request: Request) {
  return POST(request)
}