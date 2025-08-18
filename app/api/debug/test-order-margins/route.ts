import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeUrl = searchParams.get('store') || 'teast32123.myshopify.com';

    // Test direct query to order_margins table
    const { data: orderMargins, error } = await supabase
      .from('order_margins')
      .select('*')
      .eq('store_url', storeUrl);

    // Also test if table exists at all
    const { data: allMargins } = await supabase
      .from('order_margins')
      .select('*')
      .limit(10);

    return NextResponse.json({
      storeUrl,
      orderMarginsForStore: orderMargins || [],
      orderMarginsError: error,
      allOrderMargins: allMargins || [],
      tableExists: !!allMargins
    });

  } catch (error) {
    console.error('Test order margins error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

