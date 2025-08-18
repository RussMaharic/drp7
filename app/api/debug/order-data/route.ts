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

    // Check order_status table
    const { data: orderStatus } = await supabase
      .from('order_status')
      .select('*')
      .eq('shopify_order_id', orderId)
      .eq('store_url', storeUrl);

    // Check supplier_orders table
    const { data: supplierOrders } = await supabase
      .from('supplier_orders')
      .select('*')
      .eq('shopify_order_id', orderId)
      .eq('store_url', storeUrl);

    // Check all supplier_orders for this store
    const { data: allSupplierOrders } = await supabase
      .from('supplier_orders')
      .select('shopify_order_id, order_number, line_items')
      .eq('store_url', storeUrl)
      .limit(10);

    // Check all order_status for this store  
    const { data: allOrderStatus } = await supabase
      .from('order_status')
      .select('shopify_order_id, order_number, status')
      .eq('store_url', storeUrl)
      .limit(10);

    // Get product mappings
    const { data: productMappings } = await supabase
      .from('product_shopify_mappings')
      .select('*')
      .eq('shopify_store_url', storeUrl);

    return NextResponse.json({
      searchParams: { storeUrl, orderId },
      orderStatus: orderStatus || [],
      supplierOrders: supplierOrders || [],
      allSupplierOrdersForStore: allSupplierOrders || [],
      allOrderStatusForStore: allOrderStatus || [],
      productMappings: productMappings?.map(m => ({
        shopify_product_id: m.shopify_product_id,
        supplier_product_id: m.supplier_product_id,
        margin: m.margin
      })) || []
    });

  } catch (error) {
    console.error('Order data debug error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
