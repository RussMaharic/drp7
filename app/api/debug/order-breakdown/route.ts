import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeUrl = searchParams.get('store');
    const orderId = searchParams.get('orderId');

    if (!storeUrl) {
      return NextResponse.json({ error: 'store parameter required' }, { status: 400 });
    }

    // 1. Get order status
    const { data: orderStatuses } = await supabase
      .from('order_status')
      .select('*')
      .eq('store_url', storeUrl)
      .order('updated_at', { ascending: false });

    // 2. Get supplier orders
    const orderIds = orderStatuses?.map(o => o.shopify_order_id) || []
    const { data: supplierOrders } = await supabase
      .from('supplier_orders')
      .select('*')
      .in('shopify_order_id', orderIds)
      .eq('store_url', storeUrl);

    // 3. Get supplier order items
    const supplierOrderIds = supplierOrders?.map(o => o.id) || []
    const { data: supplierOrderItems } = await supabase
      .from('supplier_order_items')
      .select('*')
      .in('supplier_order_id', supplierOrderIds);

    // 4. Get product mappings
    const { data: productMappings } = await supabase
      .from('product_shopify_mappings')
      .select('*')
      .eq('shopify_store_url', storeUrl);

    // 5. Calculate what the margin should be for a specific order if provided
    let orderBreakdown = null;
    if (orderId) {
      const orderStatus = orderStatuses?.find(o => o.shopify_order_id === orderId);
      const supplierOrder = supplierOrders?.find(o => o.shopify_order_id === orderId);
      const items = supplierOrder ? supplierOrderItems?.filter(i => i.supplier_order_id === supplierOrder.id) : [];
      
      let totalMargin = 0;
      const itemCalculations = [];
      
      if (items && items.length > 0) {
        for (const item of items) {
          const mapping = productMappings?.find(m => 
            String(m.shopify_product_id) === String(item.shopify_product_id)
          );
          const margin = Number(mapping?.margin) || 0;
          const quantity = Number(item.quantity) || 0;
          const itemMargin = margin * quantity;
          totalMargin += itemMargin;
          
          itemCalculations.push({
            shopify_product_id: item.shopify_product_id,
            product_name: item.product_name,
            quantity: quantity,
            margin_per_unit: margin,
            item_total: itemMargin,
            mapping_found: !!mapping
          });
        }
      }
      
      orderBreakdown = {
        orderId,
        orderStatus,
        supplierOrder,
        items: items || [],
        itemCalculations,
        totalMargin
      };
    }

    return NextResponse.json({
      storeUrl,
      orderStatuses: orderStatuses?.map(o => ({
        shopify_order_id: o.shopify_order_id,
        order_number: o.order_number,
        status: o.status
      })) || [],
      supplierOrders: supplierOrders?.map(o => ({
        id: o.id,
        shopify_order_id: o.shopify_order_id,
        order_number: o.order_number
      })) || [],
      supplierOrderItems: supplierOrderItems?.map(i => ({
        supplier_order_id: i.supplier_order_id,
        shopify_product_id: i.shopify_product_id,
        product_name: i.product_name,
        quantity: i.quantity
      })) || [],
      productMappings: productMappings?.map(m => ({
        shopify_product_id: m.shopify_product_id,
        margin: m.margin
      })) || [],
      orderBreakdown
    });

  } catch (error) {
    console.error('Order breakdown debug error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

