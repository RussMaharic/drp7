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

    console.log(`Fetching orders via GraphQL from shop: ${shop}`);

    // GraphQL query to fetch orders without sensitive customer data
    const graphqlQuery = `
      query {
        orders(first: 250) {
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
              financialStatus
              createdAt
              lineItems(first: 10) {
                edges {
                  node {
                    id
                    name
                    quantity
                    originalUnitPriceSet {
                      shopMoney {
                        amount
                      }
                    }
                    variant {
                      id
                      product {
                        id
                      }
                    }
                  }
                }
              }
              customer {
                id
                firstName
                lastName
                email
                phone
              }
              shippingAddress {
                firstName
                lastName
                address1
                address2
                city
                province
                country
                zip
                phone
              }
              billingAddress {
                firstName
                lastName
                address1
                address2
                city
                province
                country
                zip
                phone
              }
              tags
              note
            }
          }
        }
      }
    `;

    const response = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: graphqlQuery
      }),
    });

    console.log(`GraphQL response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GraphQL error:", errorText.substring(0, 500));
      return NextResponse.json({ 
        error: `GraphQL request failed: ${response.status} - ${errorText.substring(0, 200)}` 
      }, { status: response.status });
    }

    const data = await response.json();
    console.log("GraphQL response:", data);

    if (data.errors) {
      console.error("GraphQL errors:", data.errors);
      return NextResponse.json({ 
        error: `GraphQL errors: ${data.errors.map((e: any) => e.message).join(', ')}` 
      }, { status: 500 });
    }

    const orders = data.data?.orders?.edges?.map((edge: any) => {
      const order = edge.node;
      
      // Extract phone number from various sources
      const customerPhone = order.customer?.phone || 
                           order.billingAddress?.phone || 
                           order.shippingAddress?.phone || 
                           null;
      
      console.log(`📞 GraphQL Order ${order.id} phone extraction:`, {
        customerPhone: order.customer?.phone,
        billingPhone: order.billingAddress?.phone,
        shippingPhone: order.shippingAddress?.phone,
        finalPhone: customerPhone
      });
      
      return {
        id: order.id.split('/').pop(), // Extract ID from GraphQL global ID
        orderNumber: order.orderNumber,
        name: order.name,
        customerName: order.customer ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() : 'Guest',
        customerEmail: order.customer?.email || 'No email',
        customerPhone: customerPhone,
        status: order.fulfillmentStatus?.toLowerCase() || 'pending',
        financialStatus: order.financialStatus,
        amount: parseFloat(order.totalPriceSet?.shopMoney?.amount || '0'),
        currency: order.totalPriceSet?.shopMoney?.currencyCode || 'INR',
        date: order.createdAt,
        lineItems: order.lineItems?.edges?.map((itemEdge: any) => {
          const item = itemEdge.node;
          return {
            id: item.id.split('/').pop(),
            name: item.name,
            quantity: item.quantity,
            price: parseFloat(item.originalUnitPriceSet?.shopMoney?.amount || '0'),
            variantId: item.variant?.id?.split('/').pop(),
            productId: item.variant?.product?.id?.split('/').pop()
          };
        }) || [],
        shippingAddress: order.shippingAddress,
        billingAddress: order.billingAddress,
        tags: order.tags,
        note: order.note
      };
    }) || [];

    console.log(`Transformed ${orders.length} orders from GraphQL`);
    return NextResponse.json({ orders });

  } catch (error) {
    console.error("Error fetching Shopify orders via GraphQL:", error);
    return NextResponse.json({ 
      error: `Failed to fetch orders from Shopify: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 });
  }
} 