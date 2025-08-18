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

    console.log(`Testing GraphQL connection to shop: ${shop}`);
    console.log(`Access token exists: ${!!accessToken}`);

    // Test basic shop info via GraphQL
    const shopQuery = `
      query {
        shop {
          id
          name
          email
          myshopifyDomain
        }
      }
    `;

    const shopResponse = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: shopQuery
      }),
    });

    console.log(`Shop GraphQL response status: ${shopResponse.status}`);
    
    if (!shopResponse.ok) {
      const errorText = await shopResponse.text();
      console.error("Shop GraphQL error:", errorText.substring(0, 500));
      return NextResponse.json({ 
        error: `Shop GraphQL failed: ${shopResponse.status} - ${errorText.substring(0, 200)}` 
      }, { status: shopResponse.status });
    }

    const shopData = await shopResponse.json();
    console.log("Shop GraphQL successful:", shopData.data?.shop?.name);

    // Test orders endpoint via GraphQL
    const ordersQuery = `
      query {
        orders(first: 5) {
          edges {
            node {
              id
              name
              orderNumber
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              fulfillmentStatus
              createdAt
              customer {
                id
                firstName
                lastName
                email
              }
            }
          }
        }
      }
    `;

    const ordersResponse = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: ordersQuery
      }),
    });

    console.log(`Orders GraphQL response status: ${ordersResponse.status}`);

    if (!ordersResponse.ok) {
      const errorText = await ordersResponse.text();
      console.error("Orders GraphQL error:", errorText.substring(0, 500));
      return NextResponse.json({ 
        error: `Orders GraphQL failed: ${ordersResponse.status} - ${errorText.substring(0, 200)}` 
      }, { status: ordersResponse.status });
    }

    const ordersData = await ordersResponse.json();
    console.log("Orders GraphQL response:", ordersData);

    if (ordersData.errors) {
      console.error("GraphQL errors:", ordersData.errors);
      return NextResponse.json({ 
        error: `GraphQL errors: ${ordersData.errors.map((e: any) => e.message).join(', ')}` 
      }, { status: 500 });
    }

    const orders = ordersData.data?.orders?.edges || [];
    console.log("Orders test successful:", {
      hasOrders: orders.length > 0,
      orderCount: orders.length,
      sampleOrder: orders[0] ? {
        id: orders[0].node.id,
        name: orders[0].node.name,
        orderNumber: orders[0].node.orderNumber
      } : null
    });

    return NextResponse.json({ 
      success: true,
      shop: shopData.data?.shop,
      ordersTest: {
        hasOrders: orders.length > 0,
        orderCount: orders.length,
        sampleOrder: orders[0] ? {
          id: orders[0].node.id,
          name: orders[0].node.name,
          orderNumber: orders[0].node.orderNumber
        } : null
      }
    });

  } catch (error) {
    console.error("GraphQL test error:", error);
    return NextResponse.json({ 
      error: `GraphQL test failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 });
  }
} 