import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Calculate margin for an order based on its line items and product mappings
export async function POST(request: Request) {
  try {
    const { orderId, storeUrl } = await request.json();

    if (!orderId || !storeUrl) {
      return NextResponse.json({ error: 'orderId and storeUrl are required' }, { status: 400 });
    }

    console.log(`Calculating margin for order ${orderId} in store ${storeUrl}`);

    // Try to get live order data from Shopify to calculate margin
    let calculatedMargin = 0;
    let productDetails: any = {};

    try {
      // Get live orders from Shopify (if available)
      const baseUrl = request.url.split('/api')[0];
      const res = await fetch(`${baseUrl}/api/stores/orders?storeUrl=${encodeURIComponent(storeUrl)}`, { 
        cache: 'no-store',
        headers: {
          'cookie': request.headers.get('cookie') || ''
        }
      });
      
      if (res.ok) {
        const payload = await res.json();
        const orders = payload.orders || [];
        const order = orders.find((o: any) => o.orderNumber === orderId || o.id === orderId);
        
        if (order && order.lineItems) {
          // Get product mappings for this store
          const { data: productMappings } = await supabase
            .from('product_shopify_mappings')
            .select('shopify_product_id, product_name, margin')
            .eq('shopify_store_url', storeUrl);

          // Calculate margin from line items
          const marginByProductId = new Map<string, number>();
          const marginByProductName = new Map<string, number>();
          
          productMappings?.forEach(m => {
            if (m.shopify_product_id) {
              marginByProductId.set(String(m.shopify_product_id), Number(m.margin) || 0);
            }
            if (m.product_name) {
              marginByProductName.set(m.product_name.toLowerCase().trim(), Number(m.margin) || 0);
            }
          });

          const itemDetails: any[] = [];
          for (const lineItem of order.lineItems) {
            const productId = String(lineItem.productId || '');
            const productName = String(lineItem.name || '').toLowerCase().trim();
            const quantity = Number(lineItem.quantity) || 0;
            
            // Try to find margin by product ID first, then by name
            let margin = marginByProductId.get(productId) || marginByProductName.get(productName) || 0;
            const itemMargin = margin * quantity;
            calculatedMargin += itemMargin;
            
            itemDetails.push({
              product_id: lineItem.productId,
              product_name: lineItem.name,
              quantity: quantity,
              margin_per_unit: margin,
              total_margin: itemMargin
            });
          }
          
          productDetails = {
            line_items: itemDetails,
            total_items: order.lineItems.length,
            calculated_at: new Date().toISOString()
          };
        }
      }
    } catch (error) {
      console.warn('Could not fetch live order data, using fallback calculation:', error);
      
      // Fallback: Use product mappings with default quantities
      const { data: productMappings } = await supabase
        .from('product_shopify_mappings')
        .select('margin')
        .eq('shopify_store_url', storeUrl);
      
      // For fallback, assume 1 quantity of the first available product
      if (productMappings && productMappings.length > 0) {
        calculatedMargin = Number(productMappings[0].margin) || 0;
        productDetails = { fallback: true, margin_used: calculatedMargin };
      }
    }

    // Update or insert the margin in order_margins table
    const { error: upsertError } = await supabase
      .from('order_margins')
      .upsert({
        shopify_order_id: orderId,
        order_number: orderId, // Assuming they're the same for now
        store_url: storeUrl,
        margin_amount: calculatedMargin,
        product_details: productDetails
      }, {
        onConflict: 'shopify_order_id,store_url'
      });

    if (upsertError) {
      console.error('Error updating order margin:', upsertError);
      return NextResponse.json({ error: 'Failed to update margin' }, { status: 500 });
    }

    console.log(`Successfully calculated margin ${calculatedMargin} for order ${orderId}`);

    return NextResponse.json({
      success: true,
      orderId,
      storeUrl,
      calculatedMargin,
      productDetails
    });

  } catch (error) {
    console.error('Error calculating order margin:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

