import { NextResponse } from "next/server";
import { AuthService } from '@/lib/auth-service'
import { SellerStoreService } from '@/lib/services/seller-store-service'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shop = searchParams.get("shop");
    const accessToken = searchParams.get("accessToken");
    const apiKey = searchParams.get("apiKey");
    const apiSecret = searchParams.get("apiSecret");
    const isConnectionTest = searchParams.get("isConnectionTest") === "true";
    
    if (!shop) {
      return NextResponse.json({ 
        error: "Missing required parameter: shop" 
      }, { status: 400 });
    }

    // For non-connection tests, require authentication and verify access
    if (!isConnectionTest) {
      const cookies = request.headers.get('cookie')
      const sessionToken = cookies?.split('; ')
        .find(row => row.startsWith('session_token='))?.split('=')[1];

      if (!sessionToken) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }

      // Verify session and get user info
      const sessionResult = await AuthService.verifySession(sessionToken);
      if (!sessionResult.success || !sessionResult.user || sessionResult.user.userType !== 'seller') {
        return NextResponse.json({ error: 'Seller authentication required' }, { status: 401 });
      }

      // Check store access
      const hasAccess = await SellerStoreService.hasStoreAccess(sessionResult.user.username, shop);
      if (!hasAccess) {
        return NextResponse.json({ 
          error: 'Access denied: You do not have permission to access this store' 
        }, { status: 403 });
      }
    }

    if (!accessToken && (!apiKey || !apiSecret)) {
      return NextResponse.json({ 
        error: "Missing authentication: either accessToken or both apiKey and apiSecret are required" 
      }, { status: 400 });
    }

    console.log(`Fetching orders from shop: ${shop}`);

    let headers: HeadersInit = {
      'Content-Type': 'application/json'
    };

    // Use access token if provided, otherwise use API credentials
    if (accessToken) {
      headers['X-Shopify-Access-Token'] = accessToken;
    } else {
      const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    const response = await fetch(`https://${shop}/admin/api/2024-01/orders.json?status=any&limit=250`, {
      headers,
      cache: 'no-store'
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Shopify API error:', error);
      return NextResponse.json({ 
        error: `Failed to fetch orders: ${JSON.stringify(error)}` 
      }, { status: response.status });
    }

    const data = await response.json();
    
    // Transform orders to a simpler format
    const orders = data.orders.map((order: any) => ({
      id: order.id,
      orderNumber: order.order_number,
      name: order.name,
      customerName: order.customer ? 
        `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : 
        'Guest',
      customerEmail: order.customer?.email || order.email || 'No email',
      status: order.fulfillment_status || 'pending',
      financialStatus: order.financial_status,
      amount: parseFloat(order.total_price),
      currency: order.currency,
      date: order.created_at,
      lineItems: order.line_items.map((item: any) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: parseFloat(item.price),
        sku: item.sku,
        variantId: item.variant_id,
        productId: item.product_id
      }))
    }));

    console.log(`Successfully fetched ${orders.length} orders`);
    return NextResponse.json({ orders });

  } catch (error) {
    console.error("Error fetching Shopify orders:", error);
    return NextResponse.json({ 
      error: `Failed to fetch orders: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 });
  }
}