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

    console.log(`Testing connection to shop: ${shop}`);
    console.log(`Access token exists: ${!!accessToken}`);

    // Test basic shop info first
    const shopInfoUrl = `https://${shop}/admin/api/2024-01/shop.json`;
    console.log(`Testing shop info at: ${shopInfoUrl}`);
    
    const shopResponse = await fetch(shopInfoUrl, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    console.log(`Shop info response status: ${shopResponse.status}`);
    
    if (!shopResponse.ok) {
      const errorText = await shopResponse.text();
      console.error("Shop info error:", errorText.substring(0, 500));
      return NextResponse.json({ 
        error: `Shop info failed: ${shopResponse.status} - ${errorText.substring(0, 200)}` 
      }, { status: shopResponse.status });
    }

    const shopData = await shopResponse.json();
    console.log("Shop info successful:", shopData.shop?.name);

    // Now test orders endpoint
    const ordersUrl = `https://${shop}/admin/api/2024-01/orders.json?limit=1`;
    console.log(`Testing orders endpoint at: ${ordersUrl}`);
    
    const ordersResponse = await fetch(ordersUrl, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    console.log(`Orders response status: ${ordersResponse.status}`);
    console.log(`Orders response headers:`, Object.fromEntries(ordersResponse.headers.entries()));

    const contentType = ordersResponse.headers.get('content-type');
    console.log(`Content-Type: ${contentType}`);

    if (!ordersResponse.ok) {
      const errorText = await ordersResponse.text();
      console.error("Orders error:", errorText.substring(0, 500));
      return NextResponse.json({ 
        error: `Orders endpoint failed: ${ordersResponse.status} - ${errorText.substring(0, 200)}` 
      }, { status: ordersResponse.status });
    }

    if (!contentType || !contentType.includes('application/json')) {
      const textResponse = await ordersResponse.text();
      console.error("Non-JSON orders response:", textResponse.substring(0, 500));
      return NextResponse.json({ 
        error: "Orders endpoint returned non-JSON response" 
      }, { status: 500 });
    }

    const ordersData = await ordersResponse.json();
    console.log("Orders test successful:", {
      hasOrders: !!ordersData.orders,
      orderCount: ordersData.orders?.length || 0,
      responseKeys: Object.keys(ordersData)
    });

    return NextResponse.json({ 
      success: true,
      shop: shopData.shop,
      ordersTest: {
        hasOrders: !!ordersData.orders,
        orderCount: ordersData.orders?.length || 0,
        sampleOrder: ordersData.orders?.[0] ? {
          id: ordersData.orders[0].id,
          name: ordersData.orders[0].name,
          order_number: ordersData.orders[0].order_number
        } : null
      }
    });

  } catch (error) {
    console.error("Test error:", error);
    return NextResponse.json({ 
      error: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 });
  }
} 