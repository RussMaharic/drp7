import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Add margin for a new confirmed order
export async function POST(request: Request) {
  try {
    const { orderNumber, storeUrl, marginAmount, productDetails } = await request.json();

    if (!orderNumber || !storeUrl || marginAmount === undefined) {
      return NextResponse.json({ 
        error: 'orderNumber, storeUrl, and marginAmount are required' 
      }, { status: 400 });
    }

    console.log(`Adding margin for order ${orderNumber}: ₹${marginAmount}`);

    // Insert or update order_margins table 
    const { data, error } = await supabase
      .from('order_margins')
      .upsert({
        shopify_order_id: orderNumber,
        order_number: orderNumber,
        store_url: storeUrl,
        margin_amount: marginAmount,
        product_details: productDetails || { manually_added: true, created_at: new Date().toISOString() }
      }, {
        onConflict: 'shopify_order_id,store_url'
      })
      .select();

    if (error) {
      console.error('Error adding order margin:', error);
      return NextResponse.json({ 
        error: 'Failed to add order margin',
        details: error.message 
      }, { status: 500 });
    }

    console.log(`Successfully added margin ₹${marginAmount} for order ${orderNumber}`);

    return NextResponse.json({
      success: true,
      orderNumber,
      storeUrl,
      marginAmount,
      data: data[0]
    });

  } catch (error) {
    console.error('Error in add-margin API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
