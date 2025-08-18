import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeUrl = searchParams.get('store');
    const orderId = searchParams.get('orderId');

    if (!storeUrl) {
      return NextResponse.json({ error: 'store parameter required' }, { status: 400 });
    }

    const debugInfo: any = {
      storeUrl,
      orderId: orderId || 'all',
      timestamp: new Date().toISOString()
    };

    // 1. Check product mappings for this store
    const { data: productMappings } = await supabase
      .from('product_shopify_mappings')
      .select('*')
      .eq('shopify_store_url', storeUrl);

    debugInfo.productMappings = {
      count: productMappings?.length || 0,
      mappings: productMappings?.map(m => ({
        shopify_product_id: m.shopify_product_id,
        supplier_product_id: m.supplier_product_id,
        margin: m.margin,
        pushed_at: m.pushed_at
      })) || []
    };

    // 2. Check supplier orders for this store
    let supplierOrdersQuery = supabase
      .from('supplier_orders')
      .select('*')
      .eq('store_url', storeUrl);

    if (orderId) {
      supplierOrdersQuery = supplierOrdersQuery.eq('shopify_order_id', orderId);
    }

    const { data: supplierOrders } = await supplierOrdersQuery;

    debugInfo.supplierOrders = {
      count: supplierOrders?.length || 0,
      orders: supplierOrders?.map(o => ({
        shopify_order_id: o.shopify_order_id,
        order_number: o.order_number,
        total_amount: o.total_amount,
        line_items: o.line_items
      })) || []
    };

    // 3. Check wallet transactions for this store
    let walletTxnsQuery = supabase
      .from('wallet_transactions')
      .select('*')
      .eq('store_url', storeUrl);

    if (orderId) {
      walletTxnsQuery = walletTxnsQuery.eq('order_id', orderId);
    }

    const { data: walletTxns } = await walletTxnsQuery;

    debugInfo.walletTransactions = {
      count: walletTxns?.length || 0,
      transactions: walletTxns?.map(t => ({
        order_id: t.order_id,
        transaction_type: t.transaction_type,
        amount: t.amount,
        description: t.description,
        created_at: t.created_at
      })) || []
    };

    // 4. Check seller and RTO rates for this store
    const { data: storeConnection } = await supabase
      .from('seller_store_connections')
      .select('seller_id, seller_username')
      .eq('store_url', storeUrl)
      .eq('is_active', true)
      .single();

    debugInfo.storeConnection = storeConnection;

    if (storeConnection?.seller_id) {
      const { data: rtoRate } = await supabase
        .from('seller_rto_rates')
        .select('*')
        .eq('seller_id', storeConnection.seller_id)
        .eq('store_url', storeUrl)
        .eq('is_active', true)
        .single();

      debugInfo.rtoRate = rtoRate;
    }

    // 5. Compute margin for specific order if provided
    if (orderId && supplierOrders && supplierOrders.length > 0) {
      const order = supplierOrders[0];
      const items = order.line_items || [];
      
      const marginByProductId = new Map<string, number>();
      productMappings?.forEach(m => marginByProductId.set(String(m.shopify_product_id), Number(m.margin) || 0));

      let totalComputedMargin = 0;
      const marginBreakdown: any[] = [];

      for (const item of items) {
        const pid = String(item.product_id ?? item.productId ?? '');
        const perUnitMargin = marginByProductId.get(pid) || 0;
        const qty = Number(item.quantity) || 0;
        const itemMargin = perUnitMargin * qty;
        totalComputedMargin += itemMargin;

        marginBreakdown.push({
          product_id: pid,
          product_name: item.name || 'Unknown',
          quantity: qty,
          per_unit_margin: perUnitMargin,
          item_total_margin: itemMargin
        });
      }

      debugInfo.marginComputation = {
        orderId,
        totalComputedMargin,
        marginBreakdown
      };
    }

    return NextResponse.json(debugInfo, { status: 200 });

  } catch (error) {
    console.error('Debug margin flow error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
