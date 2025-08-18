import { NextResponse } from "next/server"
import { TokenManager } from "@/lib/token-manager"

// Keep in-memory store as fallback for backward compatibility
const shopTokens: Record<string, string> = {};

export { shopTokens };

// Function to clear tokens (for testing)
export function clearTokens() {
  Object.keys(shopTokens).forEach(key => delete shopTokens[key]);
}

// Get token from Supabase or fallback to in-memory
export async function getShopToken(shop: string): Promise<string | null> {
  try {
    // Try Supabase first
    const token = await TokenManager.getToken(shop)
    if (token) {
      // Also update in-memory for backward compatibility
      shopTokens[shop] = token
      return token
    }
    
    // Fallback to in-memory
    return shopTokens[shop] || null
  } catch (error) {
    console.error('Error getting token:', error)
    // Fallback to in-memory
    return shopTokens[shop] || null
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const shop = searchParams.get("shop");
  const error = searchParams.get("error");
  const appUrl = process.env.SHOPIFY_APP_URL || "http://localhost:3000";

  if (error) {
    return NextResponse.redirect(`${appUrl}/connect-shopify?error=oauth_failed`);
  }

  if (code && shop) {
    try {
      // Exchange code for access token
      const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: process.env.SHOPIFY_CLIENT_ID,
          client_secret: process.env.SHOPIFY_CLIENT_SECRET,
          code,
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) throw new Error("No access token");
      
      // Store token in Supabase
      const stored = await TokenManager.storeToken(shop, tokenData.access_token);
      if (!stored) {
        console.warn('Failed to store token in Supabase, using in-memory fallback');
      }
      
      // Also store in-memory for backward compatibility
      shopTokens[shop] = tokenData.access_token;
      
      // Redirect to dashboard on the public tunnel
      return NextResponse.redirect(`${appUrl}/dashboard?connected=true`);
    } catch (err) {
      return NextResponse.redirect(`${appUrl}/connect-shopify?error=token_exchange_failed`);
    }
  }

  // Start OAuth flow
  const shopParam = searchParams.get("shop");
  if (!shopParam) {
    return NextResponse.redirect(`${appUrl}/connect-shopify?error=missing_shop`);
  }
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const redirectUri = `${appUrl}/api/auth/shopify`;
  const scopes = "read_products,write_products,read_orders,write_orders,read_customers,read_inventory";
  const shopifyAuthUrl = `https://${shopParam}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=nonce&grant_options[]=`;
  return NextResponse.redirect(shopifyAuthUrl);
}
