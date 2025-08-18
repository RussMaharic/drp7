import { NextResponse } from 'next/server';
import { getShopToken } from '../../../auth/shopify/route';
import { OrderWalletService } from '@/lib/services/order-wallet-service';
import { supabase } from '@/lib/supabase';

// POST to cancel an order
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

    // Get request body for cancellation options
    const body = await request.json();
    const {
      reason = 'other',
      restock = true,
      notifyCustomer = true,
      amount = null
    } = body;

    // Extract numeric order ID (remove GraphQL prefix if present)
    const numericOrderId = orderId.startsWith('gid://') ? orderId.split('/').pop() : orderId;
    console.log(`Canceling order ${orderId} (Numeric ID: ${numericOrderId}) from shop: ${shop} with reason: ${reason}`);

    // Use REST API directly for better reliability
    const restPayload: any = {
      restock: restock,
      reason: reason,
      email: notifyCustomer
    };

    if (amount !== null) {
      restPayload.amount = amount;
    }

    let response = await fetch(`https://${shop}/admin/api/2025-01/orders/${numericOrderId}/cancel.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(restPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('REST API error:', errorText);
      
      // Parse error message for better user feedback
      let errorMessage = `Failed to cancel order: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.errors) {
          errorMessage = Array.isArray(errorData.errors) 
            ? errorData.errors.join(', ')
            : JSON.stringify(errorData.errors);
        }
      } catch (e) {
        errorMessage += ` - ${errorText}`;
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    // REST API response
    const data = await response.json();
    console.log('Order cancellation response:', data);

    // Process wallet update for RTO/cancellation
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
          orderNumber: orderDetails.order_number || data.order?.order_number || orderId,
          storeUrl: shop,
          status: 'cancelled',
          orderAmount: orderDetails.total_amount || parseFloat(data.order?.total_price || '0')
        });
      }
    } catch (walletError) {
      console.error('Error processing wallet update for cancellation:', walletError);
      // Don't fail the cancellation if wallet update fails
    }

    // Transform the response to match expected format
    const cancelledOrder = {
      id: data.order?.id?.toString(),
      name: data.order?.name,
      orderNumber: data.order?.order_number,
      cancelled: !!data.order?.cancelled_at,
      cancelledAt: data.order?.cancelled_at,
      cancelReason: data.order?.cancel_reason,
      fulfillmentStatus: data.order?.fulfillment_status,
      financialStatus: data.order?.financial_status
    };

    return NextResponse.json({
      success: true,
      message: 'Order cancelled successfully',
      order: cancelledOrder
    });

  } catch (error) {
    console.error('Error canceling order:', error);
    return NextResponse.json(
      { error: `Failed to cancel order: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}