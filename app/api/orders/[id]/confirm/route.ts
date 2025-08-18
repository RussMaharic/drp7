import { NextResponse } from 'next/server';
import { getShopToken } from '../../../auth/shopify/route';
import { OrderWalletService } from '@/lib/services/order-wallet-service';
import { supabase } from '@/lib/supabase';

// POST to confirm an order
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const shop = searchParams.get('shop');
    const orderId = params.id;

    if (!shop || !orderId) {
      return NextResponse.json(
        { error: 'Missing shop or order ID parameter' },
        { status: 400 }
      );
    }

    const accessToken = await getShopToken(shop);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Missing access token. Please connect to Shopify first.' },
        { status: 401 }
      );
    }

    // Extract numeric order ID (remove GraphQL prefix if present)
    const numericOrderId = orderId.startsWith('gid://') ? orderId.split('/').pop() : orderId;
    console.log(`Confirming order ${orderId} (Numeric ID: ${numericOrderId}) from shop: ${shop}`);

    // First, get the current order details
    const orderResponse = await fetch(`https://${shop}/admin/api/2025-01/orders/${numericOrderId}.json`, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      console.error('Error fetching order details:', errorText);
      return NextResponse.json(
        { error: `Failed to fetch order details: ${orderResponse.status}` },
        { status: orderResponse.status }
      );
    }

    const orderData = await orderResponse.json();
    const order = orderData.order;

    // Update order status in database to confirmed
    const { error: updateError } = await supabase
      .from('order_status')
      .upsert({
        shopify_order_id: orderId,
        status: 'confirmed',
        updated_at: new Date().toISOString()
      });

    if (updateError) {
      console.error('Error updating order status in database:', updateError);
    }

    // Process wallet update for confirmed order
    try {
      // Get order details for wallet processing
      const { data: orderDetails } = await supabase
        .from('supplier_orders')
        .select('order_number, total_amount')
        .eq('shopify_order_id', orderId)
        .eq('store_url', shop)
        .single();

      if (orderDetails) {
        await OrderWalletService.processOrderStatusChange({
          orderId: orderId,
          orderNumber: orderDetails.order_number || order.order_number || orderId,
          storeUrl: shop,
          status: 'confirmed',
          orderAmount: orderDetails.total_amount || parseFloat(order.total_price || '0')
        });
      }
    } catch (walletError) {
      console.error('Error processing wallet update for confirmation:', walletError);
      // Don't fail the confirmation if wallet update fails
    }

    // Transform the response
    const confirmedOrder = {
      id: order.id?.toString(),
      name: order.name,
      orderNumber: order.order_number,
      confirmed: true,
      fulfillmentStatus: order.fulfillment_status,
      financialStatus: order.financial_status,
      totalPrice: order.total_price
    };

    return NextResponse.json({
      success: true,
      message: 'Order confirmed successfully',
      order: confirmedOrder
    });

  } catch (error) {
    console.error('Error confirming order:', error);
    return NextResponse.json(
      { error: `Failed to confirm order: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

