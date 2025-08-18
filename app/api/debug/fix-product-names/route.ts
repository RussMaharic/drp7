import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeUrl = searchParams.get('store') || 'teast32123.myshopify.com';

    // Get all mappings with NULL product names
    const { data: nullMappings } = await supabase
      .from('product_shopify_mappings')
      .select('*')
      .eq('shopify_store_url', storeUrl)
      .is('product_name', null);

    console.log(`Found ${nullMappings?.length || 0} mappings with NULL product names`);

    // Get live orders to extract product names
    const baseUrl = request.url.split('/api')[0];
    let externalOrders: any[] = [];
    try {
      const res = await fetch(`${baseUrl}/api/stores/orders?storeUrl=${encodeURIComponent(storeUrl)}`, { cache: 'no-store' });
      if (res.ok) {
        const payload = await res.json();
        externalOrders = payload.orders || [];
      }
    } catch (e) {
      console.warn('Could not fetch orders:', e);
    }

    // Build map of productId -> productName from live orders
    const productIdToName = new Map<string, string>();
    externalOrders.forEach(order => {
      order.lineItems?.forEach((item: any) => {
        if (item.productId && item.name) {
          const normalizedId = String(item.productId).replace(/^gid:\/\/shopify\/Product\//, '');
          productIdToName.set(normalizedId, item.name);
        }
      });
    });

    const updates = [];
    for (const mapping of nullMappings || []) {
      const productName = productIdToName.get(mapping.shopify_product_id);
      if (productName) {
        updates.push({
          id: mapping.id,
          product_name: productName
        });
      }
    }

    // Update the mappings
    let updatedCount = 0;
    for (const update of updates) {
      const { error } = await supabase
        .from('product_shopify_mappings')
        .update({ product_name: update.product_name })
        .eq('id', update.id);
      
      if (!error) {
        updatedCount++;
        console.log(`Updated mapping ${update.id} with product name: ${update.product_name}`);
      } else {
        console.error(`Failed to update mapping ${update.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} product mappings with names`,
      nullMappingsFound: nullMappings?.length || 0,
      productNamesFromOrders: productIdToName.size,
      updatedCount
    });

  } catch (error) {
    console.error('Fix product names error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

