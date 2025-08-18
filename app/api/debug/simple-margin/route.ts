import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeUrl = searchParams.get('store');
    const orderId = searchParams.get('orderId');

    if (!storeUrl || !orderId) {
      return NextResponse.json({ error: 'store and orderId parameters required' }, { status: 400 });
    }

    // 1. Get the order from supplier_orders
    const { data: supplierOrder } = await supabase
      .from('supplier_orders')
      .select('*')
      .eq('shopify_order_id', orderId)
      .eq('store_url', storeUrl)
      .single();

    if (!supplierOrder) {
      return NextResponse.json({ error: 'Order not found in supplier_orders' }, { status: 404 });
    }

    // 2. Get product mappings for this store
    const { data: productMappings } = await supabase
      .from('product_shopify_mappings')
      .select('*')
      .eq('shopify_store_url', storeUrl);

    // 3. Calculate margin directly
    const items = supplierOrder.line_items || [];
    let totalMargin = 0;
    const calculations = [];

    for (const item of items) {
      const productId = String(item.product_id ?? item.productId ?? '');
      const mapping = productMappings?.find(m => String(m.shopify_product_id) === productId);
      const margin = Number(mapping?.margin) || 0;
      const quantity = Number(item.quantity) || 0;
      const itemTotal = margin * quantity;
      totalMargin += itemTotal;

      calculations.push({
        product_id: productId,
        product_name: item.name,
        quantity: quantity,
        margin_per_unit: margin,
        item_total_margin: itemTotal,
        mapping_found: !!mapping
      });
    }

    return NextResponse.json({
      orderId,
      storeUrl,
      supplierOrder: {
        id: supplierOrder.id,
        order_number: supplierOrder.order_number,
        total_amount: supplierOrder.total_amount,
        line_items_count: items.length
      },
      productMappings: productMappings?.map(m => ({
        shopify_product_id: m.shopify_product_id,
        supplier_product_id: m.supplier_product_id,
        margin: m.margin
      })),
      marginCalculation: {
        totalMargin,
        itemCalculations: calculations
      }
    });

  } catch (error) {
    console.error('Simple margin debug error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
