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

    console.log('Searching for order:', { storeUrl, orderId });

    // Check all tables that might have order line items
    
    // 1. Check supplier_orders
    const { data: supplierOrder } = await supabase
      .from('supplier_orders')
      .select('*')
      .eq('shopify_order_id', orderId)
      .eq('store_url', storeUrl);

    // 2. Check if there's a shopify_orders table
    const { data: shopifyOrder } = await supabase
      .from('shopify_orders')
      .select('*')
      .eq('id', orderId)
      .eq('store_url', storeUrl);

    // 3. Check order_status for any line item data
    const { data: orderStatus } = await supabase
      .from('order_status')
      .select('*')
      .eq('shopify_order_id', orderId)
      .eq('store_url', storeUrl);

    // 4. Get product mappings
    const { data: productMappings } = await supabase
      .from('product_shopify_mappings')
      .select('*')
      .eq('shopify_store_url', storeUrl);

    // 5. List all tables to see what's available
    const { data: tables } = await supabase
      .rpc('get_table_names');

    return NextResponse.json({
      orderId,
      storeUrl,
      supplierOrder: supplierOrder || null,
      shopifyOrder: shopifyOrder || null,
      orderStatus: orderStatus || null,
      productMappings: productMappings || null,
      availableTables: tables || 'Could not fetch table names'
    });

  } catch (error) {
    console.error('Order line items debug error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

