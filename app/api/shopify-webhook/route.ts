import { NextResponse } from "next/server"
import crypto from "crypto"
import { supabase } from '@/lib/supabase'

// Webhook secret from Shopify (you'll need to set this in your environment variables)
const WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET || "your-webhook-secret"

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const hmacHeader = request.headers.get("x-shopify-hmac-sha256")
    const topicHeader = request.headers.get("x-shopify-topic")
    const shopHeader = request.headers.get("x-shopify-shop-domain")

    console.log(`Webhook received: ${topicHeader} from ${shopHeader}`)

    // Verify webhook signature (optional but recommended for security)
    if (WEBHOOK_SECRET !== "your-webhook-secret") {
      const expectedHmac = crypto
        .createHmac("sha256", WEBHOOK_SECRET)
        .update(body, "utf8")
        .digest("base64")

      if (hmacHeader !== expectedHmac) {
        console.error("Webhook signature verification failed")
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
      }
    }

    // Parse the webhook payload
    let payload
    try {
      payload = JSON.parse(body)
    } catch (error) {
      console.error("Failed to parse webhook payload:", error)
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    // Handle different webhook topics
    switch (topicHeader) {
      case "orders/create":
        console.log("New order created:", payload.id)
        try {
          const storeUrl = shopHeader
          const orderNumber = String(payload.order_number || payload.id)

          // Calculate margin at order creation using product_margins
          let totalMargin = 0
          const lineItems = payload.line_items || []

          if (lineItems.length > 0) {
            // Fetch product margins for this store
            const { data: productMargins } = await supabase
              .from('product_margins')
              .select('shopify_product_id, product_name, margin_per_unit')
              .eq('shopify_store_url', storeUrl)

            const marginByProductId = new Map<string, number>()
            const marginByProductName = new Map<string, number>()
            productMargins?.forEach(m => {
              if (m.shopify_product_id) {
                marginByProductId.set(String(m.shopify_product_id), Number(m.margin_per_unit) || 0)
              }
              if (m.product_name) {
                marginByProductName.set(String(m.product_name).toLowerCase().trim(), Number(m.margin_per_unit) || 0)
              }
            })

            for (const item of lineItems) {
              const productId = String(item.product_id || '')
              const productName = String(item.name || '').toLowerCase().trim()
              const quantity = Number(item.quantity) || 0
              const marginPerUnit = marginByProductId.get(productId) || marginByProductName.get(productName) || 0
              totalMargin += marginPerUnit * quantity
            }
          }

          // Upsert into order_margins so it's ready when the order becomes confirmed
          const { error: upsertError } = await supabase
            .from('order_margins')
            .upsert({
              shopify_order_id: orderNumber,
              order_number: orderNumber,
              store_url: storeUrl,
              margin_amount: totalMargin,
              product_details: {
                note: 'Created on orders/create webhook; shown only when order is confirmed',
                total_calculated_margin: totalMargin,
                created_at: new Date().toISOString()
              }
            }, { onConflict: 'shopify_order_id,store_url' })

          if (upsertError) {
            console.error('[Webhook] Error upserting order_margins on create:', upsertError)
          } else {
            console.log(`[Webhook] Stored preliminary margin for order ${orderNumber}: ₹${totalMargin}`)
          }
        } catch (err) {
          console.error('[Webhook] Failed processing orders/create for margin pre-store:', err)
        }
        break

      case "orders/updated":
        console.log("Order updated:", payload.id)
        
        // Check if order is confirmed and add to order_margins if needed
        if (payload.confirmed && payload.financial_status === 'paid') {
          try {
            const storeUrl = shopHeader;
            const orderNumber = String(payload.order_number || payload.id);
            
            // Check if already exists in order_margins
            const { data: existingMargin } = await supabase
              .from('order_margins')
              .select('id')
              .eq('order_number', orderNumber)
              .eq('store_url', storeUrl)
              .single();
            
            if (!existingMargin) {
              // Calculate margin based on line items and product mappings
              let calculatedMargin = 0;
              const lineItems = payload.line_items || [];
              
              console.log(`[Webhook] Processing ${lineItems.length} line items for order ${orderNumber}`);
              
              if (lineItems.length > 0) {
                // Get product margins for this store
                const { data: productMappings } = await supabase
                  .from('product_margins')
                  .select('shopify_product_id, product_name, margin_per_unit')
                  .eq('shopify_store_url', storeUrl);
                
                console.log(`[Webhook] Found ${productMappings?.length || 0} product mappings for store ${storeUrl}`);
                
                // Create lookup maps
                const marginByProductId = new Map();
                const marginByProductName = new Map();
                productMappings?.forEach(m => {
                  if (m.shopify_product_id) {
                    marginByProductId.set(String(m.shopify_product_id), Number(m.margin_per_unit) || 0);
                  }
                  if (m.product_name) {
                    marginByProductName.set(m.product_name.toLowerCase().trim(), Number(m.margin_per_unit) || 0);
                  }
                });
                
                // Calculate total margin for all line items
                const marginDetails = [];
                for (const item of lineItems) {
                  const productId = String(item.product_id || '');
                  const productName = String(item.name || '').toLowerCase().trim();
                  const quantity = Number(item.quantity) || 0;
                  
                  // Try to find margin by product ID first, then by name
                  let itemMargin = marginByProductId.get(productId) || marginByProductName.get(productName) || 0;
                  const totalItemMargin = itemMargin * quantity;
                  calculatedMargin += totalItemMargin;
                  
                  marginDetails.push({
                    product_id: productId,
                    product_name: item.name,
                    quantity: quantity,
                    unit_margin: itemMargin,
                    total_margin: totalItemMargin
                  });
                  
                  console.log(`[Webhook] Item: ${item.name} (ID: ${productId}) - Qty: ${quantity}, Unit margin: ₹${itemMargin}, Total: ₹${totalItemMargin}`);
                }
                
                console.log(`[Webhook] Total calculated margin for order ${orderNumber}: ₹${calculatedMargin}`);
              }
              
              // Upsert calculated margin into order_margins (may already exist from orders/create)
              const { error: insertError } = await supabase
                .from('order_margins')
                .upsert({
                  shopify_order_id: orderNumber,
                  order_number: orderNumber,
                  store_url: storeUrl,
                  margin_amount: calculatedMargin,
                  product_details: {
                    line_items: lineItems.map(item => ({
                      product_id: item.product_id,
                      product_name: item.name,
                      quantity: item.quantity,
                      price: item.price
                    })),
                    margin_calculation: marginDetails,
                    auto_calculated: true,
                    webhook_processed: true,
                    created_at: new Date().toISOString()
                  }
                }, { onConflict: 'shopify_order_id,store_url' });
              
              if (!insertError) {
                console.log(`[Webhook] Successfully added order margin: ${orderNumber} = ₹${calculatedMargin}`);
              } else {
                console.error('[Webhook] Error inserting order margin:', insertError);
              }
            }
          } catch (marginError) {
            console.error('Error processing order margin in webhook:', marginError);
          }
        }
        break

      case "products/create":
        console.log("New product created:", payload.id)
        // Handle new product
        break

      case "products/update":
        console.log("Product updated:", payload.id)
        // Handle product update
        break

      case "app/uninstalled":
        console.log("App uninstalled from shop:", shopHeader)
        // Handle app uninstallation
        break

      default:
        console.log(`Unhandled webhook topic: ${topicHeader}`)
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error("Webhook processing error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// Handle GET requests (for webhook verification)
export async function GET(request: Request) {
  return NextResponse.json({ 
    message: "Shopify webhook endpoint is active",
    status: "ok"
  })
} 