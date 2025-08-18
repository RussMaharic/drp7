import { NextResponse } from "next/server";
import { getShopToken } from "../auth/shopify/route";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shop = searchParams.get("shop");
    
    if (!shop) {
      return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
    }

    const accessToken = await getShopToken(shop);
    if (!accessToken) {
      return NextResponse.json({ error: "Missing access token. Please connect to Shopify first." }, { status: 401 });
    }

    console.log(`Fetching orders from shop: ${shop}`);
    console.log(`Access token exists: ${!!accessToken}`);

    // Try different API versions if one fails
    const apiVersions = ['2024-01', '2023-10', '2023-07'];
    let data: any = null;
    let response: Response | null = null;
    let lastError: string = '';

    for (const version of apiVersions) {
      try {
        const shopifyUrl = `https://${shop}/admin/api/${version}/orders.json?status=any&limit=250`;
        console.log(`Trying API version ${version} at: ${shopifyUrl}`);
        
        response = await fetch(shopifyUrl, {
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
        });

        console.log(`Response status for ${version}: ${response.status}`);
        console.log(`Response headers for ${version}:`, Object.fromEntries(response.headers.entries()));

        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const textResponse = await response.text();
          console.error(`Non-JSON response for ${version}:`, textResponse.substring(0, 500));
          lastError = `API version ${version} returned non-JSON response`;
          continue;
        }

        data = await response.json();
        
        if (response.ok) {
          console.log(`Success with API version ${version}`);
          break;
        } else {
          console.error(`API version ${version} error:`, data);
          lastError = `API version ${version} failed: ${JSON.stringify(data)}`;
        }
      } catch (error) {
        console.error(`Error with API version ${version}:`, error);
        lastError = `API version ${version} error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }

    if (!response || !data) {
      return NextResponse.json({ 
        error: `All API versions failed. Last error: ${lastError}` 
      }, { status: 500 });
    }
    console.log(`Response data keys:`, Object.keys(data));
    
    if (!response.ok) {
      console.error("Shopify API error:", data);
      return NextResponse.json({ error: data.errors || data || "Shopify error" }, { status: response.status });
    }

    // Check if orders exist in the response
    if (!data.orders) {
      console.log("No orders property in response:", data);
      return NextResponse.json({ orders: [] });
    }

    console.log(`Found ${data.orders.length} orders`);

    // Transform Shopify orders to match our interface
    const transformedOrders = data.orders.map((order: any) => {
      // Extract phone number from various sources
      const customerPhone = order.customer?.phone || 
                           order.billing_address?.phone || 
                           order.shipping_address?.phone || 
                           null;
      
      console.log(`📞 Order ${order.id} phone extraction:`, {
        customerPhone: order.customer?.phone,
        billingPhone: order.billing_address?.phone,
        shippingPhone: order.shipping_address?.phone,
        finalPhone: customerPhone
      });
      
      return {
        id: order.id.toString(),
        orderNumber: order.order_number,
        name: order.name,
        customerName: order.customer ? `${order.customer.first_name} ${order.customer.last_name}`.trim() : 'Guest',
        customerEmail: order.customer?.email || order.email || 'No email',
        customerPhone: customerPhone,
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
          variantId: item.variant_id,
          productId: item.product_id
        })),
        shippingAddress: order.shipping_address,
        billingAddress: order.billing_address,
        tags: order.tags,
        note: order.note
      };
    });

    console.log(`Transformed ${transformedOrders.length} orders`);
    return NextResponse.json({ orders: transformedOrders });
  } catch (error) {
    console.error("Error fetching Shopify orders:", error);
    return NextResponse.json({ 
      error: `Failed to fetch orders from Shopify: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shop = searchParams.get("shop");
    const orderId = searchParams.get("orderId");
    
    if (!shop || !orderId) {
      return NextResponse.json({ error: "Missing shop or orderId parameter" }, { status: 400 });
    }

    const accessToken = await getShopToken(shop);
    if (!accessToken) {
      return NextResponse.json({ error: "Missing access token. Please connect to Shopify first." }, { status: 401 });
    }

    const body = await request.json();
    const { fulfillmentStatus } = body;

    // Try different API versions for updating orders
    const apiVersions = ['2024-01', '2023-10', '2023-07'];
    let data: any = null;
    let response: Response | null = null;
    let lastError: string = '';

    for (const version of apiVersions) {
      try {
        const shopifyUrl = `https://${shop}/admin/api/${version}/orders/${orderId}.json`;
        console.log(`Trying to update order with API version ${version} at: ${shopifyUrl}`);
        
        response = await fetch(shopifyUrl, {
          method: "PUT",
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            order: {
              id: orderId,
              fulfillment_status: fulfillmentStatus
            }
          }),
        });

        console.log(`Update response status for ${version}: ${response.status}`);

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const textResponse = await response.text();
          console.error(`Non-JSON update response for ${version}:`, textResponse.substring(0, 500));
          lastError = `API version ${version} returned non-JSON response`;
          continue;
        }

        data = await response.json();
        
        if (response.ok) {
          console.log(`Update success with API version ${version}`);
          break;
        } else {
          console.error(`API version ${version} update error:`, data);
          lastError = `API version ${version} failed: ${JSON.stringify(data)}`;
        }
      } catch (error) {
        console.error(`Error updating with API version ${version}:`, error);
        lastError = `API version ${version} error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }

    if (!response || !data) {
      return NextResponse.json({ 
        error: `All API versions failed for update. Last error: ${lastError}` 
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, order: data.order });
  } catch (error) {
    console.error("Error updating Shopify order:", error);
    return NextResponse.json({ error: "Failed to update order in Shopify" }, { status: 500 });
  }
} 