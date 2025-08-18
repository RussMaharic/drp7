import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    // Add order 1007 with a default margin (you can specify the actual margin)
    const orderData = {
      shopify_order_id: '1007',
      order_number: '1007', 
      store_url: 'teast32123.myshopify.com',
      margin_amount: 0.00, // Set this to the actual margin for order 1007
      product_details: {
        note: 'Manually added for testing',
        created_at: new Date().toISOString()
      }
    };

    const { data, error } = await supabase
      .from('order_margins')
      .insert(orderData)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Order 1007 added to order_margins', 
      data: data[0] 
    });

  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

