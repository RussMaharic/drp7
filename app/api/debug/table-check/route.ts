import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeUrl = searchParams.get('store') || 'teast32123.myshopify.com';

    // Check table structure
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'product_shopify_mappings' })
      .single();

    // Get current mappings
    const { data: mappings } = await supabase
      .from('product_shopify_mappings')
      .select('*')
      .eq('shopify_store_url', storeUrl);

    // Get some sample orders to see what we're working with
    const { data: sampleOrders } = await supabase
      .from('order_status')
      .select('*')
      .eq('store_url', storeUrl)
      .limit(3);

    return NextResponse.json({
      storeUrl,
      tableColumns: columns || 'Could not fetch',
      columnsError,
      currentMappings: mappings || [],
      sampleOrders: sampleOrders || [],
      mappingsCount: mappings?.length || 0
    });

  } catch (error) {
    console.error('Table check error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

