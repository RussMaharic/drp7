import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeUrl = searchParams.get('store');

    if (!storeUrl) {
      return NextResponse.json({ error: 'store parameter required' }, { status: 400 });
    }

    // Get all wallet transactions for this store
    const { data: transactions } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('store_url', storeUrl)
      .order('created_at', { ascending: false });

    // Get product mappings
    const { data: productMappings } = await supabase
      .from('product_shopify_mappings')
      .select('*')
      .eq('shopify_store_url', storeUrl);

    return NextResponse.json({
      storeUrl,
      transactions: transactions || [],
      productMappings: productMappings?.map(m => ({
        shopify_product_id: m.shopify_product_id,
        supplier_product_id: m.supplier_product_id,
        margin: m.margin
      })) || []
    });

  } catch (error) {
    console.error('Wallet transactions debug error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

