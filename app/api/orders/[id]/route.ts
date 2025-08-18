import { NextResponse } from 'next/server';
import { getShopToken } from '../../auth/shopify/route';

// GET individual order status
export async function GET(
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

    console.log(`Fetching order status for ${orderId} from shop: ${shop}`);

    // Extract numeric order ID (remove GraphQL prefix if present)
    const numericOrderId = orderId.startsWith('gid://') ? orderId.split('/').pop() : orderId;
    console.log(`Fetching order status for ID: ${orderId}, Numeric ID: ${numericOrderId}`);

    // Use REST API instead of GraphQL for better reliability
    const fields = [
      'id', 'name', 'order_number', 'confirmed', 'cancelled_at', 'cancel_reason',
      'fulfillment_status', 'financial_status', 'total_price', 'currency',
      'created_at', 'updated_at', 'processed_at', 'closed_at', 'note', 'tags',
      'customer', 'fulfillments'
    ].join(',');

    const response = await fetch(
      `https://${shop}/admin/api/2025-01/orders/${numericOrderId}.json?fields=${fields}`, 
      {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('REST API error:', errorText);
      return NextResponse.json(
        { error: `Failed to fetch order: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('REST API Response:', data);

    const order = data.order;
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Enhanced status determination logic using REST API fields
    const getOrderStatus = (order: any) => {
      // Priority order: cancelled > confirmed > fulfillment status
      // Check if order is cancelled using cancelled_at field (REST API format)
      if (order.cancelled_at) {
        return 'cancelled';
      }
      
      // Check if order is confirmed
      if (order.confirmed) {
        // Check fulfillment after confirmation (REST API uses lowercase)
        if (order.fulfillment_status === 'fulfilled') {
          return 'confirmed_fulfilled';
        } else if (order.fulfillment_status === 'partial') {
          return 'confirmed_partial';
        } else {
          return 'confirmed';
        }
      }
      
      // Fallback to fulfillment status
      switch (order.fulfillment_status) {
        case 'fulfilled':
          return 'fulfilled';
        case 'partial':
          return 'partially_fulfilled';
        case 'unfulfilled':
        case null:
        default:
          return 'unfulfilled';
      }
    };

    const getDisplayStatus = (order: any) => {
      // Check cancellation first
      if (order.cancelled_at) {
        return 'Cancelled';
      }
      
      // Check confirmation status
      if (order.confirmed) {
        if (order.fulfillment_status === 'fulfilled') {
          return 'Confirmed & Fulfilled';
        }
        return 'Confirmed';
      }
      
      // Capitalize fulfillment status for display
      const status = order.fulfillment_status;
      if (!status) return 'Unfulfilled';
      
      return status.charAt(0).toUpperCase() + status.slice(1);
    };

    // Transform the order data with enhanced status (REST API format)
    const orderStatus = {
      id: order.id.toString(),
      name: order.name,
      orderNumber: order.order_number,
      fulfillmentStatus: getOrderStatus(order),
      financialStatus: order.financial_status?.toLowerCase() || 'pending',
      displayFulfillmentStatus: getDisplayStatus(order),
      displayFinancialStatus: order.financial_status,
      // Core status fields following REST API format
      confirmed: order.confirmed,
      cancelled: !!order.cancelled_at, // Convert to boolean
      cancelledAt: order.cancelled_at,
      cancelReason: order.cancel_reason || null,
      fullyPaid: order.financial_status === 'paid',
      closed: !!order.closed_at,
      test: order.test || false,
      processedAt: order.processed_at,
      closedAt: order.closed_at,
      amount: parseFloat(order.total_price || '0'),
      currency: order.currency || 'USD',
      fulfillments: order.fulfillments || [],
      customerInfo: order.customer ? {
        id: order.customer.id,
        name: `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim(),
        email: order.customer.email
      } : null,
      note: order.note,
      tags: order.tags ? order.tags.split(',').map((tag: string) => tag.trim()) : [],
      createdAt: order.created_at,
      updatedAt: order.updated_at
    };

    return NextResponse.json({ order: orderStatus });

  } catch (error) {
    console.error('Error fetching order status:', error);
    return NextResponse.json(
      { error: `Failed to fetch order status: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}