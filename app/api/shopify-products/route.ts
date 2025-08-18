import { NextResponse } from "next/server";
import { TokenManager } from "@/lib/token-manager";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shop = searchParams.get("shop");
    
    if (!shop) {
      return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
    }

    const accessToken = await TokenManager.getToken(shop);
    if (!accessToken) {
      return NextResponse.json({ error: "Missing access token. Please connect to Shopify first." }, { status: 401 });
    }

    // Fetch products from Shopify
    const response = await fetch(`https://${shop}/admin/api/2023-10/products.json`, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error("Shopify API error:", data);
      return NextResponse.json({ error: data.errors || data || "Shopify error" }, { status: response.status });
    }

    // Return the list of Shopify products
    return NextResponse.json({ products: data.products });
  } catch (error) {
    console.error("Error fetching Shopify products:", error);
    return NextResponse.json({ error: "Failed to fetch products from Shopify" }, { status: 500 });
  }
} 