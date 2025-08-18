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

    // 1. Get order from order_status
    const { data: orderStatus } = await supabase
      .from('order_status')
      .select('*')
      .eq('shopify_order_id', orderId)
      .eq('store_url', storeUrl)
      .single();

    if (!orderStatus) {
      return NextResponse.json({ error: 'Order not found in order_status' }, { status: 404 });
    }

    // 2. Get ALL product mappings for this store
    const { data: productMappings } = await supabase
      .from('product_shopify_mappings')
      .select('*')
      .eq('shopify_store_url', storeUrl);

    // 3. Calculate total margin for ALL products from this store
    let totalMarginAllProducts = 0;
    const productCalculations = [];

    if (productMappings) {
      for (const mapping of productMappings) {
        const margin = Number(mapping.margin) || 0;
        totalMarginAllProducts += margin;
        
        productCalculations.push({
          shopify_product_id: mapping.shopify_product_id,
          supplier_product_id: mapping.supplier_product_id,
          margin: margin
        });
      }
    }

    return NextResponse.json({
      orderId,
      storeUrl,
      orderStatus: {
        id: orderStatus.id,
        order_number: orderStatus.order_number,
        status: orderStatus.status,
        created_at: orderStatus.created_at
      },
      productMappings: productCalculations,
      totalMarginAllProducts,
      productMappingsCount: productMappings?.length || 0
    });

  } catch (error) {
    console.error('Direct margin debug error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
